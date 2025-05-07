import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 创建一个带有代理配置的axios实例
 * 
 * @param {Object} options - axios实例配置选项
 * @param {string} options.baseURL - 基础URL
 * @param {number} options.timeout - 超时时间(ms)
 * @param {Object} proxyConfig - 代理配置
 * @param {boolean} proxyConfig.useProxy - 是否使用代理
 * @param {string} proxyConfig.proxyUrl - 特定的代理URL (优先使用)
 * @param {string} proxyConfig.proxyHost - 代理主机
 * @param {string} proxyConfig.proxyPort - 代理端口
 * @param {string} proxyConfig.proxyUsername - 代理用户名(可选)
 * @param {string} proxyConfig.proxyPassword - 代理密码(可选)
 * @param {Function} logger - 日志记录函数(可选)
 * @returns {Object} axios实例
 */
export const createAxiosInstance = (options = {}, proxyConfig = {}, logger = console.log) => {
  const config = {
    timeout: 10000,
    ...options
  };
  
  // 1. 检查是否使用特定的代理URL
  if (proxyConfig.useProxy && proxyConfig.proxyUrl) {
    if (logger) logger(`使用特定代理URL: ${proxyConfig.proxyUrl}`);
    
    // 创建代理
    const httpsAgent = new HttpsProxyAgent(proxyConfig.proxyUrl);
    
    // 使用代理创建Axios实例
    config.httpsAgent = httpsAgent;
  } 
  // 2. 检查是否使用主机/端口配置的代理
  else if (proxyConfig.proxyHost && proxyConfig.proxyPort) {
    const { proxyHost, proxyPort, proxyUsername, proxyPassword } = proxyConfig;
    
    if (logger) logger(`使用代理: ${proxyHost}:${proxyPort}`);
    
    const auth = proxyUsername && proxyPassword ? `${proxyUsername}:${proxyPassword}@` : '';
    const proxyUrl = `http://${auth}${proxyHost}:${proxyPort}`;
    
    // 创建代理
    const httpsAgent = new HttpsProxyAgent(proxyUrl);
    config.httpsAgent = httpsAgent;
  }
  
  // 创建并返回axios实例
  return axios.create(config);
};

/**
 * 从环境变量创建全局代理配置
 * 
 * @returns {Object} 代理配置对象
 */
export const getGlobalProxyConfig = () => {
    console.log(process.env.PROXY_HOST);
    console.log(process.env.PROXY_PORT);
    console.log(process.env.PROXY_USERNAME);
    console.log(process.env.PROXY_PASSWORD);
  // 在服务端环境下，从环境变量中读取代理配置
  if (typeof window === 'undefined') {
    const proxyHost = process.env.PROXY_HOST;
    const proxyPort = process.env.PROXY_PORT;
    const proxyUsername = process.env.PROXY_USERNAME;
    const proxyPassword = process.env.PROXY_PASSWORD;
    
    return {
      proxyHost,
      proxyPort,
      proxyUsername,
      proxyPassword
    };
  }
  // 浏览器环境下不使用代理
  return {};
};

/**
 * 从环境变量创建Discord专用代理配置
 * 
 * @returns {Object} Discord代理配置对象
 */
export const getDiscordProxyConfig = () => {
  return {
    useProxy: process.env.DISCORD_USE_PROXY === 'true',
    proxyUrl: process.env.DISCORD_PROXY_URL
  };
};

/**
 * 创建用于Discord的axios实例
 * 
 * @param {Function} logger - 日志记录函数(可选)
 * @returns {Object} axios实例
 */
export const createDiscordAxiosInstance = (logger = console.log) => {
  const proxyConfig = getDiscordProxyConfig();
  return createAxiosInstance({}, proxyConfig, logger);
};

/**
 * 为交易所API创建axios实例
 * 
 * @param {string} baseURL - 交易所API的基础URL
 * @param {string} exchangeName - 交易所名称(用于日志)
 * @param {Function} logger - 日志记录函数(可选)
 * @returns {Object} axios实例
 */
export const createExchangeAxiosInstance = (baseURL, exchangeName = '', logger = console.log) => {
  const options = { baseURL };
  const proxyConfig = getGlobalProxyConfig();

  console.log(proxyConfig);
  
  // 先记录代理配置信息
  if (exchangeName && proxyConfig.proxyHost && proxyConfig.proxyPort) {
    const proxyString = `${proxyConfig.proxyHost}:${proxyConfig.proxyPort}`;
    if (typeof logger === 'function') {
      logger(`[${exchangeName}] 使用代理: ${proxyString}`);
    }
  }
  
  const logMessage = (message) => {
    if (typeof logger === 'function') {
      if (exchangeName) {
        logger(`[${exchangeName}] ${message}`);
      } else {
        logger(message);
      }
    }
  };
  
  return createAxiosInstance(options, proxyConfig, logMessage);
}; 