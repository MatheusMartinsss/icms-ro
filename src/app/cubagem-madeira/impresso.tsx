'use client'

// Folha de impressão: desenha o mesmo documento do PDF em tabelas HTML.

import type { Documento, TabelaDoc } from './documento'

const td = 'border border-slate-300 px-1.5 py-0.5 tabular-nums'
const th = 'border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-left font-medium'
const COLUNAS = { 2: 'grid-cols-2', 3: 'grid-cols-3' } as const

function Tabela({ t }: { t: TabelaDoc }) {
  const ult = t.cabecalho.length - 1
  return (
    <div className="break-inside-avoid">
      {(t.titulo || t.resumo) && (
        <div className="mb-0.5 flex items-baseline justify-between gap-2 text-[11px]">
          <strong>{t.titulo}</strong>
          <span className="text-slate-600">{t.resumo}</span>
        </div>
      )}
      <table className="w-full border-collapse text-[11px] leading-tight">
        <thead>
          <tr>{t.cabecalho.map((c, i) => <th key={i} className={i === ult ? `${th} text-right` : th}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {t.linhas.map((l, i) => (
            <tr key={i} className="break-inside-avoid">
              {l.map((c, j) => <td key={j} className={j === ult ? `${td} text-right` : td}>{c}</td>)}
            </tr>
          ))}
        </tbody>
        {t.rodape && (
          <tfoot>
            <tr className="font-semibold">{t.rodape.map((c, j) => <td key={j} className={j === ult ? `${td} text-right` : td}>{c}</td>)}</tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

export function RomaneioImpresso({ doc }: { doc: Documento }) {
  return (
    <div className="col-span-full hidden text-slate-900 print:block">
      <div className="mb-3 flex items-baseline justify-between border-b-2 border-slate-900 pb-1">
        <h2 className="text-base font-semibold">{doc.titulo}</h2>
        <span className="text-xs text-slate-600">{doc.data}</span>
      </div>
      <div className="space-y-4">
        {doc.secoes.map((s, i) => (
          <section key={i}>
            {s.titulo && (
              <div className="mb-1 flex items-baseline justify-between gap-2 border-b border-slate-300 text-xs">
                <strong className="text-[13px]">{s.titulo}</strong>
                <span className="tabular-nums text-slate-600">{s.resumo}</span>
              </div>
            )}
            <div className={`grid gap-3 ${COLUNAS[s.porLinha]}`}>
              {s.tabelas.map((t, j) => <Tabela key={j} t={t} />)}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-6 border-t-2 border-slate-900 pt-1 text-sm font-semibold tabular-nums break-inside-avoid">
        {doc.totais.map(t => <span key={t}>{t}</span>)}
      </div>
      <p className="mt-6 text-[10px] text-slate-400">geraguia.com.br/cubagem-madeira</p>
    </div>
  )
}
