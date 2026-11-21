import { metadataPagina } from '@/lib/site'

export const metadata = metadataPagina({
  titulo: 'ICMS Frete RO: cálculo e DARE online',
  descricao: 'Calcule o ICMS do frete em Rondônia pela tabela da ANTT (Portaria SUROC nº 22/2026) e gere o DARE da SEFIN-RO a partir do XML da NF-e. Carga geral ou fracionada.',
  caminho: '/ro/icms-frete',
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
