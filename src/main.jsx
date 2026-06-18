import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AppErrorBoundary from './components/shared/AppErrorBoundary.jsx'
import { setupIntelligenceSync } from './services/intelligenceSync.js'
import { registerDefaultEquipmentImports } from './services/configuration/equipmentImportLoader.js'

setupIntelligenceSync()
registerDefaultEquipmentImports()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
