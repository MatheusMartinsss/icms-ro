import Link from 'next/link'
import { ESTADOS, FERRAMENTAS, STATUS_LABEL, disponivel, type Ferramenta } from '@/lib/ferramentas'
import { PAGINAS_CONTEUDO } from '@/lib/site'
import { cn } from '@/lib/utils'

function CardFerramenta({ f }: { f: Ferramenta }) {
  const status = STATUS_LABEL[f.status]
  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{f.titulo}</h3>
          <p className="text-xs text-slate-500">{f.guia}</p>
        </div>
        <span className={cn('text-xs rounded-full px-2 py-0.5 shrink-0', status.className)}>{status.label}</span>
      </div>
      <p className="mt-3 text-sm text-slate-600">{f.descricao}</p>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-slate-500">Para: {f.quemUsa}</span>
        {disponivel(f) && <span className="font-medium text-sky-700 group-hover:underline">Abrir →</span>}
      </div>
    </>
  )

  const base = 'block bg-white border rounded-2xl p-5 shadow-sm h-full'
  if (!disponivel(f)) {
    return <div className={cn(base, 'opacity-70')} aria-disabled>{conteudo}</div>
  }
  return (
    <Link href={f.href} className={cn(base, 'group hover:border-sky-300 hover:shadow-md transition')}>
      {conteudo}
    </Link>
  )
}

export default function Home() {
  const porEstado = (Object.keys(ESTADOS) as Ferramenta['uf'][])
    .map(uf => ({ uf, ferramentas: FERRAMENTAS.filter(f => f.uf === uf) }))
    .filter(g => g.ferramentas.length > 0)

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <section className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Guias de tributos estaduais, prontas para pagar</h1>
        <p className="mt-2 text-slate-600 max-w-2xl">
          Calcule o imposto e gere a guia sem entrar no portal da secretaria. Sem cadastro: suas empresas e
          o histórico ficam salvos neste navegador.
        </p>
      </section>

      <div className="space-y-10">
        {porEstado.map(({ uf, ferramentas }) => (
          <section key={uf}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
              {ESTADOS[uf]}{uf !== 'BR' && <span className="text-slate-400"> · {uf}</span>}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ferramentas.map(f => <CardFerramenta key={f.id} f={f} />)}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">Tabelas e passo a passo</h2>
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PAGINAS_CONTEUDO.map(p => (
            <li key={p.href}>
              <Link href={p.href} className="block h-full bg-white border rounded-2xl p-5 hover:border-sky-300 hover:shadow-md transition">
                <h3 className="font-semibold">{p.titulo}</h3>
                <p className="mt-2 text-sm text-slate-600">{p.resumo}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
