"use client";

import { useState, useEffect } from 'react';
import OpenPositions from './OpenPositions';

export default function AutoTradeConfig({ arbitrageData }) {
  const [positions, setPositions] = useState({});
  const [openPositions, setOpenPositions] = useState([]);
  const [totalProfit, setTotalProfit] = useState(0);
  const [threshold, setThreshold] = useState(0.0005); // 默认阈值为0.05%
  const [filteredArbitrageData, setFilteredArbitrageData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 获取开放仓位数据
  const fetchOpenPositions = async () => {
    try {
      const response = await fetch('/api/positions');
      const data = await response.json();
      if (data.success) {
        setOpenPositions(data.positions);
      } else {
        console.error('获取持仓数据失败:', data.error);
      }
    } catch (error) {
      console.error('获取持仓数据出错:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 定期更新开放仓位数据
  useEffect(() => {
    fetchOpenPositions();
    const interval = setInterval(fetchOpenPositions, 30000); // 每30秒更新一次
    return () => clearInterval(interval);
  }, []);

  // 根据阈值筛选套利机会
  useEffect(() => {
    if (!arbitrageData || arbitrageData.length === 0) {
      setFilteredArbitrageData([]);
      return;
    }
    
    const filtered = arbitrageData.filter(item => {
      const rateDiff = item.rateDifference || Math.abs(item.shortRate - item.longRate);
      return rateDiff >= threshold;
    });
    
    setFilteredArbitrageData(filtered);
  }, [arbitrageData, threshold]);

  // 初始化或更新仓位配置
  useEffect(() => {
    if (!filteredArbitrageData || filteredArbitrageData.length === 0) return;
    
    // 为每个套利对创建默认仓位设置
    const initialPositions = filteredArbitrageData.reduce((acc, item) => {
      if (!acc[item.symbol]) {
        acc[item.symbol] = {
          positionSize: 100, // 默认100 USDT
          leverage: 5, // 默认5倍杠杆
          active: false, // 默认不激活
          longExchange: item.longExchange,
          shortExchange: item.shortExchange,
          estimatedProfit: calculateProfit(item.rateDifference || Math.abs(item.shortRate - item.longRate), 100, 5),
          executed: false // 是否已执行
        };
      }
      return acc;
    }, {});
    
    setPositions(prev => ({ ...prev, ...initialPositions }));
  }, [filteredArbitrageData]);

  // 处理阈值变化
  const handleThresholdChange = (e) => {
    const value = parseFloat(e.target.value) / 100; // 转换百分比为小数
    if (isNaN(value) || value < 0) return;
    setThreshold(value);
  };

  // 计算估计利润
  function calculateProfit(rateDiff, positionSize, leverage) {
    // 假设费率差是24小时收益率，我们计算每8小时的收益
    const hourlyProfit = (rateDiff * positionSize * leverage) / 3;
    return hourlyProfit;
  }

  // 更新仓位大小
  const handlePositionSizeChange = (symbol, value) => {
    const size = parseFloat(value);
    if (isNaN(size) || size <= 0) return;
    
    setPositions(prev => {
      const item = filteredArbitrageData.find(a => a.symbol === symbol);
      const rateDiff = item ? (item.rateDifference || Math.abs(item.shortRate - item.longRate)) : 0;
      return {
        ...prev,
        [symbol]: {
          ...prev[symbol],
          positionSize: size,
          estimatedProfit: calculateProfit(rateDiff, size, prev[symbol].leverage)
        }
      };
    });
  };

  // 更新杠杆
  const handleLeverageChange = (symbol, value) => {
    const leverage = parseFloat(value);
    if (isNaN(leverage) || leverage <= 0) return;
    
    setPositions(prev => {
      const item = filteredArbitrageData.find(a => a.symbol === symbol);
      const rateDiff = item ? (item.rateDifference || Math.abs(item.shortRate - item.longRate)) : 0;
      return {
        ...prev,
        [symbol]: {
          ...prev[symbol],
          leverage,
          estimatedProfit: calculateProfit(rateDiff, prev[symbol].positionSize, leverage)
        }
      };
    });
  };

  // 切换激活状态
  const handleActiveToggle = (symbol) => {
    setPositions(prev => ({
      ...prev,
      [symbol]: {
        ...prev[symbol],
        active: !prev[symbol].active
      }
    }));
  };

  // 执行套利交易
  const executeArbitrage = async (symbol, positions) => {
    try {
      const position = positions[symbol];
      if (!position || !position.active) return;
      
      // 调用后端 API 执行交易
      const response = await fetch('/api/arbitrage/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol,
          longExchange: position.longExchange,
          shortExchange: position.shortExchange,
          positionSize: parseFloat(position.positionSize),
          leverage: parseFloat(position.leverage)
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 更新状态为已执行
        setPositions(prev => ({
          ...prev,
          [symbol]: {
            ...prev[symbol],
            executed: true,
            executedTime: new Date().toISOString()
          }
        }));
        
        // 更新总利润
        setTotalProfit(prev => prev + position.estimatedProfit);
        
        alert(`已成功执行 ${symbol} 的套利交易!`);
      } else {
        throw new Error(result.error || '执行套利交易失败');
      }
    } catch (error) {
      console.error('执行套利交易出错:', error);
      alert(`执行 ${symbol} 的套利交易失败: ${error.message}`);
    }
  };

  // 格式化日期时间
  const formatDateTime = (timestamp) => {
    if (!timestamp) return '未知';
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  // 计算当前总预估利润
  useEffect(() => {
    let total = 0;
    Object.values(positions).forEach(position => {
      if (position.active) {
        total += position.estimatedProfit;
      }
    });
    setTotalProfit(total);
  }, [positions]);

  if (!arbitrageData || arbitrageData.length === 0) {
    return <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">暂无可用的套利数据</div>;
  }

  return (
    <div className="mt-6">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-bold">自动交易配置</h2>
        <div className="text-green-600 font-semibold">
          预估8小时收益: {totalProfit.toFixed(4)} USDT
        </div>
      </div>
      
      {/* 阈值配置 */}
      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between flex-wrap">
          <div className="flex items-center mb-2 md:mb-0">
            <span className="mr-2 font-medium">资金费率差阈值:</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className="w-20 px-2 py-1 border rounded"
              value={(threshold * 100).toFixed(2)}
              onChange={handleThresholdChange}
            />
            <span className="ml-1">%</span>
          </div>
          <div className="text-sm text-gray-600">
            当前显示费率差 ≥ {(threshold * 100).toFixed(2)}% 的套利机会，共 {filteredArbitrageData.length} 个
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          提示: 设置较高的阈值可以筛选出收益更高的套利机会，但可能减少可选择的交易对数量
        </div>
      </div>
      
      <div className="overflow-x-auto">
        {filteredArbitrageData.length === 0 ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            没有满足阈值要求的套利机会，请尝试降低阈值
          </div>
        ) : (
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-4 border-b">交易对</th>
                <th className="py-2 px-4 border-b">做多交易所</th>
                <th className="py-2 px-4 border-b">做空交易所</th>
                <th className="py-2 px-4 border-b">费率差</th>
                <th className="py-2 px-4 border-b">标记价格</th>
                <th className="py-2 px-4 border-b">指数价格</th>
                <th className="py-2 px-4 border-b">下次结算时间</th>
                <th className="py-2 px-4 border-b">仓位大小(USDT)</th>
                <th className="py-2 px-4 border-b">杠杆倍数</th>
                <th className="py-2 px-4 border-b">预估收益(8h)</th>
                <th className="py-2 px-4 border-b">状态</th>
                <th className="py-2 px-4 border-b">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredArbitrageData.map((item, index) => {
                const position = positions[item.symbol] || {
                  positionSize: 100,
                  leverage: 5,
                  active: false,
                  estimatedProfit: 0,
                  executed: false
                };
                
                // 获取价格信息和结算时间
                const longMarkPrice = item.longExchangeData?.markPrice;
                const longIndexPrice = item.longExchangeData?.indexPrice;
                const shortMarkPrice = item.shortExchangeData?.markPrice;
                const shortIndexPrice = item.shortExchangeData?.indexPrice;
                const longNextFundingTime = item.longExchangeData?.fundingTimestamp;
                const shortNextFundingTime = item.shortExchangeData?.fundingTimestamp;
                
                return (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="py-2 px-4 border-b font-medium">{item.symbol}</td>
                    <td className="py-2 px-4 border-b">
                      {item.longExchange} ({item.longRate >= 0 ? '+' : ''}{(item.longRate * 100).toFixed(4)}%)
                    </td>
                    <td className="py-2 px-4 border-b">
                      {item.shortExchange} ({item.shortRate >= 0 ? '+' : ''}{(item.shortRate * 100).toFixed(4)}%)
                    </td>
                    <td className="py-2 px-4 border-b font-semibold text-green-600">
                      {((item.rateDifference || Math.abs(item.shortRate - item.longRate)) * 100).toFixed(4)}%
                    </td>
                    <td className="py-2 px-4 border-b">
                      {longMarkPrice ? longMarkPrice.toFixed(2) : '-'} / {shortMarkPrice ? shortMarkPrice.toFixed(2) : '-'}
                    </td>
                    <td className="py-2 px-4 border-b">
                      {longIndexPrice ? longIndexPrice.toFixed(2) : '-'} / {shortIndexPrice ? shortIndexPrice.toFixed(2) : '-'}
                    </td>
                    <td className="py-2 px-4 border-b">
                      <div>做多: {formatDateTime(longNextFundingTime)}</div>
                      <div>做空: {formatDateTime(shortNextFundingTime)}</div>
                    </td>
                    <td className="py-2 px-4 border-b">
                      <input
                        type="number"
                        min="10"
                        className="w-20 px-2 py-1 border rounded"
                        value={position.positionSize}
                        onChange={(e) => handlePositionSizeChange(item.symbol, e.target.value)}
                        disabled={position.executed}
                      />
                    </td>
                    <td className="py-2 px-4 border-b">
                      <select
                        className="w-16 px-2 py-1 border rounded"
                        value={position.leverage}
                        onChange={(e) => handleLeverageChange(item.symbol, e.target.value)}
                        disabled={position.executed}
                      >
                        {[1, 2, 3, 5, 10, 20, 50, 100].map(lev => (
                          <option key={lev} value={lev}>{lev}x</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-4 border-b font-semibold text-green-600">
                      {position.estimatedProfit.toFixed(4)} USDT
                    </td>
                    <td className="py-2 px-4 border-b">
                      <div className="flex items-center">
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={position.active}
                            onChange={() => handleActiveToggle(item.symbol)}
                            disabled={position.executed}
                          />
                          <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-green-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                          <span className="ml-2 text-sm font-medium text-gray-900">
                            {position.executed ? '已执行' : (position.active ? '已激活' : '未激活')}
                          </span>
                        </label>
                      </div>
                    </td>
                    <td className="py-2 px-4 border-b">
                      <button
                        className={`px-3 py-1 rounded text-sm font-medium ${
                          position.active && !position.executed
                            ? 'bg-blue-500 hover:bg-blue-600 text-white'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                        onClick={() => executeArbitrage(item.symbol, positions)}
                        disabled={!position.active || position.executed}
                      >
                        {position.executed ? '已执行' : '执行交易'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      
      {/* 使用新的 OpenPositions 组件 */}
      <OpenPositions />
    </div>
  );
} 