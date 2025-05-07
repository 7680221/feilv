const BaseExchange = require('./BaseExchange');

class GateExchange extends BaseExchange {
    constructor() {
        const specificConfig = {
            apiKey: process.env.GATE_API_KEY,
            secret: process.env.GATE_API_SECRET,
            options: {
                defaultType: 'swap',  // 设置默认为永续合约
                defaultContractType: 'perpetual',
            },
        };
        super('gate', specificConfig);
    }

    async initialize() {
        await super.initialize();
        console.log('Gate.io 交易所初始化完成');
    }

    /**
     * 获取合约详细信息
     * @param {string} symbol 交易对
     * @returns {Promise<Object>} 合约详情
     */
    async getContractInfo(symbol) {
        try {
            // 确保市场已加载
            if (!this.exchange.markets) {
                await this.exchange.loadMarkets();
            }

            const market = this.exchange.market(symbol);
            if (!market) {
                throw new Error(`未找到交易对 ${symbol} 的市场信息`);
            }

            // 从市场信息中获取合约信息
            const contractSize = market.contractSize || 1;
            const minAmount = market.limits.amount.min || 1;
            const tickSize = market.precision.price || 0.0001;

            console.log(`合约信息:
                - 交易对: ${symbol}
                - 合约大小: ${contractSize}
                - 最小数量: ${minAmount}
                - 价格精度: ${tickSize}
                - 市场ID: ${market.id}
            `);

            return {
                contractSize,
                minAmount,
                tickSize,
                quanto_multiplier: market.quanto || 1,
                marketId: market.id
            };
        } catch (error) {
            console.error(`获取合约信息失败: ${error.message}`);
            throw error;
        }
    }

    /**
     * 创建市价单（带滑点保护）
     * @param {string} symbol 交易对
     * @param {string} side 交易方向
     * @param {number} positionSize  以quoteToken为单位的仓位大小，例如 BTC/USDT 中，USDT 是 quoteToken，BTC 是 baseToken
     * @param {number} leverage 杠杆倍数
     * @param {number} slippagePercent 滑点百分比
     */
    async createMarketOrderWithSlippage(symbol, side, positionSize, leverage = 1, slippagePercent = 0.05) {
        try {
            // 获取合约信息
            const contractInfo = await this.getContractInfo(symbol);
            const market = this.exchange.market(symbol);
            
            // 获取最新价格
            const ticker = await this.exchange.fetchTicker(symbol);
            const currentPrice = ticker.last;
            
            // 计算合约数量
            // Gate.io 的合约面值通常是 1 USD
            const contracts = Math.floor(positionSize / currentPrice / market.contractSize);

            console.log(`
                交易详情:
                - 交易对: ${symbol}
                - 方向: ${side}
                - USDT金额: ${positionSize}
                - 当前价格: ${currentPrice}
                - 合约张数: ${contracts}
                - 最小数量: ${contractInfo.minAmount}
            `);

            if (contracts < contractInfo.minAmount) {
                throw new Error(`计算出的合约张数 ${contracts} 小于最小交易数量 ${contractInfo.minAmount}`);
            }

            // 设置杠杆
            await this.setupLeverageAndPosition(symbol, leverage);

            // 创建订单
            return await this.exchange.createOrder(
                symbol,
                'market',
                side,
                contracts, // 使用计算出的合约张数
                undefined, // 市价单不需要价格
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

    /**
     * 平仓指定交易对的所有仓位
     */
    async closeAllPositions(symbol) {
        try {
            const positions = await this.exchange.fetchPositions([symbol]);
            for (const pos of positions) {
                if (pos.contracts > 0) {
                    const side = (pos.side === 'long') ? 'sell' : 'buy';
                    await this.exchange.createOrder(
                        symbol,
                        'market',
                        side,
                        pos.contracts,
                        undefined,
                        { 
                            reduceOnly: true,
                            timeInForce: 'IOC',
                            type: 'market',
                            marginMode: 'cross'
                        }
                    );
                    console.log(`已平仓: ${symbol} ${pos.side} ${pos.contracts} 张合约`);
                }
            }
        } catch (error) {
            console.error(`平仓失败: ${error.message}`);
            throw error;
        }
    }
}

async function example() {
    const gateExchange = new GateExchange();
    const symbol = 'ZORA/USDT:USDT';  
    const side = 'buy';
    const positionSize = 10;
    const leverage = 1;
    const slippagePercent = 0.001;

    const price = await gateExchange.fetchTicker(symbol);
    console.log(price);
    const slippagePrice = await gateExchange.calculateSlippagePrice(symbol, side, slippagePercent);
    console.log(slippagePrice);
    // console.log(await hyperliquidExchange.createMarketOrderWithSlippage('BADGER/USDC:USDC', 'sell', 10, 0.01));

    const contractInfo = await gateExchange.getContractInfo(symbol);
    console.log(contractInfo);

    const order = await gateExchange.executeLongOrder(symbol, positionSize, leverage, slippagePercent);
    console.log(order);
    // const order = await gateExchange.createMarketOrderWithSlippage(symbol, side, amount, slippagePercent);
}

// example();

module.exports = GateExchange; 