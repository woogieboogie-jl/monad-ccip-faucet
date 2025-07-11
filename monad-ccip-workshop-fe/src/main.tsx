import { StrictMode } from 'react'
import '@rainbow-me/rainbowkit/styles.css'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Buffer } from 'buffer'
import { Providers } from '@/components/providers'
import './index.css'
import App from './App.tsx'

// Polyfill Buffer for Web3 libraries
globalThis.Buffer = Buffer

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
    <BrowserRouter>
      <App />
    </BrowserRouter>
    </Providers>
  </StrictMode>,
) 