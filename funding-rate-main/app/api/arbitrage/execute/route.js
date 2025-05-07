import { NextResponse } from 'next/server';
import { getExchangeApi, getExchangeSymbol } from '../../../exchanges/exchangeFactory.js';

/*
* 执行套利交易
* @param {string} symbol 交易对
* @param {string} longExchange 做多交易所
* @param {string} shortExchange 做空交易所
* @param {number} positionSize 以quoteToken为单位的仓位大小，例如 BTC/USDT 中，USDT 是 quoteToken，BTC 是 baseToken
* @param {number} leverage 杠杆倍数
* @param {number} slippagePercent 滑点百分比
*/  
export async function POST(request) {
  try {
    const { symbol, longExchange, shortExchange, positionSize, leverage, slippagePercent } = await request.json();
    
    // 获取交易所API
    const longExchangeApi = getExchangeApi(longExchange);
    const shortExchangeApi = getExchangeApi(shortExchange);

    // 获取各交易所特定的交易对格式
    const longSymbol = getExchangeSymbol(symbol, longExchange);
    const shortSymbol = getExchangeSymbol(symbol, shortExchange);
    
    // 计算交易数量
    const quantity = positionSize / leverage;
    
    // 执行做多和做空订单
    console.log(`执行套利交易: ${symbol}, 仓位: ${positionSize} USDT, 杠杆: ${leverage}x`);
    
    // 并行执行做多和做空订单
    const [longResult, shortResult] = await Promise.all([
      longExchangeApi.executeLongOrder(longSymbol, positionSize, leverage, slippagePercent),
      shortExchangeApi.executeShortOrder(shortSymbol, positionSize, leverage, slippagePercent)
    ]);
    
    if (longResult && shortResult) {
      console.log(`套利交易执行成功: ${symbol}`);
      return NextResponse.json({
        success: true,
        symbol,
        longExchange,
        shortExchange,
        longSymbol,
        shortSymbol,
        quantity,
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error(`套利交易执行失败: ${symbol}`);
    }
  } catch (error) {
    console.error('执行套利交易出错:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message 
      },
      { status: 500 }
    );
  }
} 