import { NextResponse } from 'next/server';
import { getAllExchangeApis } from '../../../exchanges/exchangeFactory.js';

export async function POST() {
    try {
        const exchangeApis = getAllExchangeApis();
        const closePromises = [];

        // 获取所有交易所的持仓数据
        for (const [exchangeName, api] of Object.entries(exchangeApis)) {
            try {
                const positions = await api.getPositions();
                // 对每个持仓进行平仓
                for (const position of positions) {
                    if (position.contracts > 0) {
                        closePromises.push(
                            api.closeAllPositions(position.symbol)
                                .catch(error => {
                                    console.error(`关闭 ${exchangeName} 的 ${position.symbol} 仓位失败:`, error);
                                    return error;
                                })
                        );
                    }
                }
            } catch (error) {
                console.error(`获取 ${exchangeName} 持仓数据失败:`, error);
            }
        }

        // 等待所有平仓操作完成
        await Promise.all(closePromises);

        return NextResponse.json({
            success: true,
            message: '所有仓位已平仓'
        });
    } catch (error) {
        console.error('平仓操作失败:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
} 