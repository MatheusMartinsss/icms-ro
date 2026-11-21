// Leitura do XML da NF-e no navegador (DOMParser). Nada é enviado ao servidor:
// o XML só preenche o formulário do FETHAB.

import { PRODUTOS, type ProdutoFethab, type Unidade } from '@/lib/fethab'

export interface ParteNfe {
  tipoDocumento: 'cnpj' | 'cpf' | null
  documento: string | null
  ie: string | null
  nome: string
  municipio: string | null
  uf: string | null
}

export interface ItemNfe {
  descricao: string
  ncm: string
  cfop: string
  unidade: string
  quantidade: number
  unidadeTributavel: string
  quantidadeTributavel: number
}

export interface NotaNfe {
  chave: string
  numero: string
  serie: string
  emissao: string // AAAA-MM-DD
  saida: boolean
  emitente: ParteNfe
  destinatario: ParteNfe | null
  itens: ItemNfe[]
}

const filho = (el: Element | null | undefined, tag: string) =>
  (el ? Array.from(el.children).find(c => c.localName === tag) : undefined) ?? null

const texto = (el: Element | null | undefined, ...caminho: string[]) => {
  let atual: Element | null = el ?? null
  for (const tag of caminho) atual = filho(atual, tag)
  return atual?.textContent?.trim() || ''
}

function lerParte(el: Element | null, endereco: string): ParteNfe | null {
  if (!el) return null
  const cnpj = texto(el, 'CNPJ')
  const cpf = texto(el, 'CPF')
  const ie = texto(el, 'IE')
  return {
    tipoDocumento: cnpj ? 'cnpj' : cpf ? 'cpf' : null,
    documento: cnpj || cpf || null,
    ie: ie && /^\d+$/.test(ie) ? ie : null,
    nome: texto(el, 'xNome'),
    municipio: texto(el, endereco, 'xMun') || null,
    uf: texto(el, endereco, 'UF') || null,
  }
}

const numero = (s: string) => {
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

export function lerNfe(xml: string): NotaNfe {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('O arquivo não é um XML válido')

  const inf = Array.from(doc.getElementsByTagNameNS('*', 'infNFe'))[0]
  if (!inf) throw new Error('O XML não é de uma NF-e')

  const ide = filho(inf, 'ide')
  const chave = (inf.getAttribute('Id') || '').replace(/^NFe/, '')
  const emissao = (texto(ide, 'dhEmi') || texto(ide, 'dEmi')).slice(0, 10)

  const itens: ItemNfe[] = Array.from(inf.children)
    .filter(c => c.localName === 'det')
    .map(det => {
      const prod = filho(det, 'prod')
      return {
        descricao: texto(prod, 'xProd'),
        ncm: texto(prod, 'NCM'),
        cfop: texto(prod, 'CFOP'),
        unidade: texto(prod, 'uCom'),
        quantidade: numero(texto(prod, 'qCom')),
        unidadeTributavel: texto(prod, 'uTrib'),
        quantidadeTributavel: numero(texto(prod, 'qTrib')),
      }
    })

  const emitente = lerParte(filho(inf, 'emit'), 'enderEmit')
  if (!emitente) throw new Error('NF-e sem emitente')

  return {
    chave,
    numero: texto(ide, 'nNF'),
    serie: texto(ide, 'serie'),
    emissao,
    saida: texto(ide, 'tpNF') !== '0',
    emitente,
    destinatario: lerParte(filho(inf, 'dest'), 'enderDest'),
    itens,
  }
}

// Quem paga o FETHAB é o remetente da mercadoria. Na nota de saída é o
// emitente. Na nota de entrada (emitida pelo comprador) é o destinatário.
export const remetenteDa = (nota: NotaNfe) => (nota.saida ? nota.emitente : nota.destinatario) ?? nota.emitente

// ---------------------------------------------------------------------------
// NCM -> produto do FETHAB

const FEMEA = /\b(VACA|VACAS|NOVILHA|NOVILHAS|BEZERRA|BEZERRAS|FEMEA|FEMEAS|MATRIZ|MATRIZES)\b/

const semAcento = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()

export function produtoDoItem(item: ItemNfe): ProdutoFethab | null {
  const ncm = item.ncm.replace(/\D/g, '')
  const desc = semAcento(item.descricao)
  const id = (() => {
    if (ncm.startsWith('1201')) return 'soja'
    if (ncm === '10059010') return 'milho-pipoca'
    if (ncm.startsWith('1005')) return 'milho'
    if (ncm.startsWith('110423')) return 'milho-canjica'
    if (ncm.startsWith('5201') || ncm.startsWith('120721') || ncm.startsWith('120729')) return 'algodao'
    if (ncm.startsWith('071310')) return 'ervilha'
    if (ncm.startsWith('071320')) return 'grao-de-bico'
    if (ncm.startsWith('07133')) return 'feijao'
    if (ncm.startsWith('071340')) return 'lentilha'
    if (ncm.startsWith('071350')) return 'fava'
    if (ncm.startsWith('120740')) return 'gergelim'
    if (ncm.startsWith('120730')) return 'mamona'
    if (ncm.startsWith('100821') || ncm.startsWith('100829')) return /PAINCO/.test(desc) ? 'painco' : 'milheto'
    if (ncm.startsWith('1202')) return 'amendoim'
    if (ncm.startsWith('1001')) return 'trigo'
    if (ncm.startsWith('1206')) return 'girassol'
    if (ncm.startsWith('1006')) return 'arroz'
    if (ncm.startsWith('1007')) return 'sorgo'
    if (ncm.startsWith('0102')) return FEMEA.test(desc) ? 'gado-femea' : 'gado-macho'
    if (ncm.startsWith('44')) return 'madeira'
    return null
  })()
  return id ? PRODUTOS.find(p => p.id === id) ?? null : null
}

// Converte a quantidade da nota para a unidade do FETHAB (t, cabeça ou m³).
// Devolve null quando a unidade da nota não permite converter.
function converter(quantidade: number, unidadeNota: string, destino: Unidade): number | null {
  const u = semAcento(unidadeNota).replace('³', '3').replace(/[^A-Z0-9]/g, '')
  if (!u || !(quantidade > 0)) return null
  if (destino === 't') {
    if (['KG', 'KGS', 'KILO', 'KILOS', 'QUILO', 'QUILOS', 'KGM'].includes(u)) return quantidade / 1000
    if (['T', 'TN', 'TON', 'TONS', 'TONELADA', 'TONELADAS', 'TNE'].includes(u)) return quantidade
    if (['SC', 'SACA', 'SACAS', 'SC60', 'SACA60'].includes(u)) return quantidade * 0.06
    if (['ARROBA', 'ARROBAS', 'AR', 'ARR'].includes(u)) return quantidade * 0.015
    return null
  }
  if (destino === 'cabeca') {
    if (['CAB', 'CB', 'CABECA', 'CABECAS', 'UN', 'UND', 'UNID', 'UNIDADE', 'U', 'PC'].includes(u)) return quantidade
    return null
  }
  if (['M3', 'MT3', 'METROCUBICO', 'METROSCUBICOS'].includes(u)) return quantidade
  return null
}

export function quantidadeDoItem(item: ItemNfe, produto: ProdutoFethab) {
  return (
    converter(item.quantidadeTributavel, item.unidadeTributavel, produto.unidade) ??
    converter(item.quantidade, item.unidade, produto.unidade)
  )
}

export interface ProdutoDetectado {
  produto: ProdutoFethab
  quantidade: number
  // Itens do produto cuja unidade não deu para converter.
  semConversao: string[]
}

// Soma por produto todos os itens das notas carregadas.
export function detectarProdutos(notas: NotaNfe[]): { detectados: ProdutoDetectado[]; ignorados: string[] } {
  const porId = new Map<string, ProdutoDetectado>()
  const ignorados: string[] = []
  for (const nota of notas) {
    for (const item of nota.itens) {
      const produto = produtoDoItem(item)
      if (!produto) {
        ignorados.push(`${item.descricao} (NCM ${item.ncm})`)
        continue
      }
      const atual = porId.get(produto.id) ?? { produto, quantidade: 0, semConversao: [] }
      const q = quantidadeDoItem(item, produto)
      if (q === null) atual.semConversao.push(`${item.descricao}: ${item.quantidade} ${item.unidade}`)
      else atual.quantidade += q
      porId.set(produto.id, atual)
    }
  }
  const detectados = Array.from(porId.values()).sort((a, b) => b.quantidade - a.quantidade)
  return { detectados, ignorados }
}

// "2026-11-20" -> "11/2026"
export const periodoDaEmissao = (emissao: string) => {
  const m = /^(\d{4})-(\d{2})/.exec(emissao)
  return m ? `${m[2]}/${m[1]}` : null
}

// Texto para "Informações previstas" do DAR (até 220 caracteres, sem acento).
export function informacoesDasNotas(notas: NotaNfe[]) {
  if (!notas.length) return ''
  if (notas.length === 1) {
    const n = notas[0]
    return `NF-e ${n.numero} serie ${n.serie} chave ${n.chave}`.slice(0, 220)
  }
  const numeros = notas.map(n => n.numero)
  let txt = `NF-e ${numeros.join(', ')}`
  if (txt.length > 220) {
    // Corta na última nota que cabe e indica quantas ficaram de fora.
    let cabem = numeros.length
    while (cabem > 0) {
      txt = `NF-e ${numeros.slice(0, cabem).join(', ')} e mais ${numeros.length - cabem}`
      if (txt.length <= 220) break
      cabem--
    }
  }
  return txt
}
