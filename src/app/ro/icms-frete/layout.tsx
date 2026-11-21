import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ICMS Frete RO',
  description: 'Cálculo do ICMS sobre frete em Rondônia e emissão do DARE para transportadoras.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
