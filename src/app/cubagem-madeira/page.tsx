import Link from 'next/link'
import { Calculadora } from './calculadora'

const PERGUNTAS: { pergunta: string; resposta: string }[] = [
  {
    pergunta: 'Como calcular o volume de uma tora?',
    resposta: 'Pelo método geométrico (Smalian): meça o diâmetro da base e do topo em centímetros, calcule a área de cada ponta (π × diâmetro² ÷ 4, com o diâmetro em metros), tire a média das duas áreas e multiplique pelo comprimento em metros. O resultado sai em metros cúbicos.',
  },
  {
    pergunta: 'Qual a diferença entre o método geométrico e o Francon?',
    resposta: 'O geométrico dá o volume real da tora. O Francon usa a circunferência no meio da tora: (circunferência ÷ 4)² × comprimento. Ele resulta em cerca de 78,5% do volume geométrico e é usado na compra e venda de toras como volume comercial, descontando casca e perdas.',
  },
  {
    pergunta: 'Como calcular o metro cúbico de madeira serrada?',
    resposta: 'Multiplique espessura × largura × comprimento × número de peças, tudo em metros. Ex.: 10 tábuas de 5 × 20 cm com 3 m: 0,05 × 0,20 × 3 × 10 = 0,30 m³.',
  },
  {
    pergunta: 'Como converter polegadas para calcular o m³?',
    resposta: 'Uma polegada tem 2,54 cm. Uma peça de 2 × 8 polegadas tem 5,08 × 20,32 cm. Na calculadora, escolha Polegadas e digite as medidas como vêm no pedido; o comprimento continua em metros.',
  },
  {
    pergunta: 'Qual a diferença entre romaneio padrão e largura aberta?',
    resposta: 'No romaneio padrão as peças têm bitola e largura fixas (ex.: 5 × 20 cm) e você conta quantas há em cada comprimento. Na largura aberta só a bitola (espessura) é fixa: cada peça tem a sua largura, então o romaneio lista a largura de peça por peça em cada comprimento. A calculadora tem os dois modelos, além da lista livre.',
  },
  {
    pergunta: 'Quantos m³ de madeira serrada saem de 1 m³ de tora?',
    resposta: 'A referência da Resolução CONAMA nº 411/2009 é um coeficiente de rendimento volumétrico de 35%: cerca de 0,35 m³ de serrada por m³ de tora. O rendimento real depende da espécie, do diâmetro e da serraria, e o órgão ambiental pode aceitar outro coeficiente com estudo técnico.',
  },
  {
    pergunta: 'Onde medir o diâmetro da tora?',
    resposta: 'Nas duas pontas, sem casca, em centímetros. Como a seção raramente é um círculo perfeito, o costume é tirar duas medidas cruzadas em cada ponta e usar a média. A calculadora aceita as duas medidas, mas a segunda é opcional.',
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
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 print:hidden">Todo o Brasil · Tora e serrada</p>
        <h1 className="text-2xl font-semibold">Cubagem de madeira</h1>
        <p className="text-sm text-slate-500">
          Romaneio de toras (geométrico ou Francon) por espécie e de madeira serrada no modelo padrão ou largura aberta,
          com o total em m³ e o valor da carga. Lance tudo pelo teclado.
        </p>
        <p className="mt-1 text-sm print:hidden">
          <Link href="/cubagem-madeira/como-calcular" className="text-sky-700 hover:underline">Fórmulas e exemplos resolvidos</Link>
        </p>
      </header>

      <Calculadora />

      <section className="mt-12 max-w-4xl space-y-3 print:hidden">
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
          Vai transportar a madeira? Confira o{' '}
          <Link href="/piso-minimo-frete" className="text-sky-700 hover:underline">piso mínimo de frete da ANTT</Link>{' '}
          e, em Mato Grosso, o <Link href="/mt/fethab" className="text-sky-700 hover:underline">FETHAB da madeira</Link>.
        </p>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
    </main>
  )
}
