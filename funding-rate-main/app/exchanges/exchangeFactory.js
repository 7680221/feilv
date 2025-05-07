// 导入交易所
import BinanceExchange from './BinanceExchange.js';  
import HyperliquidExchange from './HyperliquidExchange.js';
import GateExchange from './GateExchange.js';
import BitgetExchange from './BitgetExchange.js';
import { calculateArbitrageOpportunities } from './arbitrage.js';

// 从环境变量获取启用的交易所列表
const defaultExchanges = ['hyperliquid', 'gate', 'bitget'];
export const EXCHANGE_NAMES = (process.env.ENABLED_EXCHANGES || '')
    .split(',')
    .filter(Boolean)
    .map(name => name.toLowerCase().trim()) || defaultExchanges;

console.log('已启用的交易所:', EXCHANGE_NAMES);

const binanceApi = new BinanceExchange();
binanceApi.initialize();

const hyperLiquidApi = new HyperliquidExchange();
hyperLiquidApi.initialize();

const gateApi = new GateExchange();
gateApi.initialize();

const bitgetApi = new BitgetExchange();
bitgetApi.initialize();

// 缓存交易所实例
const exchanges = {};

/**
 * 获取交易所API
 * @param {string} name 交易所名称
 * @returns {object} 交易所API对象
 */
export function getExchangeApi(name) {
  if (!exchanges[name]) {
    switch (name) {
      // case 'binance':
      //   exchanges[name] = binanceApi;
      //   break;
      case 'hyperliquid':
        exchanges[name] = hyperLiquidApi;
        break;
      case 'gate':
        exchanges[name] = gateApi;
        break;
      case 'bitget':
        exchanges[name] = bitgetApi;
        break;
      default:
        throw new Error(`不支持的交易所: ${name}`);
    }
  }
  
  return exchanges[name];
}

/**
 * 获取所有交易所API
 * @returns {object} 交易所API对象集合
 */
export function getAllExchangeApis() {
  return EXCHANGE_NAMES.reduce((apis, name) => {
    apis[name] = getExchangeApi(name);
    return apis;
  }, {});
}

/**
 * 获取所有交易所名称
 * @returns {string[]} 交易所名称数组
 */
export function getAllExchangeNames() {
  return EXCHANGE_NAMES;
}

/**
 * 标准化交易对格式
 * @param {string} symbol 原始交易对名称
 * @returns {string} 标准化后的交易对名称
 */
function normalizeSymbol(symbol) {
  // 移除 :USDT 或 :USDC 后缀
  let normalized = symbol.split(':')[0];
  
  // 如果是 USDT 计价，转换为 USDC 计价格式
  if (normalized.endsWith('/USDT')) {
    normalized = normalized.replace('/USDT', '/USDC');
  }
  
  return normalized;
}

/**
 * 从完整交易对中提取基础代币名称（用于UI显示）
 * @param {string} symbol 完整交易对名称
 * @returns {string} 基础代币名称
 */
function extractBaseToken(symbol) {
  // 移除 :USDT 或 :USDC 后缀
  const withoutSuffix = symbol.split(':')[0];
  // 获取交易对中的基础代币
  return withoutSuffix.split('/')[0];
}

/**
 * 将基础代币转换为特定交易所的合约交易对格式
 * @param {string} baseToken 基础代币名称
 * @param {string} exchange 交易所名称
 * @returns {string} 交易所特定格式的交易对
 */
function getExchangeSymbol(baseToken, exchange) {
  switch (exchange.toLowerCase()) {
    case 'gate':
      return `${baseToken}/USDT:USDT`;
    case 'hyperliquid':
      return `${baseToken}/USDC:USDC`;
    case 'bitget':
      return `${baseToken}/USDT:USDT`;
    default:
      throw new Error(`不支持的交易所: ${exchange}`);
  }
}

// 资金费率查询函数
export async function fetchFundingRates(enabledExchanges) {
    try {
      // 调用各交易所API获取资金费率
      const ratePromises = enabledExchanges.map(exchange => {
        switch(exchange) {
          // case 'binance':
          //   return binanceApi.getFundingRates();
          case 'hyperliquid':
            return hyperLiquidApi.getFundingRates();
          case 'gate':
            return gateApi.getFundingRates();
          case 'bitget':
            return bitgetApi.getFundingRates();
          default:
            return Promise.resolve([]);
        }
      });
  
      // 并行获取所有交易所的费率数据
      const ratesResults = await Promise.allSettled(ratePromises);
      
      // 合并所有交易所的数据并标准化格式
      const allRates = ratesResults.reduce((allRates, result, index) => {
        if (result.status === 'fulfilled') {
          const exchangeName = enabledExchanges[index];
          
          // 标准化数据格式
          const normalizedRates = Object.values(result.value).map(rate => {
            const baseToken = extractBaseToken(rate.symbol);
            
            // 基本数据结构
            const normalizedRate = {
              baseToken,  // 用于UI显示的基础代币名称
              symbol: rate.symbol,  // 保留原始交易对用于API调用
              exchange: exchangeName,
              markPrice: rate.markPrice || rate.info?.markPx || 0,
              indexPrice: rate.indexPrice || rate.info?.oraclePx || 0,
              fundingRate: rate.fundingRate || rate.rate || rate.info?.funding || 0,
              fundingTimestamp: rate.fundingTimestamp || Date.now(),
              fundingDatetime: rate.fundingDatetime || new Date().toISOString(),
              interval: rate.interval || '8h'
            };
            
            return normalizedRate;
          });
          
          return [...allRates, ...normalizedRates];
        } else {
          console.log('error', `获取 ${enabledExchanges[index]} 资金费率失败: ${result.reason?.message || '未知错误'}`);
          return allRates;
        }
      }, []);

      // 按基础代币分组计算套利机会
      const arbitrageOpportunities = calculateArbitrageOpportunities(
        allRates.map(rate => ({
          ...rate,
          symbol: rate.baseToken // 使用基础代币进行套利机会计算
        }))
      );
      
      return {
        fundingRates: allRates,
        arbitrageOpportunities,
        lastUpdated: new Date().toISOString(),
        exchangeNames: enabledExchanges
      };
    } catch (error) {
      console.log('error', `获取资金费率数据失败: ${error.message}`);
      throw error;
    }
}

export { extractBaseToken, getExchangeSymbol };