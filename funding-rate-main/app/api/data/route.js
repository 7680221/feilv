const { NextResponse } = require('next/server');
const BinanceExchange = require('../../exchanges/BinanceExchange');
const HyperliquidExchange = require('../../exchanges/HyperliquidExchange');
const { getAllExchangeNames, fetchFundingRates, extractBaseToken } = require('../../exchanges/exchangeFactory');

// 创建交易所实例
// const binanceApi = new BinanceExchange();
// binanceApi.initialize();

// 缓存数据和上次更新时间
let cachedData = null;
let lastUpdateTime = 0;
const CACHE_DURATION = 60 * 1000; // 缓存1分钟

// 添加默认的套利阈值配置
const ARBITRAGE_THRESHOLD = parseFloat(process.env.ARBITRAGE_THRESHOLD || '0.0005'); // 默认0.05%
const AUTO_EXECUTE = process.env.AUTO_EXECUTE === 'true'; // 是否自动执行套利
const enabledExchanges = (process.env.ENABLED_EXCHANGES || '').split(',').filter(Boolean);

// 存储套利执行结果
let arbitrageResults = [];

async function GET(request) {
  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    
    // 如果有缓存且未过期且不强制刷新，返回缓存数据
    const now = Date.now();
    if (
      cachedData && 
      now - lastUpdateTime < CACHE_DURATION && 
      !forceRefresh
    ) {
      return NextResponse.json(cachedData);
    }
    
    // const binanceTopVolume = await binanceApi.getTop10Futures();
    const { fundingRates, arbitrageOpportunities } = await fetchFundingRates(enabledExchanges);
    
    // 标准化资金费率数据格式
    const normalizedFundingRates = fundingRates.map(rate => {
      try {
        // 如果是 Hyperliquid 格式
        if (rate.info) {
          return {
            baseSymbol: extractBaseToken(rate.symbol) || 'unknown',
            symbol: rate.symbol || 'unknown',
            markPrice: Number(rate.markPrice || rate.info?.markPx || 0),
            indexPrice: Number(rate.indexPrice || rate.info?.oraclePx || 0),
            fundingRate: Number(rate.fundingRate || rate.info?.funding || 0),
            fundingTimestamp: rate.fundingTimestamp || Date.now(),
            fundingDatetime: rate.fundingDatetime || new Date().toISOString(),
            interval: rate.interval || '8h',
            exchange: rate.exchange || 'unknown'
          };
        }
        // 如果是 Gate 格式或其他格式
        return {
          baseSymbol: extractBaseToken(rate.symbol) || 'unknown',
          symbol: rate.symbol || 'unknown',
          markPrice: Number(rate.markPrice || 0),
          indexPrice: Number(rate.indexPrice || 0),
          fundingRate: Number(rate.fundingRate || rate.rate || 0),
          fundingTimestamp: rate.fundingTimestamp || Date.now(),
          fundingDatetime: rate.fundingDatetime || new Date().toISOString(),
          interval: rate.interval || '8h',
          exchange: rate.exchange || 'unknown'
        };
      } catch (err) {
        console.error('处理资金费率数据出错:', err);
        return null;
      }
    }).filter(Boolean); // 过滤掉 null 值
    
    // 构建返回数据
    const data = {
      lastUpdated: now,
      // topVolumeSymbols: Array.isArray(binanceTopVolume) ? binanceTopVolume : [],
      fundingRates: normalizedFundingRates,
      arbitrageOpportunities: (arbitrageOpportunities || []).map(opp => {
        try {
          const shortRate = Number(opp.shortRate || 0);
          const longRate = Number(opp.longRate || 0);
          const rateDiff = Number(opp.rateDifference) || Math.abs(shortRate - longRate);
          
          return {
            ...opp,
            shortRate,
            longRate,
            rateDifference: isFinite(rateDiff) ? rateDiff : 0
          };
        } catch (err) {
          console.error('处理套利机会数据出错:', err);
          return null;
        }
      }).filter(Boolean),
      exchangeNames: getAllExchangeNames(),
      autoExecuteEnabled: Boolean(AUTO_EXECUTE),
      arbitrageThreshold: Number(ARBITRAGE_THRESHOLD),
      arbitrageExecuted: Boolean(arbitrageResults.length),
    };
    
    // 更新缓存
    cachedData = data;
    lastUpdateTime = now;
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('API错误:', error);
    return NextResponse.json(
      { error: '获取数据时发生错误' },
      { status: 500 }
    );
  }
}

module.exports = { GET }; 