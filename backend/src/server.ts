import { chromium, Page, Browser } from 'playwright';
import { WebSocketServer } from 'ws';


// ------------------ CACHE ------------------ // 

const tickersToWatch : Set<string> = new Set();                    // A Set to hold all unique tickers that clients are watching.
const priceCache : Record<string, number | null> = {};             // A cache to store the latest prices of all tickers.
const tickerSubscriptions : Map<string, Set<string>> = new Map();  // Maps a ticker name to the user IDs who are watching it.
const userConnections : Map<string, WebSocket> = new Map();        // Maps a user ID to their WebSocket client.


// ------------------ PLAYWRIGHT ------------------ //

let browser : Browser | null = null;
const pages = new Map();


async function setupPlaywright() {
  if (browser) return;
  console.log('Launching Playwright browser...');
  browser = await chromium.launch({ headless: false });
}

async function getPage(ticker : string) : Promise<Page> {
  if (pages.has(ticker))
    return pages.get(ticker);

  // Create a new promise immediately, before the await calls
  const pagePromise = (async () => {
    try {
      const page = await browser.newPage();
      await page.goto(`https://www.tradingview.com/symbols/${ticker}/?exchange=BINANCE`);
      return page;
    } catch (error) {
      await removePage(ticker);
      throw error;
    }
  })();

  // Store the promise in the map immediately
  pages.set(ticker, pagePromise);

  // Wait for the promise to resolve and return the page
  return pagePromise;
} 


async function removePage(ticker : string) {
  const pagePromise = pages.get(ticker);
  if (pagePromise) {
    try {
      const page = await pagePromise;
      await page.close();
      console.log(`Page for ${ticker} closed successfully.`);
    } catch (error) {
      console.error(`Error closing page for ${ticker}:`, error);
    }
    pages.delete(ticker);
    console.log(`Reference to page for ${ticker} deleted.`);
  }
}



// ------------------ SCRAPE TICKERS INFO ------------------ //

async function tickerExists(ticker : string) : Promise<boolean> {
  if (tickersToWatch.has(ticker)) return true;
  let exists = true;
  try {
      const url = `https://www.tradingview.com/symbols/${ticker}/?exchange=BINANCE`;
      const pageToCheck = await browser.newPage();
      const response = await pageToCheck.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      if (response){
        const status = response.status();
        console.log("Page for ticker ", ticker, " loaded with status: ", status, "!");
        if (status >= 400) {
          exists = false;
          pageToCheck.close();
        }
        pages.set(ticker, pageToCheck);
      }
  }
  catch (error) {
      console.error(`Failed to load page for ${ticker}.`, error);
      exists = false;
  }
  return exists;
}


async function scrapTicker(ticker : string) : Promise<boolean> {
      
    try {

      // Scrape the price from the page
      const page = await getPage(ticker);
      const priceElement = await page.waitForSelector('.lastContainer-zoF9r75I', { timeout: 5000 });
      const innerText = await priceElement.innerText();
      const price = parseFloat(innerText.replace(/[^0-9.]/g, ''));
          
      const final_price = isNaN(price) ? null : price;

      if (final_price !== null && (priceCache[ticker] === undefined || priceCache[ticker] !== final_price)) {
        priceCache[ticker] = final_price;          // Update the cache
        broadcastPriceUpdate(ticker, final_price); // Notify clients
        console.log(` < > New price for ${ticker}: ${final_price}`);
      }
      return true;

    } catch (error) {
        console.error(` <x> Error scraping ${ticker}: ${error.message}`);
        // Handle the error, e.g., remove the ticker from the set
    }

    return false;
}

async function scrapeAllTickers() {

    if (tickersToWatch.size === 0 || !browser) {
        console.log("Waiting for ticker to watch...");
        return;
      }

    const scrapingTasks = Array.from(tickersToWatch).map(ticker => scrapTicker(ticker));

    await Promise.all(scrapingTasks);

}

function broadcastPriceUpdate(ticker : string, price : number) {
  // Get the set of user IDs interested in this ticker
  const users = tickerSubscriptions.get(ticker);
  if (users) {
    // Iterate over the users and send the update to each one
    users.forEach(userId => {
      const client = userConnections.get(userId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ ticker, price }));
      }
    });
  }
}


// ------------------ ADD + REMOVE TICKER (multi user support) ------------------ //

async function addTicker(ticker: string, userId: string, ws: WebSocket) {
  
      console.log(`User ${userId} wants to add ticker ${ticker}.`);

      const exists = await tickerExists(ticker);
      if (!exists) {
        ws.send(JSON.stringify({ ticker: ticker, price: -1 }));  // send back a -1 to indicate that the ticker does not exist
        return;
      }

      // Add the ticker to the set of tickers to watch
      if (!tickersToWatch.has(ticker)) {
        console.log(`--- Adding ticker to watch list: ${ticker} ---`);
        tickersToWatch.add(ticker);
      }

      // Add the user to the set of users watching this ticker
      if (!tickerSubscriptions.has(ticker)) {
        tickerSubscriptions.set(ticker, new Set());
      }
      tickerSubscriptions.get(ticker).add(userId);
      
      // Send the latest cached price for the new ticker
      if (priceCache[ticker]) {
        ws.send(JSON.stringify({ ticker: ticker, price: priceCache[ticker] }));
      }
}

function removeTicker(ticker : string, userId: string){
  
  console.log(`User ${userId} wants to remove ticker ${ticker}.`);

  // Remove the user from the set of users watching this ticker
  if (tickerSubscriptions.has(ticker)) {
    tickerSubscriptions.get(ticker).delete(userId);

    // Remove the ticker from the set of tickers to watch if no one is watching it
    if (tickerSubscriptions.get(ticker).size === 0) {
      console.log(`--- Removing ticker from watch list: ${ticker} ---`);
      tickersToWatch.delete(ticker);
      removePage(ticker);
    }
  }
}


// ------------------ SERVER CONETION MANAGEMENT ------------------ //

// Graceful shutdown function to close all resources
async function gracefulShutdown() {
  console.log('\nShutting down gracefully...');
  
  // Close the WebSocket server
  if (wss) {
    wss.clients.forEach(client => client.close());
    wss.close();
  }

  // Close all Playwright pages
  for (const [ticker, pagePromise] of pages) {
    try {
      const page = await pagePromise;
      await page.close();
      console.log(`Page for ${ticker} closed.`);
    } catch (e) {
      console.error(`Error closing page for ${ticker}:`, e.message);
    }
  }
  
  // Close the main browser instance
  if (browser) {
    await browser.close();
    console.log('Playwright browser closed.');
  }
  
  process.exit(0);
}




// Set up WebSocket Server
const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', ws => {
  console.log('Client connected!');

  // Handle messages from the client
  ws.on('message', async (message : string) => {
    const data = JSON.parse(message);
    const userId = data.userId;

    if (!userId) {
      console.error("Received message without a userId.");
      return;
    }

    // Assign the userId directly to the WebSocket object for later retrieval
    ws.userId = userId;

    // Store the connection for this user
    userConnections.set(userId, ws);

    if (data.action === 'addTicker') {
      await addTicker(data.ticker, userId, ws);
    }

    if (data.action === 'removeTicker') {
      removeTicker(data.ticker, userId);
    }
  });

  // When a client disconnects, we can check if any tickers are no longer being watched by anyone
  ws.on('close', () => {
    // Retrieve the userId from the closed WebSocket object
    const userId = ws.userId;
    if (userId) {
      console.log(`Client disconnected, User ID: ${userId}`);
      
      // Now you can easily clean up all data associated with this user
      userConnections.delete(userId);
      
      tickerSubscriptions.forEach((users, ticker) => {
        users.delete(userId);
        if (users.size === 0) {
          tickersToWatch.delete(ticker);
          tickerSubscriptions.delete(ticker);
          removePage(ticker);
          console.log(`No users watching ${ticker}. Removed from watch list.`);
        }
      });
    } else {
      console.log('Client disconnected, but no user ID was found.');
    }
  });
});




export { setupPlaywright, scrapeAllTickers, gracefulShutdown };