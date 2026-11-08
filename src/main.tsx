import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './themes.css'
import './themes-extra.css'
import '@fontsource/patrick-hand/400.css'
import '@fontsource/chewy/400.css'
import '@fontsource/permanent-marker/400.css'
import '@fontsource/oswald/500.css'
import '@fontsource/oswald/700.css'
import '@fontsource/cinzel/600.css'
import '@fontsource/cinzel/700.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/700.css'
import App from './App.tsx'

// Pré-visualização de tema: ?tema=sangue | noturno | crepusculo | lunar | claro | quarto | estudio | doce
const tema = new URLSearchParams(location.search).get('tema')
if (tema) document.documentElement.dataset.theme = tema

// Pré-visualização de fonte dos títulos: ?fonte=oswald | cinzel | grotesk
const fonte = new URLSearchParams(location.search).get('fonte')
if (fonte) document.documentElement.dataset.fonte = fonte

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
