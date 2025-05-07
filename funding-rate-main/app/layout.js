import './globals.css';

export const metadata = {
  title: '加密货币资金费率监控套利系统',
  description: '监控不同交易所之间的资金费率差异，自动执行套利策略',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh">
      <head>
        {/* Google AdSense代码 - 临时禁用 */}
        {/*
        <Script
          id="google-adsense"
          async
          strategy="afterInteractive"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"
          crossOrigin="anonymous"
        />
        */}
      </head>
      <body>{children}</body>
    </html>
  );
} 