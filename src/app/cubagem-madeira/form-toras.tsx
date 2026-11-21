'use client'

import { m3, type MetodoTora } from '@/lib/cubagem'
import { cn } from '@/lib/utils'
import { Atalhos, CLS_INPUT, NovoBloco, Num, Remover, focar, teclaGrade } from './campos'
import { novaToraLinha, novoToraBloco, somar, volTora, type ToraBloco, type ToraLinha } from './romaneio'

type Col = 'd1' | 'd2' | 'd3' | 'd4' | 'circ' | 'comp'

function colunas(metodo: MetodoTora, duas: boolean): { col: Col; rotulo: string; ph: string }[] {
  if (metodo === 'francon') return [{ col: 'circ', rotulo: 'Circ. (cm)', ph: '140' }, { col: 'comp', rotulo: 'Compr. (m)', ph: '4,5' }]
  if (!duas) return [{ col: 'd1', rotulo: 'Base', ph: '48' }, { col: 'd3', rotulo: 'Topo', ph: '40' }, { col: 'comp', rotulo: 'Compr. (m)', ph: '4,5' }]
  return [
    { col: 'd1', rotulo: 'Base 1', ph: '48' },
    { col: 'd2', rotulo: 'Base 2', ph: '46' },
    { col: 'd3', rotulo: 'Topo 1', ph: '40' },
    { col: 'd4', rotulo: 'Topo 2', ph: '38' },
    { col: 'comp', rotulo: 'Compr.', ph: '4,5' },
  ]
}

export function FormToras({ blocos, set, metodo, duasMedidas }: {
  blocos: ToraBloco[]
  set: (fn: (b: ToraBloco[]) => ToraBloco[]) => void
  metodo: MetodoTora
  duasMedidas: boolean
}) {
  const cols = colunas(metodo, duasMedidas)
  const grade = { gridTemplateColumns: `22px repeat(${cols.length}, minmax(0, 1fr)) 58px 20px` }

  const mudarBloco = (id: number, fn: (b: ToraBloco) => ToraBloco) => set(bs => bs.map(b => (b.id === id ? fn(b) : b)))
  const mudarLinha = (bid: number, lid: number, campo: Col, valor: string) =>
    mudarBloco(bid, b => ({ ...b, linhas: b.linhas.map(l => (l.id === lid ? { ...l, [campo]: valor } : l)) }))

  function adicionarLinha(bid: number) {
    const nova = novaToraLinha()
    focar(`[data-row="${nova.id}"][data-col="${cols[0].col}"]`, () => mudarBloco(bid, b => ({ ...b, linhas: [...b.linhas, nova] })))
  }

  function removerLinha(b: ToraBloco, l: ToraLinha, focarAnterior = false) {
    if (b.linhas.length === 1) {
      mudarBloco(b.id, x => ({ ...x, linhas: [novaToraLinha()] }))
      return
    }
    const i = b.linhas.findIndex(x => x.id === l.id)
    mudarBloco(b.id, x => ({ ...x, linhas: x.linhas.filter(y => y.id !== l.id) }))
    if (focarAnterior) {
      const ant = b.linhas[Math.max(0, i - 1)]
      focar(`[data-row="${ant.id}"][data-col="${cols[cols.length - 1].col}"]`)
    }
  }

  function adicionarBloco() {
    const novo = novoToraBloco()
    focar(`[data-especie="${novo.id}"]`, () => set(bs => [...bs, novo]))
  }

  return (
    <div className="space-y-3">
      {blocos.map((b, bi) => {
        const vols = b.linhas.map(l => volTora(l, metodo, duasMedidas))
        const validas = vols.filter(Boolean).length
        return (
          <div key={b.id} className="rounded-xl border bg-white p-3 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <input
                data-especie={b.id}
                value={b.especie}
                maxLength={60}
                placeholder={`Espécie ${bi + 1} (ex.: Cedrinho)`}
                onChange={e => mudarBloco(b.id, x => ({ ...x, especie: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); focar(`[data-row="${b.linhas[0].id}"][data-col="${cols[0].col}"]`) }
                }}
                className={cn(CLS_INPUT, 'h-8 flex-1 basis-40 font-medium')}
                aria-label="Espécie"
              />
              <label className="flex items-center gap-1 text-xs text-slate-500">
                R$/m³
                <Num valor={b.preco} onValor={v => mudarBloco(b.id, x => ({ ...x, preco: v }))} placeholder="opcional" className="w-24" aria-label="Preço por m³ desta espécie" />
              </label>
              {blocos.length > 1 && <Remover rotulo={`Remover espécie ${bi + 1}`} onClick={() => set(bs => bs.filter(x => x.id !== b.id))} />}
            </div>

            <div
              role="grid"
              aria-label={`Toras da espécie ${b.especie || bi + 1}`}
              onKeyDown={e => {
                const alvo = e.target as HTMLInputElement
                // Backspace num campo vazio de linha toda vazia apaga a linha.
                if (e.key === 'Backspace' && alvo.dataset?.nav !== undefined && !alvo.value) {
                  const l = b.linhas.find(x => String(x.id) === alvo.dataset.row)
                  if (l && alvo.dataset.col === cols[0].col && cols.every(c => !l[c.col]) && b.linhas.length > 1) {
                    e.preventDefault()
                    removerLinha(b, l, true)
                    return
                  }
                }
                teclaGrade(e, () => adicionarLinha(b.id))
              }}
              className="space-y-1"
            >
              <div className="grid items-end gap-1 text-[11px] leading-4 text-slate-500" style={grade}>
                <span>#</span>
                {cols.map(c => <span key={c.col} className="truncate">{c.rotulo}</span>)}
                <span className="text-right">m³</span>
                <span />
              </div>
              {b.linhas.map((l, i) => (
                <div key={l.id} role="row" className="grid items-center gap-1" style={grade}>
                  <span className="text-xs tabular-nums text-slate-400">{i + 1}</span>
                  {cols.map(c => (
                    <Num
                      key={c.col}
                      data-nav=""
                      data-row={l.id}
                      data-col={c.col}
                      valor={l[c.col]}
                      onValor={v => mudarLinha(b.id, l.id, c.col, v)}
                      placeholder={i === 0 ? c.ph : ''}
                      aria-label={`${c.rotulo} da tora ${i + 1}`}
                    />
                  ))}
                  <span className={cn('text-right text-xs tabular-nums', vols[i] ? 'font-medium text-slate-900' : 'text-slate-300')}>
                    {vols[i] ? m3(vols[i]!) : '—'}
                  </span>
                  <Remover rotulo={`Remover tora ${i + 1}`} onClick={() => removerLinha(b, l)} />
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2 text-sm">
              <button type="button" onClick={() => adicionarLinha(b.id)} className="rounded px-2 py-1 text-sky-700 hover:bg-sky-50">
                + Tora
              </button>
              <span className="tabular-nums text-slate-600">
                {validas} {validas === 1 ? 'tora' : 'toras'} · <strong className="text-slate-900">{m3(somar(vols))} m³</strong>
              </span>
            </div>
          </div>
        )
      })}
      <NovoBloco rotulo="Adicionar espécie" onClick={adicionarBloco} />
      <Atalhos itens={[['Enter', 'próximo campo (no último, nova tora)'], ['↑ ↓', 'tora de cima/baixo'], ['⌫', 'em linha vazia, apaga a linha']]} />
    </div>
  )
}
