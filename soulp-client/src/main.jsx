import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './App.css'
import App from './App.jsx'

// 导入API服务并使其全局可用
import api from './services/api';
window.api = api; // 使API在全局window对象中可用
console.log('API服务已初始化到全局window.api');

// 启动应用
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
