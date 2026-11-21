'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTransportadoras } from '@/components/transportadora-context'
import { formatCnpj } from '@/lib/cnpj'
import { ESTADOS, FERRAMENTAS, STATUS_LABEL, disponivel, nomeFerramenta, type Ferramenta } from '@/lib/ferramentas'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/empresas', label: 'Empresas' },
  { href: '/historico', label: 'Histórico' },
]

const linkClasse = (ativo: boolean) => cn(
  'px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100',
  ativo && 'bg-slate-100 text-slate-900 font-medium',
)

function MenuFerramentas({ pathname }: { pathname: string }) {
  const [aberto, setAberto] = useState(false)
  useEffect(() => setAberto(false), [pathname])

  const atual = FERRAMENTAS.find(f => pathname.startsWith(f.href))
  const ufs = Object.keys(ESTADOS) as Ferramenta['uf'][]

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger className={cn(linkClasse(!!atual), 'flex items-center gap-1')}>
        {atual ? nomeFerramenta(atual) : 'Ferramentas'}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        {ufs.map(uf => (
          <div key={uf} className="py-1">
            <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{ESTADOS[uf]}</div>
            {FERRAMENTAS.filter(f => f.uf === uf).map(f => {
              const item = (
                <>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{f.titulo}</div>
                    <div className="text-xs text-slate-500 truncate">{f.guia}</div>
                  </div>
                  {f.status !== 'disponivel' && (
                    <span className={cn('text-[10px] rounded-full px-1.5 py-0.5 shrink-0', STATUS_LABEL[f.status].className)}>
                      {STATUS_LABEL[f.status].label}
                    </span>
                  )}
                </>
              )
              return disponivel(f) ? (
                <Link key={f.id} href={f.href} className={cn('flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-slate-100', atual?.id === f.id && 'bg-slate-100')}>
                  {item}
                </Link>
              ) : (
                <div key={f.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 opacity-60 cursor-default">{item}</div>
              )
            })}
          </div>
        ))}
        <Link href="/" className="block border-t mt-1 pt-2 px-2 pb-1 text-xs text-sky-700 hover:underline">Ver todas as ferramentas</Link>
      </PopoverContent>
    </Popover>
  )
}

export default function Navbar() {
  const pathname = usePathname()
  const { ativas, ativa, setAtivaId, carregando } = useTransportadoras()

  return (
    <header className="bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold">
            G
          </div>
          <span className="font-semibold hidden sm:inline">GeraGuia</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <MenuFerramentas pathname={pathname} />
          {LINKS.map(link => (
            <Link key={link.href} href={link.href} className={linkClasse(pathname.startsWith(link.href))}>
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Empresa em uso. Fica fora da home e só aparece quando há o que escolher;
            sem empresa, a ferramenta pede os dados na hora de gerar a guia. */}
        {pathname !== '/' && !carregando && ativas.length > 0 && (
          <div className="ml-auto">
            <Select value={ativa?.id ?? ''} onValueChange={setAtivaId}>
              <SelectTrigger className="w-[260px] h-9 text-sm" aria-label="Empresa em uso">
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                {ativas.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="font-medium">{t.nomeFantasia || t.razaoSocial}</span>
                    <span className="text-slate-400 ml-2 text-xs">{formatCnpj(t.cnpj)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </header>
  )
}
