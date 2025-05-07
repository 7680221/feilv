"use client";

import { useState, useEffect } from 'react';

export default function OpenPositions() {
    const [positions, setPositions] = useState({
        long: [],
        short: []
    });
    const [isLoading, setIsLoading] = useState(true);
    const [closingSymbols, setClosingSymbols] = useState(new Set());

    // 获取开放仓位数据
    const fetchOpenPositions = async () => {
        try {
            const response = await fetch('/api/positions');
            const data = await response.json();
            if (data.success) {
                // 先过滤掉数量为0的仓位
                const validPositions = data.positions.filter(pos => pos.contracts > 0);
                
                // 将有效仓位按交易对分组
                const positionsBySymbol = validPositions.reduce((acc, pos) => {
                    const baseSymbol = pos.symbol.split('/')[0]; // 获取基础货币符号，如 ZORA
                    if (!acc[baseSymbol]) {
                        acc[baseSymbol] = [];
                    }
                    acc[baseSymbol].push(pos);
                    return acc;
                }, {});

                // 转换为组件状态格式
                const groupedPositions = Object.entries(positionsBySymbol).map(([baseSymbol, positions]) => {
                    const longPos = positions.find(p => p.side === 'long');
                    const shortPos = positions.find(p => p.side === 'short');
                    return {
                        baseSymbol,
                        long: longPos || null,
                        short: shortPos || null,
                        hasHedge: !!(longPos && shortPos)
                    };
                });

                setPositions(groupedPositions);
            } else {
                console.error('获取持仓数据失败:', data.error);
            }
        } catch (error) {
            console.error('获取持仓数据出错:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // 平仓指定交易对的对冲仓位
    const closeHedgedPositions = async (baseSymbol) => {
        if (!confirm(`确定要平掉 ${baseSymbol} 的对冲仓位吗？`)) return;
        
        setClosingSymbols(prev => new Set([...prev, baseSymbol]));
        try {
            // 分别获取多空仓位的完整交易对格式
            const longSymbol = positions.find(p => p.baseSymbol === baseSymbol)?.long?.symbol;
            const shortSymbol = positions.find(p => p.baseSymbol === baseSymbol)?.short?.symbol;

            const response = await fetch('/api/positions/close-hedged', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    baseSymbol,
                    longSymbol,
                    shortSymbol
                })
            });
            const data = await response.json();
            if (data.success) {
                alert(`${baseSymbol} 的对冲仓位已成功平仓`);
                fetchOpenPositions(); // 刷新仓位数据
            } else {
                alert(`平仓失败: ${data.error}`);
            }
        } catch (error) {
            alert(`平仓操作失败: ${error.message}`);
        } finally {
            setClosingSymbols(prev => {
                const next = new Set(prev);
                next.delete(baseSymbol);
                return next;
            });
        }
    };

    // 定期更新开放仓位数据
    useEffect(() => {
        fetchOpenPositions();
        const interval = setInterval(fetchOpenPositions, 30000); // 每30秒更新一次
        return () => clearInterval(interval);
    }, []);

    const PositionTable = () => (
        <div className="w-full">
            <h4 className="text-lg font-semibold mb-2">当前持仓</h4>
            {positions.length > 0 ? (
                <table className="min-w-full bg-white border border-gray-200">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="py-2 px-3 border-b">基础货币</th>
                            <th className="py-2 px-3 border-b">多仓交易所</th>
                            <th className="py-2 px-3 border-b">多仓数量</th>
                            <th className="py-2 px-3 border-b">多仓开仓价</th>
                            <th className="py-2 px-3 border-b">多仓未实现盈亏</th>
                            <th className="py-2 px-3 border-b">空仓交易所</th>
                            <th className="py-2 px-3 border-b">空仓数量</th>
                            <th className="py-2 px-3 border-b">空仓开仓价</th>
                            <th className="py-2 px-3 border-b">空仓未实现盈亏</th>
                            <th className="py-2 px-3 border-b">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {positions.map((position, index) => (
                            <tr key={position.baseSymbol} 
                                className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-gray-50' : ''}`}>
                                <td className="py-2 px-3 border-b font-medium">{position.baseSymbol}</td>
                                
                                {/* 多仓信息 */}
                                <td className="py-2 px-3 border-b">{position.long?.exchange || '-'}</td>
                                <td className="py-2 px-3 border-b">{position.long?.contracts || '-'}</td>
                                <td className="py-2 px-3 border-b">{position.long?.entryPrice?.toFixed(4) || '-'}</td>
                                <td className={`py-2 px-3 border-b font-semibold ${
                                    position.long?.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                    {position.long?.unrealizedPnl?.toFixed(4) || '-'} USDT
                                </td>
                                
                                {/* 空仓信息 */}
                                <td className="py-2 px-3 border-b">{position.short?.exchange || '-'}</td>
                                <td className="py-2 px-3 border-b">{position.short?.contracts || '-'}</td>
                                <td className="py-2 px-3 border-b">{position.short?.entryPrice?.toFixed(4) || '-'}</td>
                                <td className={`py-2 px-3 border-b font-semibold ${
                                    position.short?.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                    {position.short?.unrealizedPnl?.toFixed(4) || '-'} USDT
                                </td>
                                
                                {/* 操作按钮 */}
                                <td className="py-2 px-3 border-b">
                                    {position.hasHedge && (
                                        <button
                                            onClick={() => closeHedgedPositions(position.baseSymbol)}
                                            disabled={closingSymbols.has(position.baseSymbol)}
                                            className={`px-3 py-1 rounded text-sm font-medium ${
                                                closingSymbols.has(position.baseSymbol)
                                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                    : 'bg-red-500 hover:bg-red-600 text-white'
                                            }`}
                                        >
                                            {closingSymbols.has(position.baseSymbol) ? '平仓中...' : '平仓对冲'}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    暂无持仓
                </div>
            )}
        </div>
    );

    return (
        <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">当前开放仓位</h3>
            </div>

            {isLoading ? (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    加载中...
                </div>
            ) : (
                <div className="flex gap-4 flex-wrap">
                    <PositionTable />
                </div>
            )}
        </div>
    );
} 