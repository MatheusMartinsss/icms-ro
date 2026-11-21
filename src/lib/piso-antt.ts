import Piso from '@/app/piso-antt.json'

// Piso mínimo de frete da ANTT (Resolução nº 5.867/2020). Os coeficientes
// estão em src/app/piso-antt.json e foram conferidos, célula a célula, com a
// calculadora oficial da ANTT (calculadorafrete.antt.gov.br) em 21/11/2026.

export type TabelaId = 'A' | 'B' | 'C' | 'D'

interface LinhaTabela { tipo: string; coeficientes: { ccd: Record<string, number>; cc: Record<string, number> } }

const TABELAS = Piso.tabelas as Record<TabelaId, LinhaTabela[]>

export const FONTE_PISO = Piso.fonte
export const VIGENCIA_PISO = Piso.vigencia // AAAA-MM-DD
export const DIESEL_REFERENCIA = Piso.dieselReferencia

export const TIPOS_CARGA_PISO: { value: string; label: string }[] = [
  { value: 'geral', label: 'Carga geral' },
  { value: 'granel_solido', label: 'Granel sólido' },
  { value: 'granel_liquido', label: 'Granel líquido' },
  { value: 'frigorificada_aquecida', label: 'Frigorificada ou aquecida' },
  { value: 'conteinerizada', label: 'Conteinerizada' },
  { value: 'neogranel', label: 'Neogranel' },
  { value: 'carga_granel_pressurizada', label: 'Granel pressurizada' },
  { value: 'perigosa_carga_geral', label: 'Perigosa (carga geral)' },
  { value: 'perigosa_granel_solido', label: 'Perigosa (granel sólido)' },
  { value: 'perigosa_granel_liquido', label: 'Perigosa (granel líquido)' },
  { value: 'perigosa_frigorificada_aquecida', label: 'Perigosa (frigorificada ou aquecida)' },
  { value: 'perigosa_conteinerizada', label: 'Perigosa (conteinerizada)' },
]

export const TABELA_INFO: Record<TabelaId, { titulo: string; resumo: string }> = {
  A: { titulo: 'Tabela A', resumo: 'Carga lotação: veículo completo (cavalo + implemento ou caminhão simples)' },
  B: { titulo: 'Tabela B', resumo: 'Contratação apenas do veículo automotor (cavalo mecânico)' },
  C: { titulo: 'Tabela C', resumo: 'Lotação de alto desempenho: veículo completo' },
  D: { titulo: 'Tabela D', resumo: 'Alto desempenho, contratação apenas do veículo automotor' },
}

// Quantidades de eixos que o usuário pode escolher. A tabela não tem 8 eixos;
// a regra da ANTT manda usar a quantidade imediatamente inferior.
export const EIXOS_OPCOES = ['2', '3', '4', '5', '6', '7', '8', '9']

export const tabelaDaOperacao = (composicao: boolean, altoDesempenho: boolean): TabelaId =>
  composicao ? (altoDesempenho ? 'C' : 'A') : (altoDesempenho ? 'D' : 'B')

export function linhaTabela(tabela: TabelaId, tipo: string) {
  return TABELAS[tabela].find(l => l.tipo === tipo)
}

export function eixosDaTabela(tabela: TabelaId, tipo: string): string[] {
  const linha = linhaTabela(tabela, tipo)
  return linha ? Object.keys(linha.coeficientes.ccd).sort((a, b) => Number(a) - Number(b)) : []
}

// Nota 1 da calculadora da ANTT: sem coeficiente para a quantidade de eixos,
// usa a imediatamente inferior; sem inferior, a imediatamente superior.
export function eixosAplicados(tabela: TabelaId, tipo: string, eixos: number): string | null {
  const existentes = eixosDaTabela(tabela, tipo).map(Number)
  if (!existentes.length) return null
  const inferiores = existentes.filter(e => e <= eixos)
  return String(inferiores.length ? Math.max(...inferiores) : Math.min(...existentes))
}

export interface EntradaPiso {
  tipo: string
  eixos: number
  distanciaKm: number
  composicao: boolean
  altoDesempenho: boolean
  retornoVazio: boolean
}

export interface ResultadoPiso {
  tabela: TabelaId
  eixosUsados: string
  ccd: number
  cc: number
  ida: number
  retorno: number
  total: number
}

const centavos = (v: number) => Math.round(v * 100) / 100

export function calcularPiso(e: EntradaPiso): ResultadoPiso | null {
  const tabela = tabelaDaOperacao(e.composicao, e.altoDesempenho)
  const eixosUsados = eixosAplicados(tabela, e.tipo, e.eixos)
  const linha = linhaTabela(tabela, e.tipo)
  if (!eixosUsados || !linha) return null
  const ccd = linha.coeficientes.ccd[eixosUsados]
  const cc = linha.coeficientes.cc[eixosUsados]
  const km = Math.max(0, e.distanciaKm)
  // Coeficientes têm até 4 casas: trabalha em décimos de milésimo para não
  // acumular erro de ponto flutuante.
  const ccdInt = Math.round(ccd * 10000)
  const ccInt = Math.round(cc * 10000)
  const idaInt = ccdInt * km + ccInt
  const retornoInt = e.retornoVazio ? (92 * ccdInt * km) / 100 : 0
  // A calculadora oficial arredonda só o total (conferido em 21/11/2026);
  // o retorno mostrado é a diferença, para as parcelas somarem o total.
  const total = centavos((idaInt + retornoInt) / 10000)
  const ida = centavos(idaInt / 10000)
  return { tabela, eixosUsados, ccd, cc, ida, retorno: centavos(total - ida), total }
}

export const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const coeficiente = (v: number, casas: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
