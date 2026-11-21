import Link from 'next/link'
import { DIESEL_REFERENCIA } from '@/lib/piso-antt'
import { Calculadora } from './calculadora'

const PERGUNTAS: { pergunta: string; resposta: string }[] = [
  {
    pergunta: 'Como é calculado o piso mínimo de frete?',
    resposta: 'Piso = distância × CCD + CC. O CCD é o coeficiente de deslocamento, em reais por quilômetro, e o CC é o coeficiente de carga e descarga, em reais. Os dois dependem da tabela, do tipo de carga e do número de eixos. Com retorno vazio, soma-se 0,92 × distância × CCD.',
  },
  {
    pergunta: 'Qual tabela usar: A, B, C ou D?',
    resposta: 'Tabela A quando o veículo completo é contratado (caminhão, ou cavalo mecânico com o implemento do transportador). Tabela B quando só o cavalo mecânico é contratado e a carreta é do contratante. As tabelas C e D são as mesmas situações em operações de alto desempenho, com carga e descarga mais rápidas, em geral carga fidelizada.',
  },
  {
    pergunta: 'Quando o retorno vazio é obrigatório?',
    resposta: 'No transporte de contêiner e quando o veículo trabalha em frota dedicada ou fidelizada, ou não pode levar outra carga na volta por razão sanitária. Nesses casos o piso soma o retorno vazio, que é 92% do valor do deslocamento.',
  },
  {
    pergunta: 'O pedágio entra no piso mínimo?',
    resposta: 'Não. O pedágio é pago à parte pelo contratante, com o vale-pedágio obrigatório, e não faz parte do valor do frete.',
  },
  {
    pergunta: 'Qual tabela da ANTT está valendo?',
    resposta: `A da Portaria SUROC nº 22/2026, em vigor desde 30/09/2026, calculada com o diesel de referência de R$ ${DIESEL_REFERENCIA.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} por litro.`,
  },
  {
    pergunta: 'Meu conjunto tem 8 eixos. Qual coeficiente usar?',
    resposta: 'A tabela não tem 8 eixos. Pela regra da ANTT, quando não há coeficiente para a quantidade de eixos, usa-se a imediatamente inferior (7 eixos). Se não houver inferior, usa-se a superior. A calculadora já faz isso.',
  },
]

const FAQ_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: PERGUNTAS.map(p => ({ '@type': 'Question', name: p.pergunta, acceptedAnswer: { '@type': 'Answer', text: p.resposta } })),
}

export default function Page() {
  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Todo o Brasil · Tabela ANTT 2026</p>
        <h1 className="text-2xl font-semibold">Piso mínimo de frete</h1>
        <p className="text-sm text-slate-500">
          Valor mínimo do frete rodoviário de carga pela Resolução ANTT nº 5.867/2020, com os coeficientes da Portaria SUROC nº 22/2026.
        </p>
        <p className="mt-1 text-sm">
          <Link href="/piso-minimo-frete/tabela" className="text-sky-700 hover:underline">Tabelas A, B, C e D completas</Link>
        </p>
      </header>

      <Calculadora />

      <section className="mt-12 max-w-4xl space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Perguntas frequentes</h2>
        <div className="divide-y rounded-xl border bg-white">
          {PERGUNTAS.map(p => (
            <details key={p.pergunta} className="group p-4">
              <summary className="cursor-pointer list-none font-medium text-slate-900 flex justify-between gap-4">
                {p.pergunta}
                <span className="text-slate-400 group-open:rotate-45 transition" aria-hidden>+</span>
              </summary>
              <p className="mt-2 text-sm text-slate-700">{p.resposta}</p>
            </details>
          ))}
        </div>
        <p className="text-sm text-slate-600">
          Transporte saindo de Rondônia? Calcule o ICMS do frete e gere o DARE no{' '}
          <Link href="/ro/icms-frete" className="text-sky-700 hover:underline">ICMS Frete RO</Link>.
        </p>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
    </main>
  )
}
