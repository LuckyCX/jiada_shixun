import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
// 图标字体随构建打包，避免依赖外网 CDN（校园网常拦截 jsDelivr / cdnjs）
import 'remixicon/fonts/remixicon.css'
import 'tdesign-react/es/_util/react-19-adapter'
import 'tdesign-react/es/style/index.css'
import '@tdesign-react/chat/es/style/index.js';
import App from './App.tsx'
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
