import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './i18n'
import { registerServiceWorker } from './lib/registerSW.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register PWA service worker (only in production to avoid dev conflicts)
if (import.meta.env.PROD) {
  registerServiceWorker();
}
