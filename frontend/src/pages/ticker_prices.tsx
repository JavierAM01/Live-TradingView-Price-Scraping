import { useEffect, useState, useRef } from 'react';
import { LoadingSpinner, WarningPopup } from './helper';
import styles from '../css/ticker_prices.module.css';





// A simple function to get or create a user ID -> one ID per computer
function getUserId_v2() {
    if (typeof window === 'undefined' || !window.localStorage)
        return null;
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = crypto.randomUUID();
        localStorage.setItem('userId', userId);
    }
    return userId;
}

// A simple function to get or create a user ID -> one ID per session
function getUserId() {
    if (typeof window === 'undefined')
        return null;
    return crypto.randomUUID();
}


const TickerPrices = () => {
    const [warning, setWarning] = useState< { title: string , message: string } | null >(null);
    const [tickers, setTickers] = useState({});
    const [tickerInput, setTickerInput] = useState('');
    const [userId, setUserId] = useState<string | null>(null);
    const ws = useRef(null);

    useEffect(() => {
        const currentUserId = getUserId();    
        setUserId(currentUserId);
    }, []);


    useEffect(() => {

        ws.current = new WebSocket('ws://localhost:8080');

        ws.current.onopen = () => {
            console.log('WebSocket connected.');
            // When we connect, we can send a message to the backend to "subscribe"
            // to our current list of tickers.
            Object.keys(tickers).forEach(tickerName => ws.current.send(JSON.stringify({ action: 'addTicker', ticker: tickerName, userId: userId })));
        };

        ws.current.onmessage = (event) => {
            const { ticker, price } = JSON.parse(event.data);

            // Check if non existing ticker
            if (price === -1){
                setWarning({ title: 'Warning', message: `Ticker ${ticker} does not exist.` });
                removeTicker(ticker);
                return;
            }

            // Update the price for the specific ticker in the state with O(1) complexity
            setTickers(prevTickers => {
                return {
                    ...prevTickers,
                    [ticker]: {
                        ...(prevTickers[ticker] || {}), // Get existing data or an empty object
                        price: price
                    }
                };
            });
        };

        // Cleanup: close the WebSocket connection when the component unmounts
        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, []);

    const addTicker = () => {
        const ticker = tickerInput.trim().toUpperCase();
        if (!ticker) return;

        // Check if the ticker already exists to avoid duplicates
        if (tickers.hasOwnProperty(ticker)) {
            setWarning({ title: 'Warning', message: `Ticker ${ticker} already exists.` });
            return;
        }

        setTickers(prevTickers => ({
            ...prevTickers,
            [ticker]: { name: ticker, price: null }
        }));
        setTickerInput('');

        console.log("Adding ticker:", ticker);

        // Tell the backend to start watching this new ticker
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ action: 'addTicker', ticker: ticker, userId: userId }));
        }
    };
    
    const removeTicker = (tickerName : string) => {
        // Remove the ticker from the state object
        setTickers(prevTickers => {
            const newTickers : any = { ...prevTickers };
            delete newTickers[tickerName];
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({ action: 'removeTicker', ticker: tickerName, userId: userId }));
            }
            return newTickers;
        });
        console.log("Removing ticker:", tickerName);
    };


    return (
        <>            
            {/* Chose new ticker */}
            <div id="ticker-input" style={{ marginBottom: '20px' }}>
                <input
                    type="text"
                    value={tickerInput}
                    onChange={(e) => setTickerInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTicker(tickerInput)}
                    placeholder="Enter ticker (e.g., BTCUSD)"
                    style={{ padding: '8px', marginRight: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
                <button onClick={() => addTicker(tickerInput)} style={{ padding: '8px 12px', borderRadius: '4px', border: 'none', backgroundColor: '#0070f3', color: 'white' }}>
                    Add
                </button>
            </div>

            {/* Render tickers */}
            <div id="tickers" className={styles.flexContainer}>
                {Object.keys(tickers).length > 0 ? (
                    Object.keys(tickers)
                    .sort()
                    .map((tickerName) => (
                        <TickerRow 
                            key={tickerName} 
                            ticker={tickerName} 
                            price={tickers[tickerName].price} 
                            onDelete={() => removeTicker(tickerName)} 
                        />
                    ))
                ) : (
                    <p className={styles.noTickers}>No tickers added yet. Try adding one!</p>
                )}
            </div>

            {/* Render warnings */}
            {warning && <WarningPopup title={warning.title} message={warning.message} onClick={() => setWarning(null)} />}

        </>
    );
}



// This new component handles the streaming logic for each individual ticker.
const TickerRow = ({ ticker, price, onDelete } : { ticker: string, price: number, onDelete: () => void }) => {

    const [isPriceChanging, setIsPriceChanging] = useState(false);
    const prevPriceRef : any = useRef();

    useEffect(() => {
        if (prevPriceRef.current && price && prevPriceRef.current !== price) {
            setIsPriceChanging(true);
            const timer = setTimeout(() => { setIsPriceChanging(false); }, 1000);
            return () => clearTimeout(timer);
        }
        prevPriceRef.current = price;
    }, [price]);

    const formatPrice = (num : number) => {
        return num.toLocaleString('en-US');
    };

    return (
        <div className={styles.tickerContainer}>
            <span className={styles.tickerName}>{ticker}</span>
            <div className={styles.tickerPriceWrapper}>
                { !price ? (
                        <LoadingSpinner />
                    ) : (
                     <span className={`${styles.tickerPrice} ${isPriceChanging ? `${styles.priceBold}` : ''}`}>{formatPrice(price)}</span>
                )}
                <button onClick={onDelete} className={styles.closeButton}>&times;</button>
            </div>
        </div>
    );
};





export { TickerPrices };