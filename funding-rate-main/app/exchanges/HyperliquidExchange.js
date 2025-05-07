const BaseExchange = require('./BaseExchange');

class HyperliquidExchange extends BaseExchange {
    constructor() {
        const specificConfig = {
            walletAddress: process.env.HYPERLIQUID_WALLET_ADDRESS,
            privateKey: process.env.HYPERLIQUID_PRIVATE_KEY,
            options: {
                defaultType: 'swap',  // 设置默认为永续合约
                defaultContractType: 'perpetual',
                'defaultSlippage': 0.01  // 默认滑点 5%
            }
        };

        super('hyperliquid', specificConfig);
    }

    async fetchBalance(params = {}) {
        try {
            // 检查是否有钱包地址配置
            const walletAddress = process.env.HYPERLIQUID_WALLET_ADDRESS;
            
            // 如果没有在 params 中提供 user 参数，且有钱包地址环境变量，则添加到 params 中
            if (!params.user && walletAddress) {
                params.user = walletAddress;
                console.log(`【Hyperliquid】使用配置的钱包地址: ${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`);
            } else if (!params.user) {
                throw new Error('【Hyperliquid】获取余额需要在 params 中提供 user 参数或设置 HYPERLIQUID_WALLET_ADDRESS 环境变量');
            }

            // 设置默认类型为永续合约(swap)，除非另有指定
            if (!params.type) {
                params.type = 'swap';
            }

            console.log(`【Hyperliquid】获取类型为 ${params.type} 的余额...`);
            const balance = await this.exchange.fetchBalance(params);
            console.log(`【Hyperliquid】成功获取余额 ${JSON.stringify(balance)}`);
            
            return balance;
        } catch (error) {
            console.error(`【Hyperliquid】获取余额失败:`, error.message);
            throw error;
        }
    }

    /**
    * 获取基于当前市场价格和滑点的最大/最小成交价格
    * @param {string} symbol 交易对
    * @param {string} side 交易方向 'buy' 或 'sell'
    * @param {number} slippagePercent 滑点百分比
    * @returns {Promise<number>} 计算后的价格
    */
    async calculateSlippagePrice(symbol, side, slippagePercent = 0.001) {
        try {
            const ticker = await this.fetchTicker(symbol);
            const currentPrice = ticker.last;
            
            // 买单：价格可以比当前价格高 slippage%
            // 卖单：价格可以比当前价格低 slippage%
            const multiplier = side === 'buy' ? (1 + slippagePercent) : (1 - slippagePercent);
            return currentPrice * multiplier;
        } catch (error) {
            console.error(`计算滑点价格失败: ${error.message}`);
            throw error;
        }
    }

    async fetchTicker(symbol) {
        try {
            // 确保市场已加载
            if (!this.exchange.markets) {
                await this.exchange.loadMarkets();
            }

            // 添加合约市场参数
            const params = {
                'type': 'swap',
                'contract': true
            };

            console.log(`【Hyperliquid】获取 ${symbol} 的行情数据...`);
            const rawTicker = await this.exchange.fetchTicker(symbol, params);

            // 从 info 对象中提取价格数据
            const ticker = {
                symbol: rawTicker.symbol,
                timestamp: Date.now(),
                datetime: new Date().toISOString(),
                high: undefined,
                low: undefined,
                bid: Number(rawTicker.info.midPx) || Number(rawTicker.info.markPx),
                ask: Number(rawTicker.info.midPx) || Number(rawTicker.info.markPx),
                last: Number(rawTicker.info.markPx),
                close: Number(rawTicker.info.markPx),
                previousClose: Number(rawTicker.info.prevDayPx),
                change: undefined,
                percentage: undefined,
                average: undefined,
                baseVolume: Number(rawTicker.info.dayBaseVlm),
                quoteVolume: Number(rawTicker.info.dayNtlVlm),
                info: rawTicker.info,
                openInterest: Number(rawTicker.info.openInterest),
                markPrice: Number(rawTicker.info.markPx),
                indexPrice: Number(rawTicker.info.oraclePx),
                fundingRate: Number(rawTicker.info.funding),
                maxLeverage: Number(rawTicker.info.maxLeverage)
            };

            console.log(`【Hyperliquid】成功获取行情数据:`, {
                symbol: ticker.symbol,
                markPrice: ticker.markPrice,
                indexPrice: ticker.indexPrice,
                fundingRate: ticker.fundingRate,
                timestamp: ticker.datetime
            });

            return ticker;
        } catch (error) {
            console.error(`【Hyperliquid】获取行情数据失败:`, error.message);
            throw error;
        }
    }
}

    

async function example() {
    const hyperliquidExchange = new HyperliquidExchange();
    const symbol = 'ZORA/USDC:USDC';  
    const side = 'sell';
    const positionSize = 10;
    const leverage = 1;
    const slippagePercent = 0.01;
    // const price = await hyperliquidExchange.fetchTicker(symbol);
    // console.log(price);
    // const slippagePrice = await hyperliquidExchange.calculateSlippagePrice(symbol, side, slippagePercent);
    // console.log(slippagePrice);
    // const order = await hyperliquidExchange.executeShortOrder(symbol, positionSize, leverage, slippagePercent);
    // console.log(order);
    await hyperliquidExchange.closeAllPositions(symbol);
}

// example();

module.exports = HyperliquidExchange; 