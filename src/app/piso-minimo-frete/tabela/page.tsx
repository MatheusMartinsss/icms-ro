import Link from 'next/link'
import { Artigo, Chamada, Secao, TabelaRolavel } from '@/components/conteudo'
import {
  DIESEL_REFERENCIA, TABELA_INFO, TIPOS_CARGA_PISO, calcularPiso, coeficiente, eixosDaTabela, linhaTabela, reais,
  type TabelaId,
} from '@/lib/piso-antt'
import { metadataPagina } from '@/lib/site'

const CAMINHO = '/piso-minimo-frete/tabela'

export const metadata = metadataPagina({
  titulo: 'Tabela de frete ANTT 2026: pisos mínimos A, B, C e D',
  descricao: 'Coeficientes CCD (R$/km) e CC (R$) das tabelas A, B, C e D do piso mínimo de frete da ANTT, Portaria SUROC nº 22/2026, para os 12 tipos de carga e de 2 a 9 eixos, com a fórmula e exemplos.',
  caminho: CAMINHO,
})

const TABELAS: TabelaId[] = ['A', 'B', 'C', 'D']

// Exemplo resolvido com os números da própria tabela.
const EX = { tipo: 'geral', eixos: 5, km: 800 }
const exIda = calcularPiso({ ...EX, distanciaKm: EX.km, composicao: true, altoDesempenho: false, retornoVazio: false })!
const exRet = calcularPiso({ ...EX, distanciaKm: EX.km, composicao: true, altoDesempenho: false, retornoVazio: true })!

function TabelaPiso({ tabela }: { tabela: TabelaId }) {
  const eixos = Array.from(new Set(TIPOS_CARGA_PISO.flatMap(t => eixosDaTabela(tabela, t.value)))).sort((a, b) => Number(a) - Number(b))
  return (
    <TabelaRolavel legenda={`${TABELA_INFO[tabela].titulo}: CCD e CC por tipo de carga e eixos`}>
      <thead className="bg-slate-50 text-slate-600">
        <tr>
          <th className="text-left font-medium px-3 py-2">Tipo de carga</th>
          {eixos.map(e => <th key={e} className="text-right font-medium px-3 py-2 whitespace-nowrap">{e} eixos</th>)}
        </tr>
      </thead>
      <tbody>
        {TIPOS_CARGA_PISO.map(t => {
          const linha = linhaTabela(tabela, t.value)
          return (
            <tr key={t.value} className="border-t align-top">
              <td className="px-3 py-2 font-medium text-slate-800">{t.label}</td>
              {eixos.map(e => {
                const ccd = linha?.coeficientes.ccd[e]
                const cc = linha?.coeficientes.cc[e]
                return (
                  <td key={e} className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {ccd !== undefined && cc !== undefined ? (
                      <>
                        <div>{coeficiente(ccd, 4)}</div>
                        <div className="text-xs text-slate-400">{coeficiente(cc, 2)}</div>
                      </>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                )
              })}
            </tr>
          )
        })}
      </tbody>
    </TabelaRolavel>
  )
}

export default function Page() {
  return (
    <Artigo
      caminho={CAMINHO}
      trilha={[{ href: '/piso-minimo-frete', label: 'Piso mínimo de frete' }]}
      titulo="Tabela de frete ANTT 2026: pisos mínimos A, B, C e D"
      atualizado="21/11/2026"
      intro={
        <>
          <p>
            O piso mínimo de frete é o menor valor que pode ser pago pelo transporte rodoviário de carga no Brasil
            (Lei nº 13.703/2018). A ANTT publica os coeficientes na Resolução nº 5.867/2020. Os desta página são os da{' '}
            <strong>Portaria SUROC nº 22/2026</strong>, em vigor desde 30/09/2026, com diesel de referência de{' '}
            {reais(DIESEL_REFERENCIA)} por litro.
          </p>
          <p>Todos os valores foram conferidos com a calculadora oficial da ANTT em 21/11/2026.</p>
        </>
      }
    >
      <Chamada
        href="/piso-minimo-frete"
        titulo="Calcule o piso da sua viagem"
        texto="Escolha o tipo de carga, os eixos e a distância. A calculadora aplica a tabela certa e o retorno vazio."
        botao="Abrir calculadora"
      />

      <Secao titulo="Como calcular">
        <div className="rounded-xl border bg-white p-4 font-mono text-sm space-y-1">
          <div>Piso = distância (km) × CCD + CC</div>
          <div>Retorno vazio = 0,92 × distância (km) × CCD</div>
        </div>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>CCD</strong>: coeficiente de custo de deslocamento, em reais por quilômetro.</li>
          <li><strong>CC</strong>: coeficiente de carga e descarga, um valor fixo em reais por viagem.</li>
          <li>O retorno vazio só entra quando é obrigatório: contêiner, frota dedicada ou fidelizada, ou retorno sem carga por razão sanitária.</li>
          <li>Se a tabela não tem a quantidade de eixos do veículo, vale a imediatamente inferior; sem inferior, a superior.</li>
          <li>O pedágio é pago à parte, com o vale-pedágio, e não faz parte do piso.</li>
        </ul>
      </Secao>

      <Secao titulo={`Exemplo: carga geral, ${EX.eixos} eixos, ${EX.km} km (tabela A)`}>
        <TabelaRolavel legenda="Exemplo de cálculo">
          <tbody>
            <tr><td className="px-3 py-2">Distância × CCD</td><td className="px-3 py-2 text-right tabular-nums">{EX.km} × {coeficiente(exIda.ccd, 4)} = {reais(EX.km * exIda.ccd)}</td></tr>
            <tr className="border-t"><td className="px-3 py-2">+ CC</td><td className="px-3 py-2 text-right tabular-nums">{reais(exIda.cc)}</td></tr>
            <tr className="border-t font-medium"><td className="px-3 py-2">Piso mínimo</td><td className="px-3 py-2 text-right tabular-nums">{reais(exIda.total)}</td></tr>
            <tr className="border-t"><td className="px-3 py-2">Retorno vazio (0,92 × {EX.km} × {coeficiente(exIda.ccd, 4)})</td><td className="px-3 py-2 text-right tabular-nums">{reais(exRet.retorno)}</td></tr>
            <tr className="border-t font-semibold text-slate-900"><td className="px-3 py-2">Piso com retorno vazio</td><td className="px-3 py-2 text-right tabular-nums">{reais(exRet.total)}</td></tr>
          </tbody>
        </TabelaRolavel>
      </Secao>

      <Secao titulo="Qual tabela usar">
        <TabelaRolavel legenda="Quando usar cada tabela">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-medium px-3 py-2">Contratação</th>
              <th className="text-left font-medium px-3 py-2">Operação comum</th>
              <th className="text-left font-medium px-3 py-2">Alto desempenho</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t"><td className="px-3 py-2">Veículo completo (lotação)</td><td className="px-3 py-2"><a href="#tabela-a" className="text-sky-700 hover:underline">Tabela A</a></td><td className="px-3 py-2"><a href="#tabela-c" className="text-sky-700 hover:underline">Tabela C</a></td></tr>
            <tr className="border-t"><td className="px-3 py-2">Só o veículo automotor (cavalo)</td><td className="px-3 py-2"><a href="#tabela-b" className="text-sky-700 hover:underline">Tabela B</a></td><td className="px-3 py-2"><a href="#tabela-d" className="text-sky-700 hover:underline">Tabela D</a></td></tr>
          </tbody>
        </TabelaRolavel>
        <p className="text-sm">Alto desempenho são as operações com carga e descarga mais rápidas, em geral de carga fidelizada.</p>
      </Secao>

      {TABELAS.map(t => (
        <Secao key={t} titulo={`${TABELA_INFO[t].titulo}: ${TABELA_INFO[t].resumo.charAt(0).toLowerCase()}${TABELA_INFO[t].resumo.slice(1)}`} id={`tabela-${t.toLowerCase()}`}>
          <TabelaPiso tabela={t} />
          <p className="text-sm text-slate-500">Em cada célula: CCD em R$/km e, embaixo, CC em R$. “—”: sem coeficiente para aquele número de eixos.</p>
        </Secao>
      ))}

      <p className="text-sm">
        Para o ICMS do frete em Rondônia, que usa a tabela A como base de cálculo, veja a{' '}
        <Link href="/ro/icms-frete/tabela" className="text-sky-700 hover:underline">tabela do ICMS frete RO</Link>.
      </p>

      <Chamada
        href="/piso-minimo-frete"
        titulo="Não precisa fazer a conta na mão"
        texto="Grátis e sem cadastro. Confira também se o frete combinado está acima do piso."
        botao="Calcular piso mínimo"
      />
    </Artigo>
  )
}
