'use client'

import { forwardRef } from 'react'
import { flushSync } from 'react-dom'
import { cn } from '@/lib/utils'

export const CLS_INPUT =
  'h-8 w-full min-w-0 rounded border border-slate-300 bg-white px-1.5 text-sm tabular-nums placeholder:text-slate-300 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30'

export const limparNumero = (v: string) => v.replace(/[^\d.,]/g, '').slice(0, 8)
export const limparInteiro = (v: string) => v.replace(/\D/g, '').slice(0, 6)

// Aplica a mudança de estado na hora (flushSync) e foca o campo, para que a
// próxima tecla já caia nele mesmo quando o campo acabou de ser criado.
export function focar(seletor: string, mudanca?: () => void) {
  if (mudanca) flushSync(mudanca)
  const ir = () => {
    const el = document.querySelector<HTMLInputElement>(seletor)
    if (!el) return false
    el.focus()
    el.select?.()
    return true
  }
  if (!ir()) setTimeout(ir, 0)
}

export const Num = forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  valor: string
  onValor: (v: string) => void
  inteiro?: boolean
}>(function Num({ valor, onValor, inteiro, className, ...props }, ref) {
  return (
    <input
      ref={ref}
      inputMode={inteiro ? 'numeric' : 'decimal'}
      autoComplete="off"
      enterKeyHint="next"
      value={valor}
      onChange={e => onValor(inteiro ? limparInteiro(e.target.value) : limparNumero(e.target.value))}
      onFocus={e => e.target.select()}
      className={cn(CLS_INPUT, className)}
      {...props}
    />
  )
})

export function Alternativa<T extends string>({ valor, opcoes, onChange, rotulo, pequena }: {
  valor: T
  opcoes: { valor: T; label: string }[]
  onChange: (v: T) => void
  rotulo: string
  pequena?: boolean
}) {
  return (
    <div className="flex rounded-md border bg-white p-0.5" role="group" aria-label={rotulo}>
      {opcoes.map(o => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={cn(
            'flex-1 rounded whitespace-nowrap',
            pequena ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            valor === o.valor ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Grade de linhas × colunas (toras e lista livre). Cada campo navegável tem
// data-nav, data-row (id da linha) e data-col. Enter vai para o próximo campo;
// no último, aoFim() cria outra linha. Setas ↑/↓ mudam de linha na mesma coluna.
export function teclaGrade(e: React.KeyboardEvent<HTMLElement>, aoFim: () => void) {
  const alvo = e.target
  if (!(alvo instanceof HTMLInputElement) || alvo.dataset.nav === undefined) return
  const campos = Array.from(e.currentTarget.querySelectorAll<HTMLInputElement>('input[data-nav]'))
  const i = campos.indexOf(alvo)
  const ultimo = i === campos.length - 1
  const mover = (el?: HTMLInputElement) => { if (el) { el.focus(); el.select() } }

  if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey && ultimo)) {
    e.preventDefault()
    if (e.shiftKey) mover(campos[i - 1])
    else if (ultimo) aoFim()
    else mover(campos[i + 1])
    return
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const linhas = Array.from(new Set(campos.map(c => c.dataset.row)))
    const j = linhas.indexOf(alvo.dataset.row) + (e.key === 'ArrowDown' ? 1 : -1)
    if (j < 0 || j >= linhas.length) return
    e.preventDefault()
    mover(campos.find(c => c.dataset.row === linhas[j] && c.dataset.col === alvo.dataset.col))
  }
}

export function Remover({ rotulo, onClick, className }: { rotulo: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onClick}
      aria-label={rotulo}
      title={rotulo}
      className={cn('flex h-6 w-5 items-center justify-center rounded text-slate-300 hover:bg-red-50 hover:text-red-600', className)}
    >
      ✕
    </button>
  )
}

export function Atalhos({ itens }: { itens: [string, string][] }) {
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
      {itens.map(([tecla, acao]) => (
        <span key={tecla + acao}>
          <kbd className="rounded border bg-slate-50 px-1 font-sans text-slate-500">{tecla}</kbd> {acao}
        </span>
      ))}
    </p>
  )
}

export function NovoBloco({ rotulo, onClick }: { rotulo: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[64px] w-full items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-sm font-medium text-slate-500 hover:border-slate-400 hover:bg-white hover:text-slate-700"
    >
      + {rotulo}
    </button>
  )
}
