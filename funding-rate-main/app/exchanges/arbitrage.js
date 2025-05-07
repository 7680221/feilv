/**
 * 计算套利机会
 * @param {Array} fundingRates 所有交易所的资金费率数据
 * @param {number} limit 返回的套利机会数量限制，默认为10个
 * @returns {Array} 套利机会列表，按费率差异排序
 */
function calculateArbitrageOpportunities(fundingRates, limit = 10) {
  const opportunities = [];
  const symbolMap = new Map();

  // 按交易对分组
  fundingRates.forEach(rate => {
    if (!symbolMap.has(rate.symbol)) {
      symbolMap.set(rate.symbol, []);
    }
    // 标准化费率属性
    const normalizedRate = {
      ...rate,
      rate: rate.fundingRate || rate.rate || 0,
      nextFundingTime: rate.fundingTimestamp || null,  // 使用 fundingTimestamp
      nextFundingDatetime: rate.fundingDatetime || null  // 使用 fundingDatetime
    };
    symbolMap.get(rate.symbol).push(normalizedRate);
  });

  // 计算每个交易对在不同交易所的费率差异
  symbolMap.forEach((rates, symbol) => {
    if (rates.length < 2) return; // 需要至少两个交易所的数据才能比较

    for (let i = 0; i < rates.length; i++) {
      for (let j = i + 1; j < rates.length; j++) {
        const rate1 = rates[i];
        const rate2 = rates[j];
        const rateDifference = rate1.rate - rate2.rate;

        // 确定做多和做空的交易所
        let longExchange, shortExchange, longExchangeData, shortExchangeData;
        let longRate, shortRate;

        if (rate1.rate < rate2.rate) {
          longExchange = rate1.exchange;
          shortExchange = rate2.exchange;
          longRate = rate1.rate;
          shortRate = rate2.rate;
          longExchangeData = rate1;
          shortExchangeData = rate2;
        } else {
          longExchange = rate2.exchange;
          shortExchange = rate1.exchange;
          longRate = rate2.rate;
          shortRate = rate1.rate;
          longExchangeData = rate2;
          shortExchangeData = rate1;
        }

        opportunities.push({
          symbol,
          longExchange,
          shortExchange,
          longRate,
          shortRate,
          rateDifference: Math.abs(rateDifference),
          // 添加两个交易所的下次结算时间
          longExchangeNextFunding: longExchangeData.nextFundingTime,
          longExchangeNextFundingDatetime: longExchangeData.nextFundingDatetime,
          shortExchangeNextFunding: shortExchangeData.nextFundingTime,
          shortExchangeNextFundingDatetime: shortExchangeData.nextFundingDatetime,
          // 保存完整的交易所数据
          longExchangeData,
          shortExchangeData,
          // 添加标记价格和指数价格
          longMarkPrice: longExchangeData.markPrice,
          longIndexPrice: longExchangeData.indexPrice,
          shortMarkPrice: shortExchangeData.markPrice,
          shortIndexPrice: shortExchangeData.indexPrice
        });
      }
    }
  });

  // 按费率差异从大到小排序，并限制返回数量
  return opportunities
    .sort((a, b) => b.rateDifference - a.rateDifference)
    .slice(0, limit);
}

/**
 * 筛选套利机会，保留完整交易所数据
 * @param {Array} allRates 所有交易所的资金费率数据
 * @param {number} threshold 套利阈值，默认为0.0001
 * @returns {Array} 套利机会列表，按费率差从大到小排序
 */
function filterArbitrageOpportunities(allRates, threshold = 0.0001) {
  // 按交易对分组
  const symbolGroups = {};
  
  allRates.forEach(item => {
    if (!symbolGroups[item.symbol]) {
      symbolGroups[item.symbol] = [];
    }
    // 标准化费率属性
    const normalizedItem = {
      ...item,
      rate: item.fundingRate || item.rate || 0
    };
    symbolGroups[item.symbol].push(normalizedItem);
  });
  
  // 找出符合条件的套利机会
  const opportunities = [];
  
  Object.entries(symbolGroups).forEach(([symbol, rates]) => {
    if (rates.length < 2) return; // 至少需要两个交易所的数据
    
    // 找出资金费率最高和最低的交易所
    const sorted = [...rates].sort((a, b) => b.rate - a.rate);
    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];
    
    // 计算费率差异
    const rateDifference = highest.rate - lowest.rate;
    
    // 如果差异超过阈值，则为套利机会
    if (rateDifference >= threshold) {
      opportunities.push({
        symbol,
        rateDifference,
        longExchange: lowest.exchange, // 费率低的交易所做多
        longRate: lowest.rate,
        longExchangeData: lowest, // 保存完整的交易所数据
        shortExchange: highest.exchange, // 费率高的交易所做空
        shortRate: highest.rate,
        shortExchangeData: highest, // 保存完整的交易所数据
        timestamp: Date.now()
      });
    }
  });
  
  // 按费率差从大到小排序
  return opportunities.sort((a, b) => b.rateDifference - a.rateDifference);
}

module.exports = {
  calculateArbitrageOpportunities,
  filterArbitrageOpportunities
}; 