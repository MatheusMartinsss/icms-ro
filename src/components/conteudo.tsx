import Link from 'next/link'
import { PAGINAS_CONTEUDO, SITE_URL } from '@/lib/site'

// Moldura das páginas de tabela e passo a passo.
export function Artigo({ caminho, trilha, titulo, intro, atualizado, children }: {
  caminho: string
  trilha: { href: string; label: string }[]
  titulo: string
  intro: React.ReactNode
  atualizado: string // texto pronto, ex.: "21/11/2026"
  children: React.ReactNode
}) {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ href: '/', label: 'Início' }, ...trilha, { href: caminho, label: titulo }].map((t, i) => ({
      '@type': 'ListItem', position: i + 1, name: t.label, item: `${SITE_URL}${t.href === '/' ? '' : t.href}`,
    })),
  }
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <nav aria-label="Trilha" className="text-xs text-slate-500 mb-4 flex flex-wrap gap-1">
        <Link href="/" className="hover:text-sky-700">Início</Link>
        {trilha.map(t => (
          <span key={t.href} className="flex gap-1"><span aria-hidden>/</span><Link href={t.href} className="hover:text-sky-700">{t.label}</Link></span>
        ))}
      </nav>
      <article>
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">{titulo}</h1>
          <div className="mt-3 text-slate-600 space-y-2">{intro}</div>
          <p className="mt-3 text-xs text-slate-400">Atualizado em {atualizado}</p>
        </header>
        <div className="space-y-10 text-slate-700 leading-relaxed">{children}</div>
      </article>
      <Relacionadas atual={caminho} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
    </main>
  )
}

export function Secao({ titulo, children, id }: { titulo: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-900">{titulo}</h2>
      {children}
    </section>
  )
}

export function Chamada({ href, titulo, texto, botao }: { href: string; titulo: string; texto: string; botao: string }) {
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
      <div>
        <div className="font-semibold text-slate-900">{titulo}</div>
        <p className="mt-1 text-sm text-slate-600">{texto}</p>
      </div>
      <Link href={href} className="mt-4 sm:mt-0 inline-flex shrink-0 items-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800">
        {botao}
      </Link>
    </div>
  )
}

// Tabela larga: rola de lado no celular sem empurrar a página.
export function TabelaRolavel({ children, legenda }: { children: React.ReactNode; legenda?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-sm">
        {legenda && <caption className="sr-only">{legenda}</caption>}
        {children}
      </table>
    </div>
  )
}

function Relacionadas({ atual }: { atual: string }) {
  const outras = PAGINAS_CONTEUDO.filter(p => p.href !== atual)
  if (!outras.length) return null
  return (
    <aside className="mt-12 border-t pt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Veja também</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {outras.map(p => (
          <li key={p.href}>
            <Link href={p.href} className="block rounded-xl border bg-white p-4 hover:border-sky-300">
              <div className="font-medium text-slate-900">{p.titulo}</div>
              <p className="mt-1 text-sm text-slate-500">{p.resumo}</p>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  )
}
