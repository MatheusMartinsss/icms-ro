// Tabela do FETHAB (MT). Valor = % da UPF/MT × quantidade.
//
// A fonte de verdade é o emissor de DAR da SEFAZ-MT, que devolve o valor por
// unidade de cada código e período (ver /api/fethab). Esta tabela local serve
// de reserva quando a SEFAZ não responde. Foi conferida no emissor em 21/11/2026.
//
// Achados na conferência:
// - A SEFAZ usa UPF de R$ 243,49 desde 12/2025 (congelamento). O informativo da
//   Famato de jul/2025 fala em 251,48, mas o sistema não usa esse valor.
// - Soja, algodão e gado já vêm com o adicional somado no mesmo código.
// - Gado fêmea: redução de 30% no FETHAB + adicional (7262) e na entidade
//   (8134, 0,882% em vez dos 1,26% do 8132 do macho).
// - Lei 12.751/2024: grãos, feijão, gergelim, milheto e painço mudaram em 2026.

export type Unidade = 't' | 'cabeca' | 'm3'

export const UNIDADE_LABEL: Record<Unidade, { curta: string; plural: string }> = {
  t: { curta: 't', plural: 'toneladas' },
  cabeca: { curta: 'cabeça', plural: 'cabeças' },
  m3: { curta: 'm³', plural: 'metros cúbicos' },
}

interface Vigencia {
  desde: string // AAAA-MM
  fethab: number // % da UPF
  entidade?: number // % da UPF
}

export interface ProdutoFethab {
  id: string
  nome: string
  grupo: 'Grãos' | 'Pecuária' | 'Algodão' | 'Madeira'
  unidade: Unidade
  codigoFethab: string
  codigoEntidade?: string
  composicao?: string
  incidencia: string
  vigencias: Vigencia[]
}

// A tabela local só cobre este intervalo. Fora dele, depende da SEFAZ.
export const COBERTURA_LOCAL = { desde: '2025-12', ate: '2026-12' }
export const UPF_FETHAB = 243.49
export const FONTE_LOCAL = 'tabela conferida no emissor da SEFAZ-MT em 21/11/2026 (UPF R$ 243,49)'

const LEI_12751 = 'Remetente nas operações internas, interestaduais e de exportação.'

const grao = (id: string, nome: string, codigoFethab: string, codigoEntidade: string): ProdutoFethab => ({
  id, nome, grupo: 'Grãos', unidade: 't', codigoFethab, codigoEntidade,
  incidencia: LEI_12751,
  vigencias: [
    { desde: '2025-12', fethab: 6, entidade: 4 },
    { desde: '2026-01', fethab: 6.5, entidade: 3.5 },
  ],
})

const graoMiudo = (id: string, nome: string, codigoFethab: string, codigoEntidade: string): ProdutoFethab => ({
  id, nome, grupo: 'Grãos', unidade: 't', codigoFethab, codigoEntidade,
  incidencia: LEI_12751,
  vigencias: [
    { desde: '2025-12', fethab: 3, entidade: 2 },
    { desde: '2026-01', fethab: 3.25, entidade: 1.75 },
  ],
})

export const PRODUTOS: ProdutoFethab[] = [
  {
    id: 'soja', nome: 'Soja', grupo: 'Grãos', unidade: 't', codigoFethab: '7237', codigoEntidade: '8090',
    composicao: 'FETHAB 10% + adicional 10% (adicional até 31/12/2026)',
    incidencia: 'Remetente em operação interna, interestadual e de exportação.',
    vigencias: [{ desde: '2025-12', fethab: 20, entidade: 1.15 }],
  },
  {
    id: 'milho', nome: 'Milho', grupo: 'Grãos', unidade: 't', codigoFethab: '7235',
    incidencia: 'Só em operação interestadual e de exportação. Não há contribuição à entidade.',
    vigencias: [{ desde: '2025-12', fethab: 6 }],
  },
  grao('feijao', 'Feijão', '8104', '8096'),
  {
    id: 'gergelim', nome: 'Gergelim', grupo: 'Grãos', unidade: 't', codigoFethab: '8105', codigoEntidade: '8248',
    incidencia: LEI_12751,
    vigencias: [
      { desde: '2025-12', fethab: 12, entidade: 8 },
      { desde: '2026-01', fethab: 13, entidade: 7 },
    ],
  },
  graoMiudo('milheto', 'Milheto', '8106', '8247'),
  graoMiudo('painco', 'Painço', '8107', '8246'),
  grao('grao-de-bico', 'Grão de bico', '7902', '8234'),
  grao('lentilha', 'Lentilha', '7903', '8235'),
  grao('ervilha', 'Ervilha', '7904', '8236'),
  grao('amendoim', 'Amendoim', '7905', '8237'),
  grao('trigo', 'Trigo', '7906', '8238'),
  grao('fava', 'Fava', '7907', '8239'),
  grao('milho-pipoca', 'Milho pipoca', '7908', '8240'),
  grao('milho-canjica', 'Milho canjica', '7909', '8241'),
  grao('mamona', 'Mamona', '7910', '8242'),
  grao('girassol', 'Girassol', '7911', '8243'),
  grao('arroz', 'Arroz', '7912', '8244'),
  grao('sorgo', 'Sorgo', '7913', '8245'),
  {
    id: 'gado-macho', nome: 'Gado (macho)', grupo: 'Pecuária', unidade: 'cabeca', codigoFethab: '7241', codigoEntidade: '8132',
    composicao: 'FETHAB 11,5% + adicional 11,5% (adicional até 31/12/2026)',
    incidencia: 'Remetente em operação interna para abate, interestadual e de exportação.',
    vigencias: [{ desde: '2025-12', fethab: 23, entidade: 1.26 }],
  },
  {
    id: 'gado-femea', nome: 'Gado (fêmea)', grupo: 'Pecuária', unidade: 'cabeca', codigoFethab: '7262', codigoEntidade: '8134',
    composicao: 'Redução de 30% sobre FETHAB + adicional e sobre a entidade (Lei 13.032/2025)',
    incidencia: 'Remetente em operação interna para abate, interestadual e de exportação.',
    vigencias: [{ desde: '2025-12', fethab: 16.1, entidade: 0.882 }],
  },
  {
    id: 'algodao', nome: 'Algodão (pluma ou caroço)', grupo: 'Algodão', unidade: 't', codigoFethab: '7238',
    composicao: 'FETHAB 45% + adicional 30%',
    incidencia: 'Pluma: operações internas, interestaduais e de exportação (dispensado na remessa interna para indústria de fio têxtil em MT). Caroço: interestaduais e de exportação.',
    vigencias: [{ desde: '2025-12', fethab: 75 }],
  },
  {
    id: 'madeira', nome: 'Madeira', grupo: 'Madeira', unidade: 'm3', codigoFethab: '7239', codigoEntidade: '8097',
    incidencia: 'Remetente em operação interestadual e de exportação, e saída interna de indústria de MT para comércio ou consumidor final.',
    vigencias: [{ desde: '2025-12', fethab: 10, entidade: 3.71 }],
  },
]

export const GRUPOS = ['Grãos', 'Pecuária', 'Algodão', 'Madeira'] as const

// Todos os códigos que o site aceita consultar na SEFAZ.
export const CODIGOS_FETHAB = new Set(
  PRODUTOS.flatMap(p => [p.codigoFethab, p.codigoEntidade].filter((c): c is string => !!c)),
)

const PERIODO_RE = /^(0[1-9]|1[0-2])\/(20\d\d)$/

// "11/2026" -> "2026-11"
export function periodoChave(periodo: string) {
  const m = PERIODO_RE.exec(periodo.trim())
  return m ? `${m[2]}-${m[1]}` : null
}

export const periodoValido = (periodo: string) => periodoChave(periodo) !== null

export function periodoAtual(hoje = new Date()) {
  return `${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`
}

export interface PercentuaisLocais {
  fethab: number
  entidade?: number
}

// Percentuais da tabela local para o período, ou null se fora da cobertura.
export function percentuaisLocais(produto: ProdutoFethab, periodo: string): PercentuaisLocais | null {
  const chave = periodoChave(periodo)
  if (!chave || chave < COBERTURA_LOCAL.desde || chave > COBERTURA_LOCAL.ate) return null
  const vigente = [...produto.vigencias].reverse().find(v => v.desde <= chave)
  return vigente ? { fethab: vigente.fethab, entidade: vigente.entidade } : null
}

export const valorPorUnidade = (percentual: number, upf = UPF_FETHAB) => (upf * percentual) / 100

// Mesmo arredondamento do emissor: quantidade × valor por unidade, em centavos.
export const arredondar = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100

// Padrão brasileiro: vírgula é decimal e ponto seguido de 3 dígitos é milhar.
// "1.234,5" e "1234,5" -> 1234,5; "37.500" -> 37500; "1.5" -> 1,5.
export function lerDecimal(texto: string) {
  const limpo = texto.trim().replace(/\s/g, '')
  if (!limpo) return null
  const normal = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(limpo) ? limpo.replace(/\./g, '') : limpo
  const n = Number(normal)
  return Number.isFinite(n) && n >= 0 ? n : null
}
