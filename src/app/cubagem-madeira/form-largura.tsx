'use client'

import { useState } from 'react'
import { lerNumero, m3, volumeSerrada, type UnidadeSecao } from '@/lib/cubagem'
import { cn } from '@/lib/utils'
import { Atalhos, CLS_INPUT, NovoBloco, Num, Remover, focar, limparNumero } from './campos'
import {
  classificar, novaLarguraLinha, novoLarguraBloco, somar, volLargura,
  type Faixa, type LarguraBloco, type LarguraLinha,
} from './romaneio'

const ordenar = (ls: LarguraLinha[]) =>
  [...ls].sort((a, b) => (lerNumero(a.comp) ?? Infinity) - (lerNumero(b.comp) ?? Infinity))
const fmt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const fmtComp = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const sel = {
  bitola: (b: number) => `[data-la-bitola="${b}"]`,
  peca: (l: number) => `[data-la-peca="${l}"]`,
  comp: (l: number) => `[data-la-comp="${l}"]`,
  novo: (b: number) => `[data-la-novo="${b}"]`,
}

export function FormLargura({ blocos, set, unidade, faixa }: {
  blocos: LarguraBloco[]
  set: (fn: (b: LarguraBloco[]) => LarguraBloco[]) => void
  unidade: UnidadeSecao
  faixa: Faixa
}) {
  // O que está digitado em cada linha antes de virar peça.
  const [rascunho, setRascunho] = useState<Record<number, string>>({})
  const [novoComp, setNovoComp] = useState<Record<number, string>>({})

  const mudarBloco = (id: number, fn: (b: LarguraBloco) => LarguraBloco) => set(bs => bs.map(b => (b.id === id ? fn(b) : b)))
  const mudarLinha = (bid: number, lid: number, fn: (l: LarguraLinha) => LarguraLinha) =>
    mudarBloco(bid, b => ({ ...b, linhas: b.linhas.map(l => (l.id === lid ? fn(l) : l)) }))

  // Transforma o texto em peças; devolve true se adicionou alguma.
  function lancar(bid: number, lid: number, texto: string): boolean {
    const larguras = texto.split(/\s+/).map(t => lerNumero(t)).filter((v): v is number => !!v && v < 10000)
    setRascunho(r => ({ ...r, [lid]: '' }))
    if (!larguras.length) return false
    mudarLinha(bid, lid, l => ({ ...l, pecas: [...l.pecas, ...larguras].slice(0, 2000) }))
    return true
  }

  function proximoBloco(b: LarguraBloco) {
    const i = blocos.findIndex(x => x.id === b.id)
    const prox = blocos[i + 1]
    if (prox) { focar(sel.bitola(prox.id)); return }
    const novo = novoLarguraBloco(faixa, b.bitola)
    focar(sel.bitola(novo.id), () => set(bs => [...bs, novo]))
  }

  function teclaPeca(e: React.KeyboardEvent<HTMLInputElement>, b: LarguraBloco, i: number) {
    const l = b.linhas[i]
    const texto = rascunho[l.id] ?? ''
    const irPara = (j: number) => {
      if (j < 0) focar(sel.bitola(b.id))
      else if (j >= b.linhas.length) focar(sel.novo(b.id))
      else focar(sel.peca(b.linhas[j].id))
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (texto.trim()) lancar(b.id, l.id, texto)
      else irPara(e.shiftKey ? i - 1 : i + 1)
    } else if (e.key === ' ') {
      e.preventDefault()
      if (texto.trim()) lancar(b.id, l.id, texto)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (texto.trim()) lancar(b.id, l.id, texto)
      irPara(e.shiftKey ? i - 1 : i + 1)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      irPara(e.key === 'ArrowDown' ? i + 1 : i - 1)
    } else if (e.key === 'Backspace' && !texto && l.pecas.length) {
      e.preventDefault()
      mudarLinha(b.id, l.id, x => ({ ...x, pecas: x.pecas.slice(0, -1) }))
    }
  }

  function adicionarComp(b: LarguraBloco) {
    const v = lerNumero(novoComp[b.id] ?? '')
    setNovoComp(n => ({ ...n, [b.id]: '' }))
    if (!v) { proximoBloco(b); return }
    const existente = b.linhas.find(l => lerNumero(l.comp) === v)
    if (existente) { focar(sel.peca(existente.id)); return }
    const nova = novaLarguraLinha(fmtComp(v), true)
    focar(sel.peca(nova.id), () => mudarBloco(b.id, x => ({ ...x, linhas: ordenar([...x.linhas, nova]) })))
  }

  function adicionarBloco() {
    const novo = novoLarguraBloco(faixa, blocos[blocos.length - 1]?.bitola ?? '')
    focar(sel.bitola(novo.id), () => set(bs => [...bs, novo]))
  }

  const u = unidade === 'cm' ? 'cm' : 'pol'

  return (
    <div className="space-y-3">
      {blocos.map((b, bi) => {
        const vols = b.linhas.map(l => volLargura(b, l, unidade))
        const pecas = b.linhas.reduce((s, l) => s + l.pecas.length, 0)
        const bit = lerNumero(b.bitola)
        const comPecas = b.linhas.filter(l => l.pecas.length)
        return (
          <div key={b.id} className="rounded-xl border bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-end gap-2">
              <label className="w-20 text-[11px] leading-4 text-slate-500">
                Bitola ({u})
                <Num
                  data-la-bitola={b.id}
                  valor={b.bitola}
                  onValor={v => mudarBloco(b.id, x => ({ ...x, bitola: v }))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focar(sel.peca(b.linhas[0]?.id)) } }}
                  placeholder={u === 'cm' ? '2,5' : '1'}
                  className="font-medium"
                />
              </label>
              <p className="flex-1 pb-1.5 text-xs text-slate-400">Digite a largura de cada peça ({u}) na linha do comprimento.</p>
              {blocos.length > 1 && <Remover rotulo={`Remover bitola ${bi + 1}`} onClick={() => set(bs => bs.filter(x => x.id !== b.id))} className="mb-1" />}
            </div>

            <div className="divide-y">
              {b.linhas.map((l, i) => (
                <div key={l.id} className="grid grid-cols-[56px_1fr_58px_20px] items-center gap-1.5 py-1">
                  {l.extra ? (
                    <Num
                      data-la-comp={l.id}
                      valor={l.comp}
                      onValor={v => mudarLinha(b.id, l.id, x => ({ ...x, comp: v }))}
                      onBlur={() => { if (lerNumero(l.comp)) mudarBloco(b.id, x => ({ ...x, linhas: ordenar(x.linhas) })) }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); focar(sel.peca(l.id)) }
                        if (e.key === 'Escape') { e.preventDefault(); mudarBloco(b.id, x => ({ ...x, linhas: x.linhas.filter(y => y.id !== l.id) })) }
                      }}
                      className="h-7 border-dashed text-xs"
                      aria-label="Comprimento em metros"
                    />
                  ) : (
                    <span className={cn('text-sm tabular-nums', l.pecas.length ? 'font-medium text-slate-900' : 'text-slate-500')}>{l.comp} m</span>
                  )}
                  <div
                    className="flex min-h-[30px] flex-wrap items-center gap-1 rounded border border-transparent px-0.5 focus-within:border-sky-300 focus-within:bg-sky-50/40"
                    onClick={e => { if (e.target === e.currentTarget) focar(sel.peca(l.id)) }}
                  >
                    {l.pecas.map((p, pi) => (
                      <button
                        key={pi}
                        type="button"
                        tabIndex={-1}
                        title="Remover peça"
                        onClick={() => mudarLinha(b.id, l.id, x => ({ ...x, pecas: x.pecas.filter((_, k) => k !== pi) }))}
                        className="rounded bg-slate-100 px-1.5 py-0.5 text-xs tabular-nums text-slate-700 hover:bg-red-50 hover:text-red-700 hover:line-through"
                      >
                        {fmt(p)}
                      </button>
                    ))}
                    <input
                      data-la-peca={l.id}
                      inputMode="decimal"
                      autoComplete="off"
                      enterKeyHint="enter"
                      value={rascunho[l.id] ?? ''}
                      onChange={e => {
                        const v = e.target.value.replace(/[^\d.,\s]/g, '')
                        // Colar "20 22 25" lança tudo; o último fica no campo.
                        if (/\s/.test(v)) {
                          const partes = v.split(/\s+/)
                          const resto = partes.pop() ?? ''
                          lancar(b.id, l.id, partes.join(' '))
                          setRascunho(r => ({ ...r, [l.id]: limparNumero(resto) }))
                        } else setRascunho(r => ({ ...r, [l.id]: limparNumero(v) }))
                      }}
                      onKeyDown={e => teclaPeca(e, b, i)}
                      onBlur={() => { const t = rascunho[l.id]; if (t?.trim()) lancar(b.id, l.id, t) }}
                      placeholder={l.pecas.length ? '' : '—'}
                      aria-label={`Larguras das peças com ${l.comp} m`}
                      className="h-6 w-14 min-w-0 flex-1 rounded border-0 bg-transparent px-1 text-sm tabular-nums outline-none placeholder:text-slate-300"
                    />
                  </div>
                  <span className={cn('text-right text-xs tabular-nums', vols[i] ? 'text-slate-900' : 'text-slate-300')}>
                    {vols[i] ? m3(vols[i]!) : '—'}
                  </span>
                  <span className="text-right text-[11px] tabular-nums text-slate-400">{l.pecas.length || ''}</span>
                </div>
              ))}
            </div>

            <div className="mt-1 flex items-center gap-2">
              <input
                data-la-novo={b.id}
                inputMode="decimal"
                autoComplete="off"
                value={novoComp[b.id] ?? ''}
                onChange={e => setNovoComp(n => ({ ...n, [b.id]: limparNumero(e.target.value) }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); adicionarComp(b) }
                  if (e.key === 'ArrowUp') { e.preventDefault(); focar(sel.peca(b.linhas[b.linhas.length - 1]?.id)) }
                }}
                placeholder="Outro comprimento (m) + Enter"
                className={cn(CLS_INPUT, 'h-7 max-w-[230px] border-dashed text-xs')}
                aria-label="Adicionar comprimento"
              />
            </div>

            {comPecas.length > 0 && bit && (
              <details className="mt-2 rounded-lg border bg-slate-50 text-sm">
                <summary className="cursor-pointer px-3 py-1.5 text-xs font-medium text-slate-600">Classificação por largura</summary>
                <table className="w-full text-xs tabular-nums">
                  <thead className="text-slate-500">
                    <tr><th className="px-3 py-1 text-left font-normal">Compr.</th><th className="px-3 py-1 text-left font-normal">Largura</th><th className="px-3 py-1 text-right font-normal">Peças</th><th className="px-3 py-1 text-right font-normal">m³</th></tr>
                  </thead>
                  <tbody>
                    {comPecas.flatMap(l => classificar(l).map((c, ci) => {
                      const v = volumeSerrada(bit, c.largura, lerNumero(l.comp), 1, unidade) ?? 0
                      return (
                        <tr key={`${l.id}-${c.largura}`} className={ci === 0 ? 'border-t' : ''}>
                          <td className="px-3 py-1">{ci === 0 ? `${l.comp} m` : ''}</td>
                          <td className="px-3 py-1">{bit && `${fmt(bit)} × ${fmt(c.largura)}`}</td>
                          <td className="px-3 py-1 text-right">{c.qtd}</td>
                          <td className="px-3 py-1 text-right">{m3(somar([v * c.qtd]))}</td>
                        </tr>
                      )
                    }))}
                  </tbody>
                </table>
              </details>
            )}

            <div className="mt-2 flex items-center justify-end border-t pt-2 text-sm tabular-nums text-slate-600">
              {pecas} pç · <strong className="ml-1 text-slate-900">{m3(somar(vols))} m³</strong>
            </div>
          </div>
        )
      })}
      <NovoBloco rotulo="Adicionar bitola" onClick={adicionarBloco} />
      <Atalhos itens={[
        ['Enter', 'lança a peça (vazio: próximo comprimento)'],
        ['Espaço', 'lança e continua'],
        ['⌫', 'apaga a última peça'],
        ['Tab ↑ ↓', 'troca de comprimento'],
      ]} />
    </div>
  )
}
