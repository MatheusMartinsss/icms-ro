import Link from 'next/link'
import { FERRAMENTAS, disponivel } from '@/lib/ferramentas'
import { PAGINAS_CONTEUDO } from '@/lib/site'

export default function Rodape() {
  return (
    <footer className="mt-16 border-t bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid gap-8 sm:grid-cols-3 text-sm">
        <div>
          <div className="font-semibold">GeraGuia</div>
          <p className="mt-2 text-slate-500">
            Guias de tributos estaduais, prontas para pagar. O valor é sempre conferido no sistema da secretaria
            antes de gerar a guia.
          </p>
        </div>
        <nav aria-label="Ferramentas">
          <div className="font-semibold">Ferramentas</div>
          <ul className="mt-2 space-y-1">
            {FERRAMENTAS.filter(disponivel).map(f => (
              <li key={f.id}><Link href={f.href} className="text-slate-600 hover:text-sky-700">{f.titulo} {f.uf}</Link></li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Tabelas e guias">
          <div className="font-semibold">Tabelas e passo a passo</div>
          <ul className="mt-2 space-y-1">
            {PAGINAS_CONTEUDO.map(p => (
              <li key={p.href}><Link href={p.href} className="text-slate-600 hover:text-sky-700">{p.titulo}</Link></li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  )
}
