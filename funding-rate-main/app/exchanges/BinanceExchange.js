const BaseExchange = require('./BaseExchange');

class BinanceExchange extends BaseExchange {
    constructor() {
        const specificConfig = {
            apiKey: process.env.BINANCE_API_KEY,
            secret: process.env.BINANCE_API_SECRET,
        };
        super('binance', specificConfig);
    }

    // 获取24h，交易量最大的Top 10 合约交易对
    async getTop10Futures() {
        const tickers = await this.exchange.fetchTickers();
        const futures = Object.values(tickers).filter(ticker => ticker.symbol.includes('USDT'));
        const sortedFutures = futures.sort((a, b) => b.quoteVolume - a.quoteVolume);
        return sortedFutures.slice(0, 10).map(ticker => ({
            ...ticker,
            baseSymbol: ticker.symbol.split('/')[0]
        }));
    }   
}

module.exports = BinanceExchange; 