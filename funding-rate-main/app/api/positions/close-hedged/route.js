import { NextResponse } from 'next/server';
import { getAllExchangeApis, getExchangeSymbol } from '../../../exchanges/exchangeFactory.js';

export async function POST(request) {
    try {
        const { baseSymbol, longSymbol, shortSymbol } = await request.json();
        if (!baseSymbol || !longSymbol || !shortSymbol) {
            throw new Error('缺少必要的交易对参数');
        }

        const exchangeApis = getAllExchangeApis();
        const closePromises = [];

        // 获取所有交易所的持仓数据
        for (const [exchangeName, api] of Object.entries(exchangeApis)) {
            try {
                const positions = await api.getPositions();
                // 根据交易所使用对应的交易对格式
                // const symbolToUse = exchangeName === 'gate' ? longSymbol : shortSymbol;
                const symbolToUse = getExchangeSymbol(baseSymbol, exchangeName);
                
                // 只处理指定交易对的持仓
                const symbolPositions = positions.filter(pos => pos.symbol === symbolToUse);
                
                if (symbolPositions.length > 0) {
                    console.log(`【${exchangeName}】开始平仓 ${symbolToUse}`);
                    closePromises.push(
                        api.closeAllPositions(symbolToUse)
                            .catch(error => {
                                console.error(`关闭 ${exchangeName} 的 ${symbolToUse} 仓位失败:`, error);
                                throw error; // 重新抛出错误以便上层捕获
                            })
                    );
                }
            } catch (error) {
                console.error(`获取 ${exchangeName} 持仓数据失败:`, error);
                throw error; // 重新抛出错误以便上层捕获
            }
        }

        // 等待所有平仓操作完成
        await Promise.all(closePromises);

        return NextResponse.json({
            success: true,
            message: `${baseSymbol} 的对冲仓位已平仓`
        });
    } catch (error) {
        console.error('平仓操作失败:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
} 