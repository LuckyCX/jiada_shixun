import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'tdesign-react/es/_util/react-19-adapter'
import 'tdesign-react/es/style/index.css'
import '@tdesign-react/chat/es/style/index.js';
import App from './App.tsx'
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
