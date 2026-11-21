// O romaneio em tabelas, só com medidas, volumes e totais. A folha de impressão
// e o PDF desenham a mesma estrutura, então nunca saem diferentes.

import { lerNumero, m3, reais, volumeSerrada } from '@/lib/cubagem'
import {
  classificar, especiesUsadas, multPadrao, pecasPadrao, porClasse, somar, tituloRomaneio, unidadeQtd,
  volLargura, volLivre, volPadrao, volTora,
  type Estado, type Parcial, type Resumo,
} from './romaneio'

export interface TabelaDoc { titulo?: string; resumo?: string; cabecalho: string[]; linhas: string[][]; rodape?: string[] }
export interface SecaoDoc { titulo?: string; resumo?: string; porLinha: 1 | 2 | 3; tabelas: TabelaDoc[] }
export interface Documento { titulo: string; data: string; secoes: SecaoDoc[]; totais: string[]; arquivo: string }

const fmt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const LIMITE = 25

// Lista longa vira duas tabelas lado a lado; o rodapé fica na segunda.
function emColunas(t: TabelaDoc): TabelaDoc[] {
  if (t.linhas.length <= LIMITE) return [t]
  const meio = Math.ceil(t.linhas.length / 2)
  return [
    { cabecalho: t.cabecalho, linhas: t.linhas.slice(0, meio) },
    { cabecalho: t.cabecalho, linhas: t.linhas.slice(meio), rodape: t.rodape },
  ]
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function montarDocumento(e: Estado, r: Resumo, agora = new Date()): Documento {
  const tora = e.tipo === 'tora'
  const u = e.unidade === 'cm' ? 'cm' : 'pol'
  const { usadas, comTitulo } = especiesUsadas(e, r)
  const resumoDe = (p: Parcial) =>
    [`${p.quantidade} ${unidadeQtd(tora, p.quantidade)}`, `${m3(p.volume)} m³`, p.valor !== null ? reais(p.valor) : ''].filter(Boolean).join(' · ')

  const secoes = usadas.map((p): SecaoDoc => {
    const cab = comTitulo ? { titulo: p.nome, resumo: resumoDe(p) } : {}

    if (tora) {
      const b = e.toras.find(x => x.id === p.id)!
      const francon = e.metodo === 'francon'
      const ponta = (a: string, c: string) => (e.duasMedidas && c ? `${a}/${c}` : a)
      const linhas = b.linhas
        .map(l => ({ l, v: volTora(l, e.metodo, e.duasMedidas) }))
        .filter(x => x.v)
        .map(({ l, v }, i) => francon
          ? [String(i + 1), l.circ, l.comp, m3(v!)]
          : [String(i + 1), ponta(l.d1, l.d2), ponta(l.d3, l.d4), l.comp, m3(v!)])
      const cabecalho = francon ? ['#', 'Circ. (cm)', 'Compr. (m)', 'm³'] : ['#', 'Base (cm)', 'Topo (cm)', 'Compr. (m)', 'm³']
      return { ...cab, porLinha: 2, tabelas: emColunas({ cabecalho, linhas }) }
    }

    const s = e.serradas.find(x => x.id === p.id)!
    if (e.modelo === 'padrao') {
      const tabelas = s.padrao.flatMap((b): TabelaDoc[] => {
        const linhas = b.linhas.map(l => ({ l, v: volPadrao(b, l, e.unidade) })).filter(x => x.v)
        if (!linhas.length) return []
        const mult = multPadrao(b)
        const pecas = linhas.reduce((t, x) => t + pecasPadrao(b, x.l), 0)
        return [{
          titulo: `${b.bitola} × ${b.largura} ${u}`,
          resumo: mult > 1 ? `pct de ${mult}` : '',
          cabecalho: ['Compr.', mult > 1 ? 'Pct' : 'Pç', 'm³'],
          linhas: linhas.map(({ l, v }) => [l.comp, l.qtd, m3(v!)]),
          rodape: ['Total', `${pecas} pç`, m3(somar(linhas.map(x => x.v)))],
        }]
      })
      return { ...cab, porLinha: 3, tabelas }
    }

    if (e.modelo === 'largura') {
      const tabelas = s.largura.flatMap((b): TabelaDoc[] => {
        const bit = lerNumero(b.bitola)
        const linhas = b.linhas.filter(l => volLargura(b, l, e.unidade))
        if (!bit || !linhas.length) return []
        return [{
          titulo: `Bitola ${b.bitola} ${u}`,
          cabecalho: ['Compr.', 'Largura', 'Pç', 'm³'],
          linhas: linhas.flatMap(l => classificar(l).map((c, ci) => [
            ci === 0 ? l.comp : '',
            fmt(c.largura),
            String(c.qtd),
            m3(somar([(volumeSerrada(bit, c.largura, lerNumero(l.comp), 1, e.unidade) ?? 0) * c.qtd])),
          ])),
          rodape: ['Total', '', String(linhas.reduce((t, l) => t + l.pecas.length, 0)), m3(somar(linhas.map(l => volLargura(b, l, e.unidade))))],
        }]
      })
      return { ...cab, porLinha: 2, tabelas }
    }

    const linhas = s.livre
      .map(l => ({ l, v: volLivre(l, e.unidade) }))
      .filter(x => x.v)
      .map(({ l, v }, i) => [String(i + 1), `${l.esp} × ${l.larg}`, l.comp, l.qtd, m3(v!)])
    return {
      ...cab,
      porLinha: 2,
      tabelas: emColunas({
        cabecalho: ['#', `Seção (${u})`, 'Compr. (m)', 'Pç', 'm³'],
        linhas,
        rodape: ['Total', '', '', String(p.quantidade), m3(p.volume)],
      }),
    }
  })

  // Fechamento por classe (prancha, viga, caibro…), com a espécie quando há mais de uma.
  if (!tora) {
    const classes = porClasse(e).filter(c => usadas.some(p => p.id === c.especie))
    const varias = usadas.length > 1
    if (classes.length) {
      secoes.push({
        titulo: 'Por classe',
        resumo: 'nomenclatura da NBR 7203',
        porLinha: varias ? 1 : 2,
        tabelas: [{
          cabecalho: [...(varias ? ['Espécie'] : []), 'Classe', `Medidas (${u})`, 'Pç', 'm³'],
          linhas: classes.map((c, i) => [
            ...(varias ? [i && classes[i - 1].especie === c.especie ? '' : usadas.find(p => p.id === c.especie)!.nome] : []),
            c.classe, c.medidas, String(c.pecas), m3(c.volume),
          ]),
          rodape: [...(varias ? [''] : []), 'Total', '', String(r.quantidade), m3(r.volume)],
        }],
      })
    }
  }

  const data = agora.toLocaleDateString('pt-BR')
  const nome = usadas.length === 1 && comTitulo ? slug(usadas[0].nome) : tora ? 'toras' : 'serrada'
  return {
    titulo: tituloRomaneio(e),
    data,
    secoes,
    totais: [`${r.quantidade} ${unidadeQtd(tora, r.quantidade)}`, `${m3(r.volume)} m³`, ...(r.valor !== null ? [reais(r.valor)] : [])],
    arquivo: `romaneio-${nome || 'madeira'}-${data.replace(/\//g, '-')}.pdf`,
  }
}
