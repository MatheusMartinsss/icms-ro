import Piso from '@/app/piso-antt.json'

// Valores monetários internos em 1/10000 de real, como a calculadora já fazia,
// para não acumular erro de ponto flutuante.
export const SCALE = 10000

export const TIPOS_CARGA: { value: string; label: string }[] = [
  { value: 'geral', label: 'Geral' },
  { value: 'granel_solido', label: 'Granel Sólido' },
  { value: 'granel_liquido', label: 'Granel Líquido' },
  { value: 'frigorificada_aquecida', label: 'Frigorificada ou Aquecida' },
  { value: 'conteinerizada', label: 'Conteinerizada' },
  { value: 'neogranel', label: 'Neogranel' },
  { value: 'perigosa_granel_solido', label: 'Perigosa Granel Sólido' },
  { value: 'perigosa_granel_liquido', label: 'Perigosa Granel Líquido' },
  { value: 'perigosa_frigorificada_aquecida', label: 'Perigosa Frigorificada ou Aquecida' },
  { value: 'perigosa_conteinerizada', label: 'Perigosa Conteinerizada' },
  { value: 'perigosa_carga_geral', label: 'Perigosa Carga Geral' },
  { value: 'carga_granel_pressurizada', label: 'Carga Granel Pressurizada' },
]

type Coeficientes = Record<string, number>
// Tabela A da ANTT (carga lotação), a mesma da pauta do ICMS frete de RO.
const tabela = Piso.tabelas.A as { tipo: string; coeficientes: { ccd: Coeficientes; cc: Coeficientes } }[]

// Só oferece as quantidades de eixos que existem na tabela da ANTT para o
// tipo de carga. Antes a tela mostrava "8 eixos", que não tem coeficiente.
export function eixosDisponiveis(tipoCarga: string): string[] {
  const data = tabela.find(item => item.tipo === tipoCarga)
  if (!data) return []
  return Object.keys(data.coeficientes.ccd)
    .filter(eixo => data.coeficientes.cc[eixo] !== undefined)
    .sort((a, b) => Number(a) - Number(b))
}

export function calcularBaseTotal(tipoCarga: string, eixos: string, distanciaKm: string | number) {
  const data = tabela.find(item => item.tipo === tipoCarga)
  if (!data) return null
  const ccd = data.coeficientes.ccd[eixos]
  const cc = data.coeficientes.cc[eixos]
  if (ccd === undefined || cc === undefined) return null

  const ccdInt = Math.round(Number(ccd) * SCALE)
  const ccInt = Math.round(Number(cc) * SCALE)
  const distanciaInt = Math.round(Number(distanciaKm) || 0)
  return { totalInt: ccdInt * distanciaInt + ccInt, ccdInt, ccInt }
}

export interface ParametrosFiscais {
  aliquotaIcms: number
  percentualReducao: number
}

export const PARAMETROS_PADRAO: ParametrosFiscais = { aliquotaIcms: 12, percentualReducao: 20 }

export function calcularIcms(baseInt: number, { aliquotaIcms, percentualReducao }: ParametrosFiscais) {
  const icms = Math.round((baseInt * aliquotaIcms) / 100)
  const reducao = Math.round((icms * percentualReducao) / 100)
  return { icms, reducao, icmsReduzido: icms - reducao }
}

export const formatReais = (value: number) =>
  (value / SCALE).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const formatPercent = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

// Valor em reais com 2 casas, como vai para a guia.
export const paraReais = (valueInt: number) => Math.round(valueInt / 100) / 100

export function textoBaseCalculo(
  r: { base: number; icms: number; icmsReduzido: number },
  { aliquotaIcms, percentualReducao }: ParametrosFiscais,
) {
  const inicio = `BC ${formatReais(r.base)} x ${formatPercent(aliquotaIcms)}% = ${formatReais(r.icms)}`
  if (!percentualReducao) return inicio
  return `${inicio} - RED. DE ${formatPercent(percentualReducao)}% = ${formatReais(r.icmsReduzido)}`
}
