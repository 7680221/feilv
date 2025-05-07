const BaseExchange = require('./BaseExchange');

class BitgetExchange extends BaseExchange {
    constructor() {
        const specificConfig = {
            apiKey: process.env.BITGET_API_KEY,
            secret: process.env.BITGET_API_SECRET,
            password: process.env.BITGET_API_PASSWORD,
            options: {
                defaultType: 'swap',
                defaultContractType: 'perpetual',
                defaultMarginMode: 'cross',
                defaultLeverage: 5
            }
        };
        super('bitget', specificConfig);
    }

    async initialize() {
        await super.initialize();
        console.log('【Bitget】初始化完成');
    }

    async getFundingRates(symbols = undefined) {
        try {
            if (!this.exchange.markets) {
                await this.exchange.loadMarkets();
            }

            // 如果未提供 symbols，则使用所有永续合约市场
            if (symbols === undefined) {
                symbols = Object.keys(this.exchange.markets).filter(symbol => {
                    const market = this.exchange.markets[symbol];
                    return market && market.swap === true;
                });
            }

            console.log(`【Bitget】开始获取 ${symbols.length} 个交易对的资金费率...`);
            const fundingRates = {};

            // Bitget 支持批量获取资金费率
            try {
                const response = await this.exchange.fetchFundingRates(symbols);
                console.log(`【Bitget】成功获取 ${Object.keys(response).length} 个交易对的资金费率`);
                return response;
            } catch (error) {
                console.error(`【Bitget】获取资金费率失败:`, error.message);
                throw error;
            }
        } catch (error) {
            console.error(`【Bitget】获取资金费率时发生错误:`, error.message);
            throw error;
        }
    }

    async fetchTicker(symbol) {
        try {
            if (!this.exchange.markets) {
                await this.exchange.loadMarkets();
            }

            const params = {
                'type': 'swap',
                'contract': true
            };

            console.log(`【Bitget】获取 ${symbol} 的行情数据...`);
            const rawTicker = await this.exchange.fetchTicker(symbol, params);

            return {
                symbol: rawTicker.symbol,
                timestamp: rawTicker.timestamp,
                datetime: rawTicker.datetime,
                high: rawTicker.high,
                low: rawTicker.low,
                bid: rawTicker.bid,
                ask: rawTicker.ask,
                last: rawTicker.last,
                close: rawTicker.close,
                previousClose: rawTicker.previousClose,
                change: rawTicker.change,
                percentage: rawTicker.percentage,
                average: rawTicker.average,
                baseVolume: rawTicker.baseVolume,
                quoteVolume: rawTicker.quoteVolume,
                info: rawTicker.info,
                markPrice: Number(rawTicker.info.markPrice),
                indexPrice: Number(rawTicker.info.indexPrice),
                fundingRate: Number(rawTicker.info.fundingRate),
                nextFundingTime: rawTicker.info.nextFundingTime,
                maxLeverage: Number(rawTicker.info.maxLeverage)
            };
        } catch (error) {
            console.error(`【Bitget】获取行情数据失败:`, error.message);
            throw error;
        }
    }

    async createMarketOrderWithSlippage(symbol, side, positionSize, leverage=1, slippage = 0.05) {
        try {
            // 获取当前市场价格
            const ticker = await this.fetchTicker(symbol);
            if (!ticker || !ticker.last) {
                throw new Error('无法获取市场价格');
            }

            // 根据滑点计算价格
            const price = ticker.last;
            const slippagePrice = side === 'buy' 
                ? price * (1 + slippage / 100)  // 买入时接受更高价格
                : price * (1 - slippage / 100); // 卖出时接受更低价格

            // 验证价格和数量
            if (isNaN(slippagePrice) || slippagePrice <= 0) {
                throw new Error('无效的价格');
            }
            if (isNaN(positionSize) || positionSize <= 0) {
                throw new Error('无效的数量');
            }

            //设置持仓模式
            this.exchange.setPositionMode(false, symbol);

            // 计算交易数量
            const quantity = positionSize / slippagePrice;

            // 创建市价单，使用 Bitget 标准参数
            const order = await this.exchange.createOrder(symbol, 'market', side, quantity, slippagePrice, {
                timeInForce: 'IOC',
                tdMode: 'cross',          // 全仓模式
                marginMode: 'cross',      // 全仓保证金模式
                reduceOnly: false,
                holdSide: side,
                hedged: false,
                oneWayMode: true,            
            });

            console.log(`【Bitget】${symbol} ${side} 市价单创建成功:`, order);
            return order;
        } catch (error) {
            console.error(`【Bitget】创建市价单失败:`, error.message);
            throw error;
        }
    }
}

async function example() {
    const bitgetExchange = new BitgetExchange();
    await bitgetExchange.initialize();  
    // const fundingRates = await bitgetExchange.getFundingRates();        
    // console.log(fundingRates);

    const symbol = 'ZORA/USDT:USDT';
    const side = 'buy';
    const amount = 500;
    const slippage = 0.05;
    const order = await bitgetExchange.createMarketOrderWithSlippage(symbol, side, amount, slippage);
    console.log(order);
}

// example();

module.exports = BitgetExchange; 