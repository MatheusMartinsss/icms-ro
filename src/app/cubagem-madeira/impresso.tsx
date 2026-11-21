'use client'

// Folha de impressão (e PDF): o romaneio em tabelas, só com medidas, volumes e totais.

import { METODOS_TORA, lerNumero, m3, reais, volumeSerrada } from '@/lib/cubagem'
import {
  classificar, multPadrao, pecasPadrao, somar, volLargura, volLivre, volPadrao, volTora,
  type Estado, type Resumo, type ToraLinha,
} from './romaneio'

const td = 'border border-slate-300 px-1.5 py-0.5 tabular-nums'
const th = 'border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-left font-medium'
const fmt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

function Tabela({ cabecalho, linhas, rodape }: { cabecalho: string[]; linhas: React.ReactNode[][]; rodape?: React.ReactNode[] }) {
  return (
    <table className="w-full border-collapse text-[11px] leading-tight">
      <thead>
        <tr>{cabecalho.map((c, i) => <th key={i} className={i === cabecalho.length - 1 ? `${th} text-right` : th}>{c}</th>)}</tr>
      </thead>
      <tbody>
        {linhas.map((l, i) => (
          <tr key={i} className="break-inside-avoid">
            {l.map((c, j) => <td key={j} className={j === l.length - 1 ? `${td} text-right` : td}>{c}</td>)}
          </tr>
        ))}
      </tbody>
      {rodape && (
        <tfoot>
          <tr className="font-semibold">{rodape.map((c, j) => <td key={j} className={j === rodape.length - 1 ? `${td} text-right` : td}>{c}</td>)}</tr>
        </tfoot>
      )}
    </table>
  )
}

// Lista longa vai em duas colunas lado a lado para caber mais por folha.
function emColunas<T>(itens: T[], limite = 25): T[][] {
  if (itens.length <= limite) return [itens]
  const meio = Math.ceil(itens.length / 2)
  return [itens.slice(0, meio), itens.slice(meio)]
}

function Bloco({ titulo, resumo, children }: { titulo: string; resumo: string; children: React.ReactNode }) {
  return (
    <div className="break-inside-avoid">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <strong>{titulo}</strong>
        <span className="tabular-nums text-slate-600">{resumo}</span>
      </div>
      {children}
    </div>
  )
}

const pontas = (a: string, b: string, duas: boolean) => (duas && b ? `${a}/${b}` : a)

export function RomaneioImpresso({ e, r }: { e: Estado; r: Resumo }) {
  const u = e.unidade === 'cm' ? 'cm' : 'pol'
  let titulo = ''
  let corpo: React.ReactNode = null

  if (e.tipo === 'tora') {
    titulo = `Romaneio de toras · ${METODOS_TORA[e.metodo].titulo}`
    const francon = e.metodo === 'francon'
    corpo = e.toras.map((b, bi) => {
      const linhas = b.linhas.map(l => ({ l, v: volTora(l, e.metodo, e.duasMedidas) })).filter((x): x is { l: ToraLinha; v: number } => !!x.v)
      if (!linhas.length) return null
      const cab = francon ? ['#', 'Circ. (cm)', 'Compr. (m)', 'm³'] : ['#', 'Base (cm)', 'Topo (cm)', 'Compr. (m)', 'm³']
      const numeradas = linhas.map((x, i) => ({ ...x, n: i + 1 }))
      return (
        <Bloco key={b.id} titulo={b.especie.trim() || `Espécie ${bi + 1}`} resumo={`${linhas.length} ${linhas.length === 1 ? 'tora' : 'toras'} · ${m3(somar(linhas.map(x => x.v)))} m³`}>
          <div className="grid grid-cols-2 gap-3">
            {emColunas(numeradas).map((parte, k) => (
              <div key={k} className={numeradas.length <= 25 ? 'col-span-2 max-w-md' : ''}>
                <Tabela
                  cabecalho={cab}
                  linhas={parte.map(({ l, v, n }) => francon
                    ? [n, l.circ, l.comp, m3(v)]
                    : [n, pontas(l.d1, l.d2, e.duasMedidas), pontas(l.d3, l.d4, e.duasMedidas), l.comp, m3(v)])}
                />
              </div>
            ))}
          </div>
        </Bloco>
      )
    })
  } else if (e.modelo === 'padrao') {
    titulo = `Romaneio de madeira serrada · padrão (${u})`
    corpo = (
      <div className="grid grid-cols-3 gap-3">
        {e.padrao.map(b => {
          const linhas = b.linhas.map(l => ({ l, v: volPadrao(b, l, e.unidade) })).filter(x => x.v)
          if (!linhas.length) return null
          const mult = multPadrao(b)
          const pecas = linhas.reduce((s, x) => s + pecasPadrao(b, x.l), 0)
          return (
            <Bloco key={b.id} titulo={`${b.bitola} × ${b.largura} ${u}`} resumo={mult > 1 ? `pct de ${mult}` : ''}>
              <Tabela
                cabecalho={['Compr.', mult > 1 ? 'Pct' : 'Pç', 'm³']}
                linhas={linhas.map(({ l, v }) => [l.comp, l.qtd, m3(v!)])}
                rodape={['Total', `${pecas} pç`, m3(somar(linhas.map(x => x.v)))]}
              />
            </Bloco>
          )
        })}
      </div>
    )
  } else if (e.modelo === 'largura') {
    titulo = `Romaneio de madeira serrada · largura aberta (${u})`
    corpo = (
      <div className="grid grid-cols-2 gap-3">
        {e.largura.map(b => {
          const bit = lerNumero(b.bitola)
          const linhas = b.linhas.filter(l => volLargura(b, l, e.unidade))
          if (!bit || !linhas.length) return null
          const pecas = linhas.reduce((s, l) => s + l.pecas.length, 0)
          return (
            <Bloco key={b.id} titulo={`Bitola ${b.bitola} ${u}`} resumo="">
              <Tabela
                cabecalho={['Compr.', 'Largura', 'Pç', 'm³']}
                linhas={linhas.flatMap(l => classificar(l).map((c, ci) => [
                  ci === 0 ? l.comp : '',
                  fmt(c.largura),
                  c.qtd,
                  m3(somar([(volumeSerrada(bit, c.largura, lerNumero(l.comp), 1, e.unidade) ?? 0) * c.qtd])),
                ]))}
                rodape={['Total', '', pecas, m3(somar(linhas.map(l => volLargura(b, l, e.unidade))))]}
              />
            </Bloco>
          )
        })}
      </div>
    )
  } else {
    titulo = `Romaneio de madeira serrada (${u})`
    const linhas = e.livre.map(l => ({ l, v: volLivre(l, e.unidade) })).filter(x => x.v)
    corpo = (
      <div className="max-w-lg">
        <Tabela
          cabecalho={['#', `Seção (${u})`, 'Compr. (m)', 'Pç', 'm³']}
          linhas={linhas.map(({ l, v }, i) => [i + 1, `${l.esp} × ${l.larg}`, l.comp, l.qtd, m3(v!)])}
          rodape={['Total', '', '', r.quantidade, m3(r.volume)]}
        />
      </div>
    )
  }

  return (
    <div className="col-span-full hidden text-slate-900 print:block">
      <div className="mb-3 flex items-baseline justify-between border-b-2 border-slate-900 pb-1">
        <h2 className="text-base font-semibold">{titulo}</h2>
        <span className="text-xs text-slate-600">{new Date().toLocaleDateString('pt-BR')}</span>
      </div>
      <div className="space-y-4">{corpo}</div>
      <div className="mt-4 flex justify-end gap-6 border-t-2 border-slate-900 pt-1 text-sm font-semibold tabular-nums break-inside-avoid">
        <span>{r.quantidade} {e.tipo === 'tora' ? (r.quantidade === 1 ? 'tora' : 'toras') : 'peças'}</span>
        <span>{m3(r.volume)} m³</span>
        {r.valor !== null && <span>{reais(r.valor)}</span>}
      </div>
      <p className="mt-6 text-[10px] text-slate-400">geraguia.com.br/cubagem-madeira</p>
    </div>
  )
}
