// src/index.js – نقطة بداية التطبيق
// نظام متابعة حضور وغياب الطلاب
// جامعة القرآن الكريم والعلوم الإسلامية - فرع غيل باوزير
// المطور: سالم التريمي

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../App';
import '../App.css';

// ========== إعدادات التطبيق ==========
const APP_CONFIG = {
  name: 'نظام الحضور والغياب',
  version: '1.0.0',
  developer: 'سالم التريمي',
  university: 'جامعة القرآن الكريم والعلوم الإسلامية',
};

// ========== تسجيل Service Worker ==========
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker مسجل بنجاح:', registration.scope);
      })
      .catch((error) => {
        console.log('⚠️ Service Worker غير متاح:', error.message);
      });
  });
}

// ========== تحميل التطبيق ==========
const renderApp = () => {
  const container = document.getElementById('root');
  
  if (!container) {
    console.error('❌ عنصر #root غير موجود في الصفحة');
    return;
  }

  const root = ReactDOM.createRoot(container);

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  hideSplashScreen();
};

// ========== إخفاء شاشة التحميل ==========
const hideSplashScreen = () => {
  const splash = document.getElementById('splash-screen');
  
  if (splash) {
    setTimeout(() => {
      splash.style.opacity = '0';
      splash.style.transition = 'opacity 0.6s ease';
      
      setTimeout(() => {
        if (splash.parentNode) {
          splash.parentNode.removeChild(splash);
        }
      }, 600);
    }, 1500);
  }
};

// ========== معالجة الأخطاء ==========
window.addEventListener('error', (event) => {
  console.error('❌ خطأ:', event.error?.message || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ خطأ غير معالج:', event.reason?.message || event.reason);
});

// ========== معلومات التطبيق ==========
console.log(`
🏛️  ${APP_CONFIG.name}
📌  ${APP_CONFIG.university}
🔢  الإصدار: ${APP_CONFIG.version}
👨‍💻  المطور: ${APP_CONFIG.developer}
✅  جاهز للعمل
`);

// ========== بدء التطبيق ==========
renderApp();

export { APP_CONFIG };
