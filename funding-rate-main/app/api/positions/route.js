import { NextResponse } from 'next/server';
import { getAllExchangeApis } from '../../exchanges/exchangeFactory.js';

export async function GET() {
  try {
    // 获取所有启用的交易所API
    const exchangeApis = getAllExchangeApis();
    
    // 并行获取所有交易所的持仓数据
    const positionsPromises = Object.entries(exchangeApis).map(async ([exchangeName, api]) => {
      try {
        const positions = await api.getPositions();
        return positions.map(position => ({
          ...position,
          exchange: exchangeName
        }));
      } catch (error) {
        console.error(`获取 ${exchangeName} 持仓数据失败:`, error);
        return [];
      }
    });
    
    const allPositionsArrays = await Promise.all(positionsPromises);
    const allPositions = allPositionsArrays.flat();
    
    return NextResponse.json({
      success: true,
      positions: allPositions
    });
  } catch (error) {
    console.error('获取持仓数据失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 