import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FETHAB MT',
  description: 'Calcule o FETHAB de Mato Grosso por produto (soja, milho, algodão, gado, madeira e grãos) com os valores da SEFAZ-MT.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
