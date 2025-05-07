// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // 确保环境变量对服务器端组件可用
  },
  webpack: (config) => {
    // 处理CSV文件支持
    config.module.rules.push({
      test: /\.csv$/,
      loader: 'file-loader',
      options: {
        name: '[name].[ext]',
      },
    });

    // 配置模块解析
    config.resolve = {
      ...config.resolve,
      extensionAlias: {
        '.js': ['.js', '.ts', '.tsx'],
        '.mjs': ['.mjs'],
        '.cjs': ['.cjs']
      }
    };

    return config;
  },
};

export default nextConfig; 