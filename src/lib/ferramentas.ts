import type { FerramentaId } from '@/lib/types'

export type StatusFerramenta = 'disponivel' | 'novo' | 'em-breve'

export interface Ferramenta {
  // Só as ferramentas que já geram guia têm id de histórico.
  id: FerramentaId | 'icms-nota-ro'
  uf: 'RO' | 'MT'
  titulo: string
  guia: string
  descricao: string
  quemUsa: string
  href: string
  status: StatusFerramenta
}

export const ESTADOS: Record<Ferramenta['uf'], string> = {
  RO: 'Rondônia',
  MT: 'Mato Grosso',
}

// Catálogo do site. A home, o menu e o histórico leem daqui.
export const FERRAMENTAS: Ferramenta[] = [
  {
    id: 'icms-frete-ro',
    uf: 'RO',
    titulo: 'ICMS Frete',
    guia: 'DARE · SEFIN-RO',
    descricao: 'Calcula o ICMS do frete pela tabela de pauta e gera o DARE a partir do XML da NF-e.',
    quemUsa: 'Transportadoras',
    href: '/ro/icms-frete',
    status: 'disponivel',
  },
  {
    id: 'icms-nota-ro',
    uf: 'RO',
    titulo: 'ICMS Nota Fiscal',
    guia: 'DARE · SEFIN-RO',
    descricao: 'ICMS devido sobre a nota fiscal, com a guia pronta para pagar.',
    quemUsa: 'Empresas',
    href: '/ro/icms-nota',
    status: 'em-breve',
  },
  {
    id: 'fethab-mt',
    uf: 'MT',
    titulo: 'FETHAB',
    guia: 'DAR-1/AUT · SEFAZ-MT',
    descricao: 'Calcula o FETHAB e a contribuição à entidade por tonelada, cabeça ou m³ (soja, milho, algodão, gado, madeira e grãos), com os valores da SEFAZ-MT.',
    quemUsa: 'Produtores e empresas',
    href: '/mt/fethab',
    status: 'novo',
  },
]

export const ferramentaPorId = (id: string | undefined) =>
  FERRAMENTAS.find(f => f.id === (id ?? 'icms-frete-ro'))

export const disponivel = (f: Ferramenta) => f.status !== 'em-breve'

export const STATUS_LABEL: Record<StatusFerramenta, { label: string; className: string }> = {
  disponivel: { label: 'Disponível', className: 'bg-emerald-100 text-emerald-800' },
  novo: { label: 'Novo', className: 'bg-sky-100 text-sky-800' },
  'em-breve': { label: 'Em breve', className: 'bg-slate-100 text-slate-600' },
}
