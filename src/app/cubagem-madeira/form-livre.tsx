'use client'

import { m3, type UnidadeSecao } from '@/lib/cubagem'
import { cn } from '@/lib/utils'
import { Atalhos, Num, Remover, focar, teclaGrade } from './campos'
import { novaLivreLinha, somar, volLivre, type LivreLinha } from './romaneio'

type Col = 'esp' | 'larg' | 'comp' | 'qtd'

export function FormLivre({ linhas, set, unidade }: {
  linhas: LivreLinha[]
  set: (fn: (l: LivreLinha[]) => LivreLinha[]) => void
  unidade: UnidadeSecao
}) {
  const u = unidade === 'cm' ? 'cm' : 'pol'
  const cols: { col: Col; rotulo: string; ph: string; inteiro?: boolean }[] = [
    { col: 'esp', rotulo: `Espessura (${u})`, ph: u === 'cm' ? '5' : '2' },
    { col: 'larg', rotulo: `Largura (${u})`, ph: u === 'cm' ? '20' : '8' },
    { col: 'comp', rotulo: 'Compr. (m)', ph: '3' },
    { col: 'qtd', rotulo: 'Peças', ph: '10', inteiro: true },
  ]
  const vols = linhas.map(l => volLivre(l, unidade))
  const grade = 'grid grid-cols-[22px_repeat(4,minmax(0,1fr))_58px_20px] items-center gap-1'

  // Linha nova repete espessura e largura da anterior e começa no comprimento.
  function adicionar() {
    const nova = novaLivreLinha(linhas[linhas.length - 1])
    focar(`[data-row="${nova.id}"][data-col="${nova.esp && nova.larg ? 'comp' : 'esp'}"]`, () => set(ls => [...ls, nova]))
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-white p-3 shadow-sm">
        <div role="grid" aria-label="Peças" className="space-y-1" onKeyDown={e => teclaGrade(e, adicionar)}>
          <div className={cn(grade, 'text-[11px] leading-4 text-slate-500')}>
            <span>#</span>
            {cols.map(c => <span key={c.col} className="truncate">{c.rotulo}</span>)}
            <span className="text-right">m³</span>
            <span />
          </div>
          {linhas.map((l, i) => (
            <div key={l.id} role="row" className={grade}>
              <span className="text-xs tabular-nums text-slate-400">{i + 1}</span>
              {cols.map(c => (
                <Num
                  key={c.col}
                  data-nav=""
                  data-row={l.id}
                  data-col={c.col}
                  inteiro={c.inteiro}
                  valor={l[c.col]}
                  onValor={v => set(ls => ls.map(x => (x.id === l.id ? { ...x, [c.col]: v } : x)))}
                  placeholder={i === 0 ? c.ph : ''}
                  aria-label={`${c.rotulo} do item ${i + 1}`}
                />
              ))}
              <span className={cn('text-right text-xs tabular-nums', vols[i] ? 'font-medium text-slate-900' : 'text-slate-300')}>
                {vols[i] ? m3(vols[i]!) : '—'}
              </span>
              <Remover
                rotulo={`Remover item ${i + 1}`}
                onClick={() => set(ls => (ls.length > 1 ? ls.filter(x => x.id !== l.id) : [novaLivreLinha()]))}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2 text-sm">
          <button type="button" onClick={adicionar} className="rounded px-2 py-1 text-sky-700 hover:bg-sky-50">+ Item</button>
          <strong className="tabular-nums text-slate-900">{m3(somar(vols))} m³</strong>
        </div>
      </div>
      <Atalhos itens={[['Enter', 'próximo campo (no último, novo item com a mesma bitola)'], ['↑ ↓', 'item de cima/baixo']]} />
    </div>
  )
}
