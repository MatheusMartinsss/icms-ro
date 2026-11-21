// Estado do romaneio (aninhado: blocos → linhas) e os totais derivados dele.
// Os campos são strings, como digitados; a conta só acontece na leitura.

import {
  METODOS_TORA, lerNumero, m3, reais, volumeFrancon, volumeSerrada, volumeSmalian,
  type MetodoTora, type UnidadeSecao,
} from '@/lib/cubagem'

export type Tipo = 'tora' | 'serrada'
export type Modelo = 'padrao' | 'largura' | 'livre'

export interface ToraLinha { id: number; d1: string; d2: string; d3: string; d4: string; circ: string; comp: string }
export interface ToraBloco { id: number; especie: string; preco: string; linhas: ToraLinha[] }

export interface PadraoLinha { id: number; comp: string; qtd: string; extra: boolean }
export interface PadraoBloco { id: number; bitola: string; largura: string; mult: string; linhas: PadraoLinha[] }

export interface LarguraLinha { id: number; comp: string; pecas: number[]; extra: boolean }
export interface LarguraBloco { id: number; bitola: string; linhas: LarguraLinha[] }

export interface LivreLinha { id: number; esp: string; larg: string; comp: string; qtd: string }

export interface Faixa { espacamento: string; de: string; ate: string }

export interface Estado {
  tipo: Tipo
  modelo: Modelo
  metodo: MetodoTora
  duasMedidas: boolean
  unidade: UnidadeSecao
  faixa: Faixa
  preco: string
  toras: ToraBloco[]
  padrao: PadraoBloco[]
  largura: LarguraBloco[]
  livre: LivreLinha[]
}

let seq = 0
export const novoId = () => ++seq

export const FAIXA_INICIAL: Faixa = { espacamento: '0,50', de: '1,00', ate: '8,00' }

const fmtComp = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const chaveComp = (c: string) => {
  const v = lerNumero(c)
  return v === null ? `?${c}` : v.toFixed(3)
}

// Comprimentos de "de" até "ate" a cada "espacamento" (no máximo 60 linhas).
export function comprimentosDaFaixa(f: Faixa): string[] {
  const esp = lerNumero(f.espacamento)
  const de = lerNumero(f.de)
  const ate = lerNumero(f.ate)
  if (!esp || de === null || ate === null || ate < de) return []
  const passos = Math.min(60, Math.round((ate - de) / esp) + 1)
  return Array.from({ length: passos }, (_, i) => fmtComp(Math.round((de + i * esp) * 1000) / 1000))
}

export const novaToraLinha = (): ToraLinha => ({ id: novoId(), d1: '', d2: '', d3: '', d4: '', circ: '', comp: '' })
export const novoToraBloco = (): ToraBloco => ({ id: novoId(), especie: '', preco: '', linhas: [novaToraLinha()] })

export const novaPadraoLinha = (comp = '', extra = false): PadraoLinha => ({ id: novoId(), comp, qtd: '', extra })
export const novoPadraoBloco = (f: Faixa, bitola = ''): PadraoBloco => ({
  id: novoId(), bitola, largura: '', mult: '', linhas: comprimentosDaFaixa(f).map(c => novaPadraoLinha(c)),
})

export const novaLarguraLinha = (comp = '', extra = false): LarguraLinha => ({ id: novoId(), comp, pecas: [], extra })
export const novoLarguraBloco = (f: Faixa, bitola = ''): LarguraBloco => ({
  id: novoId(), bitola, linhas: comprimentosDaFaixa(f).map(c => novaLarguraLinha(c)),
})

export const novaLivreLinha = (base?: LivreLinha): LivreLinha => ({ id: novoId(), esp: base?.esp ?? '', larg: base?.larg ?? '', comp: '', qtd: '' })

// Troca os comprimentos gerados mantendo o que já foi digitado; linhas com
// valor fora da nova faixa continuam, como extras.
export function aplicarFaixa<T extends { comp: string; extra: boolean }>(linhas: T[], comps: string[], nova: (comp: string) => T, temValor: (l: T) => boolean): T[] {
  const porComp = new Map(linhas.map(l => [chaveComp(l.comp), l]))
  const usados = new Set(comps.map(chaveComp))
  const geradas = comps.map(c => {
    const l = porComp.get(chaveComp(c))
    return l ? { ...l, extra: false } : nova(c)
  })
  const extras = linhas.filter(l => !usados.has(chaveComp(l.comp)) && (temValor(l) || (l.extra && !l.comp)))
    .map(l => ({ ...l, extra: true }))
  return [...geradas, ...extras].sort((a, b) => (lerNumero(a.comp) ?? Infinity) - (lerNumero(b.comp) ?? Infinity))
}

export function estadoInicial(): Estado {
  return {
    tipo: 'tora',
    modelo: 'padrao',
    metodo: 'smalian',
    duasMedidas: true,
    unidade: 'cm',
    faixa: FAIXA_INICIAL,
    preco: '',
    toras: [novoToraBloco()],
    padrao: [novoPadraoBloco(FAIXA_INICIAL)],
    largura: [novoLarguraBloco(FAIXA_INICIAL)],
    livre: [novaLivreLinha()],
  }
}

// ─── Volumes ────────────────────────────────────────────────────────────────

export function volTora(l: ToraLinha, metodo: MetodoTora, duasMedidas: boolean): number | null {
  const comp = lerNumero(l.comp)
  if (metodo === 'francon') return volumeFrancon(lerNumero(l.circ), comp)
  return volumeSmalian({
    d1: lerNumero(l.d1), d2: duasMedidas ? lerNumero(l.d2) : null,
    d3: lerNumero(l.d3), d4: duasMedidas ? lerNumero(l.d4) : null,
  }, comp)
}

export const multPadrao = (b: PadraoBloco) => Math.max(1, Math.floor(lerNumero(b.mult) ?? 1) || 1)
export const pecasPadrao = (b: PadraoBloco, l: PadraoLinha) => (lerNumero(l.qtd) ?? 0) * multPadrao(b)
export const volPadrao = (b: PadraoBloco, l: PadraoLinha, u: UnidadeSecao) =>
  volumeSerrada(lerNumero(b.bitola), lerNumero(b.largura), lerNumero(l.comp), pecasPadrao(b, l) || null, u)

// Largura aberta: cada peça arredondada em 4 casas, como no GFLONA.
export function volLargura(b: LarguraBloco, l: LarguraLinha, u: UnidadeSecao): number | null {
  const bit = lerNumero(b.bitola)
  const comp = lerNumero(l.comp)
  if (!bit || !comp || !l.pecas.length) return null
  return somar(l.pecas.map(larg => volumeSerrada(bit, larg, comp, 1, u) ?? 0))
}

export const volLivre = (l: LivreLinha, u: UnidadeSecao) =>
  volumeSerrada(lerNumero(l.esp), lerNumero(l.larg), lerNumero(l.comp), lerNumero(l.qtd), u)

export const somar = (vs: (number | null)[]) =>
  Math.round(Number((vs.reduce<number>((s, v) => s + (v ?? 0), 0) * 10000).toPrecision(12))) / 10000

// Agrupa as peças de uma linha de largura aberta por largura.
export function classificar(l: LarguraLinha): { largura: number; qtd: number }[] {
  const mapa = new Map<number, number>()
  for (const p of l.pecas) mapa.set(p, (mapa.get(p) ?? 0) + 1)
  return Array.from(mapa, ([largura, qtd]) => ({ largura, qtd })).sort((a, b) => a.largura - b.largura)
}

// ─── Resumo e texto para copiar ─────────────────────────────────────────────

export interface Resumo { volume: number; quantidade: number; rotulo: string; valor: number | null; linhas: number }

const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const unidadeTxt = (u: UnidadeSecao) => (u === 'cm' ? 'cm' : 'pol')

export function resumir(e: Estado): Resumo {
  const preco = lerNumero(e.preco.replace(/[R$\s]/g, ''))
  const dinheiro = (v: number) => Math.round(Number((v * 100).toPrecision(12))) / 100
  if (e.tipo === 'tora') {
    let volume = 0
    let quantidade = 0
    let valor = 0
    let temValor = false
    for (const b of e.toras) {
      const vols = b.linhas.map(l => volTora(l, e.metodo, e.duasMedidas)).filter((v): v is number => !!v)
      const vb = somar(vols)
      volume = somar([volume, vb])
      quantidade += vols.length
      const p = lerNumero(b.preco.replace(/[R$\s]/g, '')) || preco
      if (p && vb) { valor += vb * p; temValor = true }
    }
    return { volume, quantidade, rotulo: 'Toras', valor: temValor ? dinheiro(valor) : null, linhas: quantidade }
  }
  let vols: (number | null)[] = []
  let quantidade = 0
  if (e.modelo === 'padrao') {
    for (const b of e.padrao) for (const l of b.linhas) {
      const v = volPadrao(b, l, e.unidade)
      if (v) { vols.push(v); quantidade += pecasPadrao(b, l) }
    }
  } else if (e.modelo === 'largura') {
    for (const b of e.largura) for (const l of b.linhas) {
      const v = volLargura(b, l, e.unidade)
      if (v) { vols.push(v); quantidade += l.pecas.length }
    }
  } else {
    vols = e.livre.map(l => volLivre(l, e.unidade))
    quantidade = e.livre.reduce((s, l) => s + (volLivre(l, e.unidade) ? lerNumero(l.qtd) ?? 0 : 0), 0)
  }
  const volume = somar(vols)
  return { volume, quantidade, rotulo: 'Peças', valor: preco && volume ? dinheiro(volume * preco) : null, linhas: vols.filter(Boolean).length }
}

export function textoRomaneio(e: Estado, r: Resumo): string {
  const out: string[] = []
  const u = unidadeTxt(e.unidade)
  if (e.tipo === 'tora') {
    out.push(`Romaneio de toras · ${METODOS_TORA[e.metodo].titulo}`)
    e.toras.forEach((b, bi) => {
      const linhas = b.linhas.map(l => ({ l, v: volTora(l, e.metodo, e.duasMedidas) })).filter(x => x.v)
      if (!linhas.length) return
      out.push('', b.especie.trim() || `Espécie ${bi + 1}`)
      linhas.forEach(({ l, v }, i) => {
        const medidas = e.metodo === 'francon'
          ? `circ. ${l.circ} cm`
          : `base ${[l.d1, e.duasMedidas ? l.d2 : ''].filter(Boolean).join('/')} · topo ${[l.d3, e.duasMedidas ? l.d4 : ''].filter(Boolean).join('/')} cm`
        out.push(`${i + 1}. ${medidas} · ${l.comp} m = ${m3(v!)} m³`)
      })
      out.push(`Subtotal: ${linhas.length} ${linhas.length === 1 ? "tora" : "toras"}, ${m3(somar(linhas.map(x => x.v)))} m³`)
    })
  } else if (e.modelo === 'padrao') {
    out.push(`Romaneio de madeira serrada · padrão (${u})`)
    for (const b of e.padrao) {
      const linhas = b.linhas.map(l => ({ l, v: volPadrao(b, l, e.unidade) })).filter(x => x.v)
      if (!linhas.length) continue
      const mult = multPadrao(b)
      out.push('', `${b.bitola} × ${b.largura} ${u}${mult > 1 ? ` (pacotes de ${mult} pç)` : ''}`)
      for (const { l, v } of linhas) out.push(`${l.comp} m: ${l.qtd}${mult > 1 ? ' pct' : ' pç'} = ${m3(v!)} m³`)
    }
  } else if (e.modelo === 'largura') {
    out.push(`Romaneio de madeira serrada · largura aberta (${u})`)
    for (const b of e.largura) {
      const linhas = b.linhas.filter(l => volLargura(b, l, e.unidade))
      if (!linhas.length) continue
      out.push('', `Bitola ${b.bitola} ${u}`)
      for (const l of linhas) {
        out.push(`${l.comp} m: ${classificar(l).map(c => `${c.qtd}× ${num(c.largura)}`).join(', ')} = ${m3(volLargura(b, l, e.unidade)!)} m³`)
      }
    }
  } else {
    out.push(`Romaneio de madeira serrada (${u})`)
    e.livre.forEach((l, i) => {
      const v = volLivre(l, e.unidade)
      if (v) out.push(`${i + 1}. ${l.qtd} pç ${l.esp} × ${l.larg} ${u} × ${l.comp} m = ${m3(v)} m³`)
    })
  }
  out.push('', `Total: ${r.quantidade} ${e.tipo === 'tora' ? 'toras' : 'peças'}, ${m3(r.volume)} m³`)
  if (r.valor) out.push(`Valor: ${reais(r.valor)}`)
  out.push('Calculado em geraguia.com.br/cubagem-madeira')
  return out.join('\n')
}

// ─── Leitura do que ficou salvo no navegador ────────────────────────────────

const txt = (v: unknown, max = 12) => (typeof v === 'string' ? v.slice(0, max) : '')
const arr = (v: unknown, max: number): Record<string, unknown>[] =>
  Array.isArray(v) ? v.slice(0, max).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []

export function restaurar(bruto: unknown): Estado | null {
  if (!bruto || typeof bruto !== 'object') return null
  const s = bruto as Record<string, unknown>
  const base = estadoInicial()
  const faixaS = (s.faixa ?? {}) as Record<string, unknown>
  const faixa: Faixa = {
    espacamento: txt(faixaS.espacamento) || base.faixa.espacamento,
    de: txt(faixaS.de) || base.faixa.de,
    ate: txt(faixaS.ate) || base.faixa.ate,
  }
  const toras = arr(s.toras, 50).map(b => ({
    id: novoId(), especie: txt(b.especie, 60), preco: txt(b.preco, 14),
    linhas: arr(b.linhas, 500).map(l => ({
      id: novoId(), d1: txt(l.d1), d2: txt(l.d2), d3: txt(l.d3), d4: txt(l.d4), circ: txt(l.circ), comp: txt(l.comp),
    })),
  })).filter(b => b.linhas.length)
  const padrao = arr(s.padrao, 50).map(b => ({
    id: novoId(), bitola: txt(b.bitola), largura: txt(b.largura), mult: txt(b.mult),
    linhas: arr(b.linhas, 80).map(l => ({ id: novoId(), comp: txt(l.comp), qtd: txt(l.qtd), extra: l.extra === true })),
  })).filter(b => b.linhas.length)
  const largura = arr(s.largura, 50).map(b => ({
    id: novoId(), bitola: txt(b.bitola),
    linhas: arr(b.linhas, 80).map(l => ({
      id: novoId(), comp: txt(l.comp), extra: l.extra === true,
      pecas: Array.isArray(l.pecas) ? l.pecas.slice(0, 2000).filter((p): p is number => typeof p === 'number' && p > 0 && p < 10000) : [],
    })),
  })).filter(b => b.linhas.length)
  const livre = arr(s.livre, 500).map(l => ({ id: novoId(), esp: txt(l.esp), larg: txt(l.larg), comp: txt(l.comp), qtd: txt(l.qtd) }))
  return {
    tipo: s.tipo === 'serrada' ? 'serrada' : 'tora',
    modelo: s.modelo === 'largura' || s.modelo === 'livre' ? s.modelo : 'padrao',
    metodo: s.metodo === 'francon' ? 'francon' : 'smalian',
    duasMedidas: s.duasMedidas !== false,
    unidade: s.unidade === 'pol' ? 'pol' : 'cm',
    faixa,
    preco: txt(s.preco, 14),
    toras: toras.length ? toras : base.toras,
    padrao: padrao.length ? padrao : [novoPadraoBloco(faixa)],
    largura: largura.length ? largura : [novoLarguraBloco(faixa)],
    livre: livre.length ? livre : base.livre,
  }
}
