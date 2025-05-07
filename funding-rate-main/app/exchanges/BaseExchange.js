const ccxt = require('ccxt');
const HttpsProxyAgent = require('https-proxy-agent').HttpsProxyAgent;
require('dotenv').config();

class BaseExchange {
    constructor(exchangeId, specificConfig) {
        const baseConfig = {
            enableRateLimit: true,
            timeout: 3000,
        };

        // 从 PROXY_URL 读取代理配置
        const proxyUrl = process.env.PROXY_URL;
        let agent = undefined;

        if (proxyUrl) {
            // console.log(`检测到代理配置: ${proxyUrl}`); // 添加日志方便调试
            try {
                 // 检查 proxyUrl 是否以 http:// 或 https:// 开头，HttpsProxyAgent 需要
                if (proxyUrl.startsWith('http://') || proxyUrl.startsWith('https://')) {
                    agent = new HttpsProxyAgent(proxyUrl);
                } else {
                    console.warn(`代理 URL 格式无效，应以 http:// 或 https:// 开头: ${proxyUrl}`);
                }
            } catch (error) {
                console.error(`创建 HttpsProxyAgent 失败: ${error.message}`);
            }
        } else {
            console.log("未检测到 PROXY_URL 环境变量，不使用代理。");
        }

        // 合并基础配置、特定配置和 agent
        const finalConfig = {
            ...baseConfig,
            ...specificConfig,
        };

        // 只有成功创建 agent 时才添加到配置中
        if (agent) {
            finalConfig.agent = agent;
        }

        this.exchange = new ccxt[exchangeId](finalConfig);
    }

    async initialize() {
        await this.exchange.loadMarkets();
    }

    async getFundingRates(symbols = undefined, params = {}) {
        try {
            // 确保市场已加载
            if (!this.exchange.markets) {
                await this.exchange.loadMarkets();
            }
            
            // 如果未提供 symbols，则使用所有永续合约市场
            if (symbols === undefined) {
                symbols = Object.keys(this.exchange.markets).filter(symbol => {
                    const market = this.exchange.markets[symbol];
                    return market && market.swap === true;
                });
                
                if (symbols.length === 0) {
                    console.log(`没有找到永续合约市场`);
                    return {};
                }
            }
            
            // 首先尝试使用批量获取方法
            try {
                if (typeof this.exchange.fetchFundingRates === 'function') {
                    const response = await this.exchange.fetchFundingRates(symbols, params);
                    console.log(`成功批量获取 ${Object.keys(response).length} 个交易对的资金费率`);
                    return response;
                }
            } catch (batchError) {
                console.warn(`批量获取资金费率失败，将尝试单个获取: ${batchError.message}`);
                // 批量获取失败，会继续执行下面的单个获取逻辑
            }
        } catch (error) {
            console.error(`获取资金费率失败:`, error.message);
            throw error;
        }
    }

    async createOrder(symbol, type, side, amount, price = undefined) {
        try {
            return await this.exchange.createOrder(symbol, type, side, amount, price);
        } catch (error) {
            console.error(`创建订单失败:`, error.message);
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
            const ticker = await this.exchange.fetchTicker(symbol);
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

     /**
     * 为交易对设置杠杆和持仓模式
     * @param {string} symbol 交易对
     * @param {number} leverage 杠杆倍数
     */
     async setupLeverageAndPosition(symbol, leverage = 1) {
        try {
            // 设置杠杆
            await this.exchange.setLeverage(leverage, symbol, {
                marginMode: 'cross',  // 使用全仓模式
                crossLeverageLimit: leverage
            });
            console.log(`设置杠杆成功: ${symbol} ${leverage}x`);

            // 设置持仓模式为单向持仓
            // await this.exchange.setPositionMode(false, symbol);
            // console.log(`设置单向持仓模式成功: ${symbol}`);

        } catch (error) {
            // 如果是 NO_CHANGE 错误，我们认为设置是成功的
            if (error.message.includes('NO_CHANGE')) {
                console.log('杠杆和持仓模式已经是正确的设置');
                return;
            }
            console.error(`设置杠杆和持仓模式失败: ${error.message}`);
            throw error;
        }
    }

    /**
     * 创建市价单（带滑点保护）
     * @param {string} symbol 交易对
     * @param {string} side 交易方向
     * @param {number} positionSize 以quoteToken为单位的仓位大小，例如 BTC/USDT 中，USDT 是 quoteToken，BTC 是 baseToken
     * @param {number} leverage 杠杆倍数
     * @param {number} slippagePercent 滑点百分比
     */
    async createMarketOrderWithSlippage(symbol, side, positionSize, leverage = 1, slippagePercent = 0.001) {
        console.log(`创建市价单: ${symbol}, ${side}, ${positionSize}, ${leverage}, ${slippagePercent}`);
        try {
            // 先设置杠杆和持仓模式
            await this.setupLeverageAndPosition(symbol, leverage);

            const slippagePrice = await this.calculateSlippagePrice(symbol, side, slippagePercent);
            const amount = positionSize / slippagePrice;
            
            console.log(`滑点价格: ${slippagePrice}`);
            
            return await this.exchange.createOrder(
                symbol,
                'market',
                side,
                amount,
                slippagePrice,  // 提供滑点价格
                {
                    timeInForce: 'IOC',
                    type: 'market',
                    marginMode: 'cross',
                    reduceOnly: false
                }
            );
        } catch (error) {
            console.error(`创建市价单失败: ${error.message}`);
            throw error;
        }
    }


    async executeLongOrder(symbol, positionSize, leverage=1, slippagePercent=0.001) {
        try {
            const order = await this.createMarketOrderWithSlippage(symbol, 'buy', positionSize, leverage, slippagePercent);
            console.log(`已开仓: ${symbol} 买入 ${positionSize} USDT`);
            return order;
        } catch (error) {
            console.error(`开仓失败: ${error.message}`);
            throw error;
        }
    }

    async executeShortOrder(symbol, positionSize, leverage=1, slippagePercent=0.001) {
        try {
            const order = await this.createMarketOrderWithSlippage(symbol, 'sell', positionSize, leverage, slippagePercent);
            console.log(`已开仓: ${symbol} 卖出 ${positionSize} USDT`);
            return order;
        } catch (error) {
            console.error(`开仓失败: ${error.message}`);
            throw error;
        }
    }

    async openPosition(symbol, side, positionSize, leverage=1, slippagePercent=0.001) {
        try {
            const order = await this.createMarketOrderWithSlippage(symbol, side, positionSize, leverage, slippagePercent);
            console.log(`已开仓: ${symbol} ${side} ${positionSize}`);
            return order;
        } catch (error) {
            console.error(`开仓失败: ${error.message}`);
            throw error;
        }
    }

    //获取所有持仓合约
    async getPositions() {
        return await this.exchange.fetchPositions();
    }

    async closeAllPositions(symbol) {
        try {
            // 平掉所有持仓
            const positions = await this.exchange.fetchPositions([symbol]);
            for (const pos of positions) {
                if (pos.contracts > 0) {
                    const side = (pos.side === 'long') ? 'sell' : 'buy';
                    const slippagePrice = await this.calculateSlippagePrice(symbol, side);
                    await this.exchange.createOrder(
                        symbol,
                        'market',
                        side,
                        pos.contracts,
                        slippagePrice,
                        { reduceOnly: true }
                    );
                    console.log(`已平仓: ${pos.side} ${pos.contracts}`);
                }
            }
        } catch (e) {
            console.error('操作失败:', e.message);
        }
    }
    

    async fetchBalance() {
        try {
            return await this.exchange.fetchBalance();
        } catch (error) {
            console.error(`获取账户余额失败:`, error.message);
            throw error;
        }
    }

    async fetchTicker(symbol) {
        try {
            return await this.exchange.fetchTicker(symbol);
        } catch (error) {
            console.error(`获取行情数据失败:`, error.message);
            throw error;
        }
    }

    async fetchOrderBook(symbol, limit = undefined) {
        try {
            return await this.exchange.fetchOrderBook(symbol, limit);
        } catch (error) {
            console.error(`获取订单簿失败:`, error.message);
            throw error;
        }
    }
}

module.exports = BaseExchange; 