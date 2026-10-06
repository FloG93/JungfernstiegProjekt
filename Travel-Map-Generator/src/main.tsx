import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'maplibre-gl/dist/maplibre-gl.css'
import './index.css'
import { App } from './ui/App'

const container = document.getElementById('root')
if (!container) throw new Error('Wurzelelement #root fehlt in index.html')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
