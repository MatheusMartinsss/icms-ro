import { metadataPagina } from '@/lib/site'

export const metadata = metadataPagina({
  titulo: 'Calculadora de cubagem de madeira: tora e serrada em m³',
  descricao: 'Calcule o volume de madeira em m³: toras pelo método geométrico (Smalian) ou Francon, e madeira serrada em centímetros ou polegadas. Monte o romaneio, some o total e o valor. Grátis e sem cadastro.',
  caminho: '/cubagem-madeira',
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
