import { metadataPagina } from '@/lib/site'

export const metadata = metadataPagina({
  titulo: 'FETHAB MT: cálculo e emissão do DAR online',
  descricao: 'Calcule o FETHAB de Mato Grosso (soja, milho, algodão, gado, madeira e grãos) com os valores da SEFAZ-MT e gere o DAR em PDF, com código de barras e PIX. Importa o XML da NF-e.',
  caminho: '/mt/fethab',
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
