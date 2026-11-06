import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './themes.css'
import App from './App.tsx'

// Pré-visualização de tema: ?tema=noturno | sangue | crepusculo | lunar | claro
const tema = new URLSearchParams(location.search).get('tema')
if (tema === 'claro') delete document.documentElement.dataset.theme
else if (tema) document.documentElement.dataset.theme = tema

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
