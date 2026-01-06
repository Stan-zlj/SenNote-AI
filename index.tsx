
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Register Service Worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // 仅在非 file:// 协议且同源的情况下注册，避免 sandbox 报错
    const isSandbox = window.location.hostname.includes('usercontent.goog');
    
    if (!isSandbox) {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(reg => console.log('ZenNote: PWA Ready', reg.scope))
        .catch(err => console.debug('SW Registration handled', err));
    } else {
      console.info('ZenNote: 运行在预览沙盒中，PWA 安装功能将在部署到正式域名后激活。');
    }
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
