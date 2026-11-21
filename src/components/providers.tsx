'use client'

import { Toaster } from 'sonner'
import { TransportadoraProvider } from '@/components/transportadora-context'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TransportadoraProvider>
      {children}
      <Toaster richColors closeButton position="top-right" />
    </TransportadoraProvider>
  )
}
