// Estado do romaneio (aninhado: blocos → linhas) e os totais derivados dele.
// Os campos são strings, como digitados; a conta só acontece na leitura.

import {
  METODOS_TORA, POLEGADA_CM, lerNumero, m3, reais, volumeFrancon, volumeSerrada, volumeSmalian,
  type MetodoTora, type UnidadeSecao,
} from '@/lib/cubagem'
import { CLASSES, classePeca, type Classe } from './classes'

export type Tipo = 'tora' | 'serrada'
export type Modelo = 'padrao' | 'largura' | 'livre'

export interface ToraLinha { id: number; d1: string; d2: string; d3: string; d4: string; circ: string; comp: string }
export interface ToraBloco { id: number; especie: string; preco: string; linhas: ToraLinha[] }

export interface PadraoLinha { id: number; comp: string; qtd: string; extra: boolean }
export interface PadraoBloco { id: number; bitola: string; largura: string; mult: string; linhas: PadraoLinha[] }

export interface LarguraLinha { id: number; comp: string; pecas: number[]; extra: boolean }
export interface LarguraBloco { id: number; bitola: string; linhas: LarguraLinha[] }

export interface LivreLinha { id: number; esp: string; larg: string; comp: string; qtd: string }

// Serrada: cada espécie guarda os três modelos; o modelo escolhido vale para todas.
export interface EspecieSerrada { id: number; especie: string; preco: string; padrao: PadraoBloco[]; largura: LarguraBloco[]; livre: LivreLinha[] }

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
  serradas: EspecieSerrada[]
  ativa: number
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

export const novaEspecieSerrada = (f: Faixa): EspecieSerrada => ({
  id: novoId(), especie: '', preco: '', padrao: [novoPadraoBloco(f)], largura: [novoLarguraBloco(f)], livre: [novaLivreLinha()],
})

export const especieAtiva = (e: Estado) => e.serradas.find(s => s.id === e.ativa) ?? e.serradas[0]
export const nomeEspecie = (nome: string, i: number) => nome.trim() || `Espécie ${i + 1}`
export const lerPreco = (t: string) => lerNumero(t.replace(/[R$\s]/g, ''))

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
  const serrada = novaEspecieSerrada(FAIXA_INICIAL)
  return {
    tipo: 'tora',
    modelo: 'padrao',
    metodo: 'smalian',
    duasMedidas: true,
    unidade: 'cm',
    faixa: FAIXA_INICIAL,
    preco: '',
    toras: [novoToraBloco()],
    serradas: [serrada],
    ativa: serrada.id,
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

export interface Parcial { id: number; nome: string; volume: number; quantidade: number; valor: number | null }
export interface Resumo { volume: number; quantidade: number; rotulo: string; valor: number | null; linhas: number; especies: Parcial[] }

const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const unidadeTxt = (u: UnidadeSecao) => (u === 'cm' ? 'cm' : 'pol')
const dinheiro = (v: number) => Math.round(Number((v * 100).toPrecision(12))) / 100

// Volumes (um por linha com resultado) e peças de uma espécie de serrada.
export function medirSerrada(s: EspecieSerrada, modelo: Modelo, u: UnidadeSecao): { vols: number[]; quantidade: number } {
  const vols: number[] = []
  let quantidade = 0
  if (modelo === 'padrao') {
    for (const b of s.padrao) for (const l of b.linhas) {
      const v = volPadrao(b, l, u)
      if (v) { vols.push(v); quantidade += pecasPadrao(b, l) }
    }
  } else if (modelo === 'largura') {
    for (const b of s.largura) for (const l of b.linhas) {
      const v = volLargura(b, l, u)
      if (v) { vols.push(v); quantidade += l.pecas.length }
    }
  } else {
    for (const l of s.livre) {
      const v = volLivre(l, u)
      if (v) { vols.push(v); quantidade += lerNumero(l.qtd) ?? 0 }
    }
  }
  return { vols, quantidade }
}

// Totais por espécie (o preço da espécie vale no lugar do preço geral) e da carga.
export function resumir(e: Estado): Resumo {
  const precoGeral = lerPreco(e.preco)
  const fontes = e.tipo === 'tora'
    ? e.toras.map(b => {
      const vols = b.linhas.map(l => volTora(l, e.metodo, e.duasMedidas)).filter((v): v is number => !!v)
      return { id: b.id, especie: b.especie, preco: b.preco, vols, quantidade: vols.length }
    })
    : e.serradas.map(s => ({ id: s.id, especie: s.especie, preco: s.preco, ...medirSerrada(s, e.modelo, e.unidade) }))
  let linhas = 0
  const especies = fontes.map((f, i): Parcial => {
    linhas += f.vols.length
    const volume = somar(f.vols)
    const preco = lerPreco(f.preco) || precoGeral
    return { id: f.id, nome: nomeEspecie(f.especie, i), volume, quantidade: f.quantidade, valor: preco && volume ? dinheiro(volume * preco) : null }
  })
  const comValor = especies.filter(p => p.valor !== null)
  return {
    volume: somar(especies.map(p => p.volume)),
    quantidade: especies.reduce((t, p) => t + p.quantidade, 0),
    rotulo: e.tipo === 'tora' ? 'Toras' : 'Peças',
    valor: comValor.length ? dinheiro(comValor.reduce((t, p) => t + p.valor!, 0)) : null,
    linhas,
    especies,
  }
}

// ─── Classes (prancha, viga, caibro…) ───────────────────────────────────────

export interface LinhaClasse { especie: number; classe: Classe; medidas: string; pecas: number; volume: number }

// Peças de uma espécie com a seção como digitada (na unidade do romaneio).
function secoesSerrada(s: EspecieSerrada, modelo: Modelo, u: UnidadeSecao) {
  const out: { a: number; b: number; pecas: number; vol: number }[] = []
  if (modelo === 'padrao') {
    for (const b of s.padrao) for (const l of b.linhas) {
      const vol = volPadrao(b, l, u)
      if (vol) out.push({ a: lerNumero(b.bitola)!, b: lerNumero(b.largura)!, pecas: pecasPadrao(b, l), vol })
    }
  } else if (modelo === 'largura') {
    for (const b of s.largura) for (const l of b.linhas) {
      if (!volLargura(b, l, u)) continue
      const bit = lerNumero(b.bitola)!
      for (const c of classificar(l)) {
        out.push({ a: bit, b: c.largura, pecas: c.qtd, vol: (volumeSerrada(bit, c.largura, lerNumero(l.comp), 1, u) ?? 0) * c.qtd })
      }
    }
  } else {
    for (const l of s.livre) {
      const vol = volLivre(l, u)
      if (vol) out.push({ a: lerNumero(l.esp)!, b: lerNumero(l.larg)!, pecas: lerNumero(l.qtd) ?? 0, vol })
    }
  }
  return out
}

// "5 × 20/25" ou, com muitas larguras (largura aberta), "5 × 21 a 30".
function descreverMedidas(secoes: Map<number, Set<number>>): string {
  return Array.from(secoes).sort((x, y) => x[0] - y[0]).map(([esp, largs]) => {
    const ls = Array.from(largs).sort((x, y) => x - y)
    return `${num(esp)} × ${ls.length > 3 ? `${num(ls[0])} a ${num(ls[ls.length - 1])}` : ls.map(num).join('/')}`
  }).join('; ')
}

// Peças e volume por classe, espécie a espécie (só madeira serrada).
export function porClasse(e: Estado): LinhaClasse[] {
  if (e.tipo !== 'serrada') return []
  const cm = e.unidade === 'pol' ? POLEGADA_CM : 1
  return e.serradas.flatMap(s => {
    const grupos = new Map<Classe, { secoes: Map<number, Set<number>>; pecas: number; vols: number[] }>()
    for (const p of secoesSerrada(s, e.modelo, e.unidade)) {
      const classe = classePeca(p.a * cm, p.b * cm)
      const g = grupos.get(classe) ?? { secoes: new Map<number, Set<number>>(), pecas: 0, vols: [] as number[] }
      const [esp, larg] = p.a <= p.b ? [p.a, p.b] : [p.b, p.a]
      g.secoes.set(esp, (g.secoes.get(esp) ?? new Set()).add(larg))
      g.pecas += p.pecas
      g.vols.push(p.vol)
      grupos.set(classe, g)
    }
    return CLASSES.filter(c => grupos.has(c)).map(c => {
      const g = grupos.get(c)!
      return { especie: s.id, classe: c, medidas: descreverMedidas(g.secoes), pecas: g.pecas, volume: somar(g.vols) }
    })
  })
}

// Soma as classes de todas as espécies.
export function totalPorClasse(linhas: LinhaClasse[]): { classe: Classe; pecas: number; volume: number }[] {
  return CLASSES.map(classe => {
    const ls = linhas.filter(l => l.classe === classe)
    return { classe, pecas: ls.reduce((t, l) => t + l.pecas, 0), volume: somar(ls.map(l => l.volume)) }
  }).filter(c => c.pecas || c.volume)
}

export const TITULO_MODELO: Record<Modelo, string> = { padrao: 'padrão', largura: 'largura aberta', livre: 'lista' }

export function tituloRomaneio(e: Estado): string {
  return e.tipo === 'tora'
    ? `Romaneio de toras · ${METODOS_TORA[e.metodo].titulo}`
    : `Romaneio de madeira serrada · ${TITULO_MODELO[e.modelo]} (${unidadeTxt(e.unidade)})`
}

// Espécies com volume e se vale mostrar o nome delas (mais de uma, ou nome preenchido).
export function especiesUsadas(e: Estado, r: Resumo): { usadas: Parcial[]; comTitulo: boolean } {
  const usadas = r.especies.filter(p => p.volume)
  const nomes = (e.tipo === 'tora' ? e.toras : e.serradas).filter(x => usadas.some(p => p.id === x.id)).some(x => x.especie.trim())
  return { usadas, comTitulo: usadas.length > 1 || nomes }
}

export const unidadeQtd = (tora: boolean, n: number) => (tora ? (n === 1 ? 'tora' : 'toras') : (n === 1 ? 'peça' : 'peças'))

function textoSerrada(s: EspecieSerrada, e: Estado): string[] {
  const out: string[] = []
  const u = unidadeTxt(e.unidade)
  if (e.modelo === 'padrao') {
    for (const b of s.padrao) {
      const linhas = b.linhas.map(l => ({ l, v: volPadrao(b, l, e.unidade) })).filter(x => x.v)
      if (!linhas.length) continue
      const mult = multPadrao(b)
      out.push(`${b.bitola} × ${b.largura} ${u}${mult > 1 ? ` (pacotes de ${mult} pç)` : ''}`)
      for (const { l, v } of linhas) out.push(`${l.comp} m: ${l.qtd}${mult > 1 ? ' pct' : ' pç'} = ${m3(v!)} m³`)
    }
  } else if (e.modelo === 'largura') {
    for (const b of s.largura) {
      const linhas = b.linhas.filter(l => volLargura(b, l, e.unidade))
      if (!linhas.length) continue
      out.push(`Bitola ${b.bitola} ${u}`)
      for (const l of linhas) {
        out.push(`${l.comp} m: ${classificar(l).map(c => `${c.qtd}× ${num(c.largura)}`).join(', ')} = ${m3(volLargura(b, l, e.unidade)!)} m³`)
      }
    }
  } else {
    s.livre.filter(l => volLivre(l, e.unidade)).forEach((l, i) => {
      out.push(`${i + 1}. ${l.qtd} pç ${l.esp} × ${l.larg} ${u} × ${l.comp} m = ${m3(volLivre(l, e.unidade)!)} m³`)
    })
  }
  return out
}

export function textoRomaneio(e: Estado, r: Resumo): string {
  const tora = e.tipo === 'tora'
  const out: string[] = [tituloRomaneio(e)]
  const { usadas, comTitulo } = especiesUsadas(e, r)
  for (const p of usadas) {
    out.push('')
    if (comTitulo) out.push(`*${p.nome}*`)
    if (tora) {
      const b = e.toras.find(x => x.id === p.id)!
      b.linhas.map(l => ({ l, v: volTora(l, e.metodo, e.duasMedidas) })).filter(x => x.v).forEach(({ l, v }, i) => {
        const medidas = e.metodo === 'francon'
          ? `circ. ${l.circ} cm`
          : `base ${[l.d1, e.duasMedidas ? l.d2 : ''].filter(Boolean).join('/')} · topo ${[l.d3, e.duasMedidas ? l.d4 : ''].filter(Boolean).join('/')} cm`
        out.push(`${i + 1}. ${medidas} · ${l.comp} m = ${m3(v!)} m³`)
      })
    } else {
      out.push(...textoSerrada(e.serradas.find(x => x.id === p.id)!, e))
    }
    if (comTitulo) out.push(`Subtotal: ${p.quantidade} ${unidadeQtd(tora, p.quantidade)}, ${m3(p.volume)} m³${p.valor !== null ? `, ${reais(p.valor)}` : ''}`)
  }
  const classes = totalPorClasse(porClasse(e))
  if (classes.length) {
    out.push('', '*Por classe*')
    for (const c of classes) out.push(`${c.classe}: ${c.pecas} ${unidadeQtd(false, c.pecas)}, ${m3(c.volume)} m³`)
  }
  out.push('', `Total: ${r.quantidade} ${unidadeQtd(tora, r.quantidade)}, ${m3(r.volume)} m³`)
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
  const lerSerrada = (b: Record<string, unknown>, comNome: boolean): EspecieSerrada => {
    const padrao = arr(b.padrao, 50).map(x => ({
      id: novoId(), bitola: txt(x.bitola), largura: txt(x.largura), mult: txt(x.mult),
      linhas: arr(x.linhas, 80).map(l => ({ id: novoId(), comp: txt(l.comp), qtd: txt(l.qtd), extra: l.extra === true })),
    })).filter(x => x.linhas.length)
    const largura = arr(b.largura, 50).map(x => ({
      id: novoId(), bitola: txt(x.bitola),
      linhas: arr(x.linhas, 80).map(l => ({
        id: novoId(), comp: txt(l.comp), extra: l.extra === true,
        pecas: Array.isArray(l.pecas) ? l.pecas.slice(0, 2000).filter((p): p is number => typeof p === 'number' && p > 0 && p < 10000) : [],
      })),
    })).filter(x => x.linhas.length)
    const livre = arr(b.livre, 500).map(l => ({ id: novoId(), esp: txt(l.esp), larg: txt(l.larg), comp: txt(l.comp), qtd: txt(l.qtd) }))
    return {
      id: novoId(),
      especie: comNome ? txt(b.especie, 60) : '',
      preco: comNome ? txt(b.preco, 14) : '',
      padrao: padrao.length ? padrao : [novoPadraoBloco(faixa)],
      largura: largura.length ? largura : [novoLarguraBloco(faixa)],
      livre: livre.length ? livre : [novaLivreLinha()],
    }
  }
  // Versão anterior: uma só serrada, com os blocos no topo do estado.
  const brutas = Array.isArray(s.serradas) ? arr(s.serradas, 30) : null
  const serradas = brutas?.length ? brutas.map(b => lerSerrada(b, true)) : [lerSerrada(s, false)]
  const iAtiva = brutas ? brutas.findIndex(b => b.id === s.ativa) : -1
  return {
    tipo: s.tipo === 'serrada' ? 'serrada' : 'tora',
    modelo: s.modelo === 'largura' || s.modelo === 'livre' ? s.modelo : 'padrao',
    metodo: s.metodo === 'francon' ? 'francon' : 'smalian',
    duasMedidas: s.duasMedidas !== false,
    unidade: s.unidade === 'pol' ? 'pol' : 'cm',
    faixa,
    preco: txt(s.preco, 14),
    toras: toras.length ? toras : base.toras,
    serradas,
    ativa: serradas[Math.max(0, iAtiva)].id,
  }
}
