import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/semantic-colors.css'
import './styles/glassmorphism.css'
import './styles/mobile.css'
import './styles/interactive-landing.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
