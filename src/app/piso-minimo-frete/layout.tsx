import { metadataPagina } from '@/lib/site'

export const metadata = metadataPagina({
  titulo: 'Calculadora do piso mínimo de frete ANTT 2026',
  descricao: 'Calcule o piso mínimo do frete rodoviário pela tabela da ANTT (Resolução 5.867/2020, Portaria SUROC 22/2026): tipo de carga, número de eixos, distância, retorno vazio e tabelas A, B, C e D. Grátis e sem cadastro.',
  caminho: '/piso-minimo-frete',
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
