import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'

function ResponsiveToaster() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    const onChange = () => setIsMobile(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return <Toaster richColors position={isMobile ? 'bottom-center' : 'bottom-right'} closeButton duration={4000} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <ResponsiveToaster />
  </StrictMode>,
)
