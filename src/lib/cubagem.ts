// Cubagem de madeira: volume de toras (geométrico/Smalian ou Francon) e de
// madeira serrada. Medidas de entrada: diâmetro, circunferência, espessura e
// largura em cm (ou polegada na serrada); comprimento sempre em metros.

export type MetodoTora = 'smalian' | 'francon'

export const METODOS_TORA: Record<MetodoTora, { titulo: string; resumo: string }> = {
  smalian: {
    titulo: 'Geométrico (Smalian)',
    resumo: 'Média das áreas da base e do topo × comprimento. Volume real da tora, o mais usado no controle florestal e nos romaneios.',
  },
  francon: {
    titulo: 'Francon',
    resumo: '(circunferência ÷ 4)² × comprimento. Volume comercial, cerca de 78,5% do volume geométrico, comum na compra de toras.',
  },
}

// Rendimento de referência tora → madeira serrada (CRV), Resolução CONAMA nº 411/2009, Anexo II.
export const CRV_SERRADA = 0.35

export const POLEGADA_CM = 2.54

// toPrecision tira o ruído de ponto flutuante (0,55125 vira 5512,4999... sem ele).
const casas4 = (v: number) => Math.round(Number((v * 10000).toPrecision(12))) / 10000

// Lê número digitado com vírgula ou ponto. Vazio ou inválido → null.
export function lerNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, '')
  if (!limpo) return null
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  const v = Number(normal)
  return Number.isFinite(v) && v >= 0 ? v : null
}

const areaCirculo = (diametroM: number) => (Math.PI * diametroM * diametroM) / 4

// Smalian com até duas medidas cruzadas em cada ponta (d1/d2 na base, d3/d4
// no topo), como no GFLONA. A segunda medida de cada ponta é opcional.
export function volumeSmalian(d: { d1: number | null; d2: number | null; d3: number | null; d4: number | null }, comprimentoM: number | null): number | null {
  if (!d.d1 || !d.d3 || !comprimentoM) return null
  const base = (d.d1 + (d.d2 || d.d1)) / 2 / 100
  const topo = (d.d3 + (d.d4 || d.d3)) / 2 / 100
  return casas4(((areaCirculo(base) + areaCirculo(topo)) / 2) * comprimentoM)
}

// Francon: circunferência média (no meio da tora), em cm.
export function volumeFrancon(circunferenciaCm: number | null, comprimentoM: number | null): number | null {
  if (!circunferenciaCm || !comprimentoM) return null
  const quarto = circunferenciaCm / 100 / 4
  return casas4(quarto * quarto * comprimentoM)
}

export type UnidadeSecao = 'cm' | 'pol'

// Volume de um lote de peças serradas: espessura × largura × comprimento × peças.
export function volumeSerrada(espessura: number | null, largura: number | null, comprimentoM: number | null, pecas: number | null, unidade: UnidadeSecao): number | null {
  if (!espessura || !largura || !comprimentoM || !pecas) return null
  const fator = unidade === 'pol' ? POLEGADA_CM / 100 : 1 / 100
  return casas4(espessura * fator * largura * fator * comprimentoM * pecas)
}

export const m3 = (v: number, casas = 4) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

export const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
