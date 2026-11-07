import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './i18n'
import { registerServiceWorker } from './lib/registerSW.js'
import { setLanguage } from './lib/tx.js'

// Restore the visitor's language (Tamil dictionary is fetched on demand).
try {
  const saved = localStorage.getItem('kh_lang')
  if (saved && saved !== 'en') setLanguage(saved)
} catch {
  /* storage blocked — default to English */
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register PWA service worker (only in production to avoid dev conflicts)
if (import.meta.env.PROD) {
  registerServiceWorker();
}
