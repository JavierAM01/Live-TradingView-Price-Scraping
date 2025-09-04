import { TickerPrices } from './ticker_prices';



function App() {

    return (
        <div style={{ fontFamily: 'sans-serif', textAlign: 'center', marginTop: '50px', alignItems: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column' }}>
            
            <h1>FullStack Tradiview - Live Prices </h1>
            <h5> By Javier Abollado </h5>
            <TickerPrices />

        </div>
    );
}


export default App;