import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Тема подключается здесь, а не в Layout: экран входа рисуется
// раньше, чем появится Layout, и должен быть в том же стиле.
import './theme.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
