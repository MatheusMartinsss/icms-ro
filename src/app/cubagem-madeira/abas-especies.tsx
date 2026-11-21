'use client'

import { useEffect, useRef } from 'react'
import { m3 } from '@/lib/cubagem'
import { cn } from '@/lib/utils'
import { CLS_INPUT, Remover, focar } from './campos'
import { nomeEspecie, novaEspecieSerrada, type EspecieSerrada, type Faixa, type Parcial } from './romaneio'

const sel = {
  aba: (id: number) => `[data-es-aba="${id}"]`,
  nome: (id: number) => `[data-es-nome="${id}"]`,
  preco: (id: number) => `[data-es-preco="${id}"]`,
  form: '[data-form-serrada] input',
}

// Uma aba por espécie de madeira serrada; cada uma tem o seu romaneio e o seu preço.
export function AbasEspecies({ especies, ativa, parciais, faixa, temPrecoGeral, onAtivar, onMudar, onAdicionar, onRemover }: {
  especies: EspecieSerrada[]
  ativa: EspecieSerrada
  parciais: Parcial[]
  faixa: Faixa
  temPrecoGeral: boolean
  onAtivar: (id: number) => void
  onMudar: (id: number, campos: Partial<Pick<EspecieSerrada, 'especie' | 'preco'>>) => void
  onAdicionar: (nova: EspecieSerrada) => void
  onRemover: (id: number) => void
}) {
  const volume = (id: number) => parciais.find(p => p.id === id)?.volume ?? 0
  const lista = useRef<HTMLDivElement>(null)

  // Mantém a aba ativa visível na rolagem horizontal (sem mexer na rolagem da página).
  useEffect(() => {
    const el = lista.current
    const aba = el?.querySelector<HTMLElement>(sel.aba(ativa.id))
    if (!el || !aba) return
    if (aba.offsetLeft < el.scrollLeft) el.scrollLeft = aba.offsetLeft - 8
    else if (aba.offsetLeft + aba.offsetWidth > el.scrollLeft + el.clientWidth) el.scrollLeft = aba.offsetLeft + aba.offsetWidth - el.clientWidth + 8
  }, [ativa.id, especies.length])

  function adicionar() {
    const nova = novaEspecieSerrada(faixa)
    focar(sel.nome(nova.id), () => onAdicionar(nova))
  }

  function teclaAba(e: React.KeyboardEvent, i: number) {
    const j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -1
    if (j < 0 || j >= especies.length) return
    e.preventDefault()
    focar(sel.aba(especies[j].id), () => onAtivar(especies[j].id))
  }

  function remover() {
    const nome = nomeEspecie(ativa.especie, especies.indexOf(ativa))
    if (volume(ativa.id) && !window.confirm(`Apagar ${nome} e tudo que foi lançado nela?`)) return
    onRemover(ativa.id)
  }

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="flex items-end">
      <div ref={lista} role="tablist" aria-label="Espécies" className="relative flex min-w-0 flex-1 items-end gap-1 overflow-x-auto overflow-y-hidden border-b px-2 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {especies.map((s, i) => {
          const atual = s.id === ativa.id
          const v = volume(s.id)
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              data-es-aba={s.id}
              aria-selected={atual}
              tabIndex={atual ? 0 : -1}
              onClick={() => onAtivar(s.id)}
              onKeyDown={e => teclaAba(e, i)}
              className={cn(
                '-mb-px shrink-0 rounded-t-md border px-3 py-1.5 text-left text-sm',
                atual ? 'border-slate-200 border-b-white bg-white font-medium text-slate-900' : 'border-transparent text-slate-500 hover:bg-slate-50',
              )}
            >
              {nomeEspecie(s.especie, i)}
              <span className={cn('ml-1.5 text-xs tabular-nums', atual ? 'text-slate-500' : 'text-slate-400')}>{v ? `${m3(v)} m³` : ''}</span>
            </button>
          )
        })}
      </div>
      {/* Fora da rolagem das abas: sempre visível, mesmo com muitas espécies no celular. */}
      <div className="shrink-0 border-b py-1 pl-1 pr-2">
        <button type="button" onClick={adicionar} className="whitespace-nowrap rounded px-2.5 py-1 text-sm text-sky-700 hover:bg-sky-50">
          + Espécie
        </button>
      </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 p-3">
        <label className="min-w-0 flex-1 basis-36 text-[11px] leading-4 text-slate-500">
          Espécie
          <input
            data-es-nome={ativa.id}
            value={ativa.especie}
            onChange={e => onMudar(ativa.id, { especie: e.target.value.slice(0, 60) })}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focar(sel.preco(ativa.id)) } }}
            placeholder="Ex.: Cedrinho"
            autoComplete="off"
            enterKeyHint="next"
            className={cn(CLS_INPUT, 'font-medium')}
          />
        </label>
        <label className="w-28 text-[11px] leading-4 text-slate-500">
          R$/m³ {temPrecoGeral ? '(ou o geral)' : '(opcional)'}
          <input
            data-es-preco={ativa.id}
            inputMode="decimal"
            value={ativa.preco}
            onChange={e => onMudar(ativa.id, { preco: e.target.value.slice(0, 14) })}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focar(sel.form) } }}
            placeholder="0,00"
            autoComplete="off"
            enterKeyHint="next"
            className={CLS_INPUT}
          />
        </label>
        {especies.length > 1 && <Remover rotulo={`Remover ${nomeEspecie(ativa.especie, especies.indexOf(ativa))}`} onClick={remover} className="mb-1.5" />}
      </div>
    </div>
  )
}
