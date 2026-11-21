'use client'

import { lerNumero, m3, type UnidadeSecao } from '@/lib/cubagem'
import { cn } from '@/lib/utils'
import { Atalhos, NovoBloco, Num, Remover, focar } from './campos'
import {
  multPadrao, novaPadraoLinha, novoPadraoBloco, pecasPadrao, somar, volPadrao,
  type Faixa, type PadraoBloco, type PadraoLinha,
} from './romaneio'

const ordenar = (ls: PadraoLinha[]) =>
  [...ls].sort((a, b) => (lerNumero(a.comp) ?? Infinity) - (lerNumero(b.comp) ?? Infinity))

const sel = {
  bitola: (b: number) => `[data-pd-bitola="${b}"]`,
  largura: (b: number) => `[data-pd-largura="${b}"]`,
  qtd: (l: number) => `[data-pd-qtd="${l}"]`,
  comp: (l: number) => `[data-pd-comp="${l}"]`,
}

export function FormPadrao({ blocos, set, unidade, faixa }: {
  blocos: PadraoBloco[]
  set: (fn: (b: PadraoBloco[]) => PadraoBloco[]) => void
  unidade: UnidadeSecao
  faixa: Faixa
}) {
  const mudarBloco = (id: number, fn: (b: PadraoBloco) => PadraoBloco) => set(bs => bs.map(b => (b.id === id ? fn(b) : b)))
  const mudarLinha = (bid: number, lid: number, campos: Partial<PadraoLinha>) =>
    mudarBloco(bid, b => ({ ...b, linhas: b.linhas.map(l => (l.id === lid ? { ...l, ...campos } : l)) }))

  // Vai para o bloco seguinte (cria um novo, com a mesma bitola, se for o último).
  function proximoBloco(b: PadraoBloco) {
    const i = blocos.findIndex(x => x.id === b.id)
    const prox = blocos[i + 1]
    if (prox) {
      focar(prox.bitola ? sel.largura(prox.id) : sel.bitola(prox.id))
      return
    }
    const novo = novoPadraoBloco(faixa, b.bitola)
    focar(b.bitola ? sel.largura(novo.id) : sel.bitola(novo.id), () => set(bs => [...bs, novo]))
  }

  function inserirExtra(b: PadraoBloco, antesDe?: number) {
    const nova = novaPadraoLinha('', true)
    focar(sel.comp(nova.id), () => mudarBloco(b.id, x => {
      const ls = [...x.linhas]
      const i = antesDe === undefined ? ls.length : ls.findIndex(l => l.id === antesDe)
      ls.splice(i < 0 ? ls.length : i, 0, nova)
      return { ...x, linhas: ls }
    }))
  }

  function confirmarComp(b: PadraoBloco, l: PadraoLinha) {
    if (lerNumero(l.comp)) mudarBloco(b.id, x => ({ ...x, linhas: ordenar(x.linhas) }))
  }

  function teclaQtd(e: React.KeyboardEvent<HTMLInputElement>, b: PadraoBloco, i: number) {
    const voltar = e.key === 'ArrowUp' || (e.shiftKey && (e.key === 'Tab' || e.key === 'Enter'))
    const avancar = !voltar && (e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowDown')
    if (!voltar && !avancar) return
    e.preventDefault()
    if (voltar) {
      focar(i === 0 ? sel.largura(b.id) : sel.qtd(b.linhas[i - 1].id))
      return
    }
    const prox = b.linhas[i + 1]
    if (prox) focar(sel.qtd(prox.id))
    else if (e.key !== 'ArrowDown') proximoBloco(b)
  }

  function adicionarBloco() {
    const ultimo = blocos[blocos.length - 1]
    const novo = novoPadraoBloco(faixa, ultimo?.bitola ?? '')
    focar(novo.bitola ? sel.largura(novo.id) : sel.bitola(novo.id), () => set(bs => [...bs, novo]))
  }

  const u = unidade === 'cm' ? 'cm' : 'pol'

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {blocos.map((b, bi) => {
          const vols = b.linhas.map(l => volPadrao(b, l, unidade))
          const pecas = b.linhas.reduce((s, l, i) => s + (vols[i] ? pecasPadrao(b, l) : 0), 0)
          const mult = multPadrao(b)
          return (
            <div key={b.id} className="rounded-xl border bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-end gap-1.5">
                <label className="w-14 text-[11px] leading-4 text-slate-500">
                  Bitola
                  <Num
                    data-pd-bitola={b.id}
                    valor={b.bitola}
                    onValor={v => mudarBloco(b.id, x => ({ ...x, bitola: v }))}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focar(sel.largura(b.id)) } }}
                    placeholder={u === 'cm' ? '5' : '2'}
                    className="font-medium"
                  />
                </label>
                <span className="pb-1.5 text-slate-400">×</span>
                <label className="w-14 text-[11px] leading-4 text-slate-500">
                  Largura
                  <Num
                    data-pd-largura={b.id}
                    valor={b.largura}
                    onValor={v => mudarBloco(b.id, x => ({ ...x, largura: v }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); focar(sel.qtd(b.linhas[0]?.id)) }
                      if ((e.key === 'Enter' || e.key === 'Tab') && e.shiftKey) { e.preventDefault(); focar(sel.bitola(b.id)) }
                    }}
                    placeholder={u === 'cm' ? '20' : '8'}
                    className="font-medium"
                  />
                </label>
                <span className="pb-2 text-xs text-slate-400">{u}</span>
                <label className="ml-auto w-14 text-[11px] leading-4 text-slate-500" title="Peças por pacote: a quantidade vira pacotes">
                  pç/pct
                  <Num
                    inteiro
                    valor={b.mult}
                    onValor={v => mudarBloco(b.id, x => ({ ...x, mult: v }))}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focar(sel.qtd(b.linhas[0]?.id)) } }}
                    placeholder="1"
                    tabIndex={-1}
                  />
                </label>
                {blocos.length > 1 && <Remover rotulo={`Remover bloco ${bi + 1}`} onClick={() => set(bs => bs.filter(x => x.id !== b.id))} className="mb-1" />}
              </div>

              <div className="grid grid-cols-[16px_60px_1fr_60px_20px] items-center gap-x-1.5 gap-y-1">
                <span />
                <span className="text-[11px] text-slate-500">Compr. (m)</span>
                <span className="text-[11px] text-slate-500">{mult > 1 ? `Pacotes (×${mult})` : 'Peças'}</span>
                <span className="text-right text-[11px] text-slate-500">m³</span>
                <span />
                {b.linhas.map((l, i) => (
                  <div key={l.id} className="group contents">
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => inserirExtra(b, l.id)}
                      title="Inserir comprimento acima"
                      aria-label={`Inserir comprimento acima de ${l.comp || 'esta linha'}`}
                      className="h-5 w-4 rounded text-xs leading-none text-slate-300 opacity-0 hover:bg-sky-50 hover:text-sky-700 focus:opacity-100 group-hover:opacity-100"
                    >
                      +
                    </button>
                    {l.extra ? (
                      <Num
                        data-pd-comp={l.id}
                        valor={l.comp}
                        onValor={v => mudarLinha(b.id, l.id, { comp: v })}
                        onBlur={() => confirmarComp(b, l)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); confirmarComp(b, l); focar(sel.qtd(l.id)) }
                          if (e.key === 'Escape') { e.preventDefault(); mudarBloco(b.id, x => ({ ...x, linhas: x.linhas.filter(y => y.id !== l.id) })); focar(sel.qtd((b.linhas[i - 1] ?? b.linhas[i + 1])?.id)) }
                        }}
                        placeholder="m"
                        className="h-7 border-dashed text-xs"
                        aria-label="Comprimento extra em metros"
                      />
                    ) : (
                      <span className={cn('text-sm tabular-nums', l.qtd ? 'font-medium text-slate-900' : 'text-slate-500')}>{l.comp}</span>
                    )}
                    <Num
                      inteiro
                      data-pd-qtd={l.id}
                      valor={l.qtd}
                      onValor={v => mudarLinha(b.id, l.id, { qtd: v })}
                      onKeyDown={e => teclaQtd(e, b, i)}
                      className={cn('h-7', l.qtd && 'border-emerald-300 bg-emerald-50')}
                      aria-label={`Quantidade com ${l.comp || '?'} m`}
                    />
                    <span className={cn('text-right text-xs tabular-nums', vols[i] ? 'text-slate-900' : 'text-slate-300')}>
                      {vols[i] ? m3(vols[i]!) : '—'}
                    </span>
                    {l.extra
                      ? <Remover rotulo="Remover comprimento" onClick={() => mudarBloco(b.id, x => ({ ...x, linhas: x.linhas.filter(y => y.id !== l.id) }))} />
                      : <span />}
                  </div>
                ))}
              </div>

              <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2 text-sm">
                <button type="button" onClick={() => inserirExtra(b)} className="rounded px-2 py-1 text-sky-700 hover:bg-sky-50">
                  + Comprimento
                </button>
                <span className="tabular-nums text-slate-600">
                  {pecas} pç · <strong className="text-slate-900">{m3(somar(vols))} m³</strong>
                </span>
              </div>
            </div>
          )
        })}
        <NovoBloco rotulo="Adicionar largura" onClick={adicionarBloco} />
      </div>
      <Atalhos itens={[
        ['Enter', 'próxima linha (na última, próximo bloco)'],
        ['↑ ↓', 'linha de cima/baixo'],
        ['Shift+Tab', 'volta'],
        ['Esc', 'apaga comprimento extra'],
      ]} />
    </div>
  )
}
