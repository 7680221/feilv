"use client";

import { useState, useEffect } from 'react';
import AutoTradeConfig from './components/AutoTradeConfig';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [apiCallStatus, setApiCallStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [tradeConfig, setTradeConfig] = useState({
    threshold: 0.0005,  // 默认阈值为 0.05%
    quantity: 0.01,     // 默认数量
    autoExecute: false  // 默认不自动执行
  });

  // 获取数据的函数
  async function fetchData(forceRefresh = false) {
    try {
      setLoading(true);
      setApiCallStatus('正在获取数据...');
      const url = `/api/data${forceRefresh ? '?refresh=true' : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      setData(result);
      setError(null);
      setApiCallStatus('数据获取成功');
      
    } catch (err) {
      console.error('获取数据错误:', err);
      setError(err.message || '获取数据失败');
      setApiCallStatus('获取数据失败');
    } finally {
      setLoading(false);
    }
  }

  // 组件加载时获取数据
  useEffect(() => {
    fetchData();
    
    // 每分钟刷新一次数据
    const interval = setInterval(() => {
      fetchData();
    }, 600 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // 手动刷新数据
  const refreshData = () => {
    fetchData(true);
  };

  // 处理搜索输入变化
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value.toUpperCase());
  };

  // 根据搜索条件筛选交易对
  const getFilteredSymbols = () => {
    if (!data || !data.fundingRates) return [];
    
    // 如果搜索为空，默认返回交易量排名的交易对
    if (!searchTerm) {
      return data.topVolumeSymbols?.map(item => item.baseSymbol) || [];
    }
    
    // 否则返回搜索匹配的交易对
    const allSymbols = [...new Set(data.fundingRates.map(rate => rate.baseSymbol))];
    return allSymbols.filter(symbol => symbol.includes(searchTerm));
  };

  // 获取过滤后的交易对列表
  const filteredSymbols = getFilteredSymbols();

  // 计算特定交易对在所有交易所间的最大费率差异
  const calculateMaxRateDifference = (symbol) => {
    if (!data || !data.fundingRates) return null;

    // 获取该交易对在所有交易所的费率
    const rates = data.fundingRates
      .filter(rate => rate.baseSymbol === symbol)
      .map(rate => rate.fundingRate)
      .filter(rate => rate !== undefined);
      
    // 如果少于2个交易所有数据，无法计算差异
    if (rates.length < 2) return null;
    
    // 计算最大差异
    const maxRate = Math.max(...rates);
    const minRate = Math.min(...rates);
    return Math.abs(maxRate - minRate);
  };

  // 添加处理配置更新的函数
  const handleConfigUpdate = async (config) => {
    setTradeConfig(config);
    
    // 这里可以实现将配置保存到本地存储的逻辑
    try {
      localStorage.setItem('tradeConfig', JSON.stringify(config));
    } catch (error) {
      console.error('保存配置失败:', error);
    }
    
    return true;
  };

  // 在 useEffect 中添加加载本地存储的配置
  useEffect(() => {
    // 从本地存储加载配置
    try {
      const savedConfig = localStorage.getItem('tradeConfig');
      if (savedConfig) {
        setTradeConfig(JSON.parse(savedConfig));
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  }, []);

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">加密货币资金费率监控套利系统</h1>
          <div className="flex items-center justify-between mt-4">
            <p className="text-gray-600">
              {data ? 
                `最后更新时间: ${new Date(data.lastUpdated).toLocaleString()}` : 
                '获取数据中...'}
            </p>
            <button
              onClick={refreshData}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
            >
              {loading ? '刷新中...' : '刷新数据'}
            </button>
          </div>
          {apiCallStatus && <p className="mt-2 text-sm text-gray-500">{apiCallStatus}</p>}
        </header>

        {error && (
          <div className="p-4 mb-6 bg-red-100 border border-red-300 text-red-700 rounded">
            <p>错误: {error}</p>
          </div>
        )}

        {/* 广告位-顶部横幅 - 临时隐藏 */}
        {/* 
        <div className="w-full mb-6 overflow-hidden bg-gray-100 flex justify-center items-center" style={{ height: '90px', minHeight: '90px' }}>
          <ins className="adsbygoogle"
              style={{ display: 'block', width: '728px', height: '90px' }}
              data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
              data-ad-slot="XXXXXXXXXX"
              data-ad-format="auto"
              data-full-width-responsive="true"></ins>
          <Script id="banner-ad">
            {`(adsbygoogle = window.adsbygoogle || []).push({});`}
          </Script>
        </div>
        */}

        {/* 自动交易配置 - 单独一行展示 */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <AutoTradeConfig
            arbitrageData={data?.arbitrageOpportunities || []}
          />
        </div>

        {/* 套利机会 */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">套利机会分析（费率差最大的10个交易对）</h2>
          {loading && !data ? (
            <p className="text-gray-500">加载中...</p>
          ) : !data?.arbitrageOpportunities || data.arbitrageOpportunities.length === 0 ? (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-500">当前没有发现套利机会</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-2 border">排名</th>
                    <th className="px-4 py-2 border">交易对</th>
                    <th className="px-4 py-2 border">做多交易所</th>
                    <th className="px-4 py-2 border">做空交易所</th>
                    <th className="px-4 py-2 border">做多费率</th>
                    <th className="px-4 py-2 border">做空费率</th>
                    <th className="px-4 py-2 border">费率差异</th>
                    <th className="px-4 py-2 border">做多标记价格</th>
                    <th className="px-4 py-2 border">做空标记价格</th>
                    <th className="px-4 py-2 border">做多结算时间</th>
                    <th className="px-4 py-2 border">做空结算时间</th>
                  </tr>
                </thead>
                <tbody>
                  {data.arbitrageOpportunities.map((opp, index) => (
                    <tr key={index} className={index === 0 ? 'bg-yellow-50' : ''}>
                      <td className="px-4 py-2 border text-center font-bold">{index + 1}</td>
                      <td className="px-4 py-2 border font-medium">{opp.symbol}</td>
                      <td className="px-4 py-2 border">{capitalize(opp.longExchange)}</td>
                      <td className="px-4 py-2 border">{capitalize(opp.shortExchange)}</td>
                      <td className={`px-4 py-2 border ${opp.longRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(opp.longRate * 100).toFixed(4)}%
                      </td>
                      <td className={`px-4 py-2 border ${opp.shortRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(opp.shortRate * 100).toFixed(4)}%
                      </td>
                      <td className="px-4 py-2 border font-bold text-blue-600">
                        {(opp.rateDifference * 100).toFixed(4)}%
                      </td>
                      <td className="px-4 py-2 border">
                        {opp.longMarkPrice ? opp.longMarkPrice.toFixed(4) : '-'}
                      </td>
                      <td className="px-4 py-2 border">
                        {opp.shortMarkPrice ? opp.shortMarkPrice.toFixed(4) : '-'}
                      </td>
                      <td className="px-4 py-2 border">
                        {opp.longExchangeNextFundingDatetime ? 
                          new Date(opp.longExchangeNextFundingDatetime).toLocaleString('zh-CN', {
                            hour12: false,
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : '未知'}
                      </td>
                      <td className="px-4 py-2 border">
                        {opp.shortExchangeNextFundingDatetime ? 
                          new Date(opp.shortExchangeNextFundingDatetime).toLocaleString('zh-CN', {
                            hour12: false,
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : '未知'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 text-sm text-gray-500">
                <p>注意: 只显示费率差异最大的交易对，最多显示10个</p>
              </div>
            </div>
          )}
        </div>

        {/* 广告位-中部矩形 - 临时隐藏 */}
        {/*
        <div className="w-full my-6 overflow-hidden bg-gray-100 flex justify-center items-center" style={{ height: '250px', minHeight: '250px' }}>
          <ins className="adsbygoogle"
              style={{ display: 'block', width: '300px', height: '250px' }}
              data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
              data-ad-slot="XXXXXXXXXX"
              data-ad-format="auto"
              data-full-width-responsive="true"></ins>
          <Script id="rectangle-ad">
            {`(adsbygoogle = window.adsbygoogle || []).push({});`}
          </Script>
        </div>
        */}

        {/* 资金费率详细表格 */}
        <div className="bg-white p-4 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold mb-4">资金费率详细数据</h2>
          
          {/* 搜索框 */}
          <div className="mb-4">
            <div className="flex items-center">
              <input
                type="text"
                placeholder="搜索交易对（如：BTC、ETH）"
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button 
                onClick={() => setSearchTerm('')}
                className="ml-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                清除
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {searchTerm ? 
                `正在显示包含 "${searchTerm}" 的交易对，共 ${filteredSymbols.length} 个结果` : 
                '默认显示交易量排名中的交易对，可输入关键词搜索其它交易对'}
            </p>
          </div>
          
          {loading && !data ? (
            <p className="text-gray-500">加载中...</p>
          ) : !data?.fundingRates || data.fundingRates.length === 0 ? (
            <p className="text-gray-500">暂无资金费率数据</p>
          ) : filteredSymbols.length === 0 ? (
            <p className="text-gray-500">未找到匹配的交易对</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-2 border">交易对</th>
                    {data?.exchangeNames?.map(name => (
                      <th key={name} className="px-4 py-2 border">
                        {capitalize(name)}
                      </th>
                    ))}
                    <th className="px-4 py-2 border bg-blue-50">资金费率差</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSymbols.map(symbol => {
                    const maxRateDiff = calculateMaxRateDifference(symbol);
                    
                    return (
                      <tr key={symbol}>
                        <td className="px-4 py-2 border font-medium">{symbol}</td>
                        {data.exchangeNames.map(exchangeName => {
                          const rate = data.fundingRates.find(
                            rate => rate.baseSymbol === symbol && rate.exchange === exchangeName
                          )?.fundingRate;
                          
                          return (
                            <td key={exchangeName} className={`px-4 py-2 border ${getRateColorClass(rate)}`}>
                              {rate !== undefined ? `${(rate * 100).toFixed(4)}%` : 'N/A'}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2 border font-bold text-blue-600 bg-blue-50">
                          {maxRateDiff !== null ? `${(maxRateDiff * 100).toFixed(4)}%` : 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* 交易量排名 - 移到页面底部 */}
      <div className="max-w-7xl mx-auto mt-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">合约交易量排名 (Binance)</h2>
          {loading && !data ? (
            <p className="text-gray-500">加载中...</p>
          ) : !data?.topVolumeSymbols || data.topVolumeSymbols.length === 0 ? (
            <p className="text-gray-500">暂无交易量数据</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-2 border">排名</th>
                    <th className="px-4 py-2 border">交易对</th>
                    <th className="px-4 py-2 border">24小时交易量</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topVolumeSymbols.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 border font-bold text-center">{index + 1}</td>
                      <td className="px-4 py-2 border">{item.baseSymbol}</td>
                      <td className="px-4 py-2 border text-right">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        }).format(item.quoteVolume)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 辅助函数：获取费率颜色类
function getRateColorClass(rate) {
  if (rate === undefined) return 'text-gray-400';
  return rate >= 0 ? 'text-green-600' : 'text-red-600';
}

// 首字母大写
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
} 