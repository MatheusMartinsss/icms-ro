import { Artigo, Chamada, Secao, TabelaRolavel } from '@/components/conteudo'
import { PARAMETROS_PADRAO, SCALE, TIPOS_CARGA, calcularBaseTotal, calcularIcms, eixosDisponiveis, formatPercent, formatReais } from '@/lib/calculo'
import { metadataPagina } from '@/lib/site'

const CAMINHO = '/ro/icms-frete/tabela'

export const metadata = metadataPagina({
  titulo: 'Tabela do ICMS frete RO 2026: coeficientes da ANTT',
  descricao: 'Coeficientes CCD (R$/km) e CC (R$) da tabela de pisos mínimos de frete da ANTT para todos os tipos de carga e eixos, a fórmula da base de cálculo do ICMS do frete em RO e um exemplo resolvido.',
  caminho: CAMINHO,
})

const coeficiente = (valorInt: number, casas: number) =>
  (valorInt / SCALE).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

type Coeficientes = NonNullable<ReturnType<typeof calcularBaseTotal>>

const linhas = TIPOS_CARGA.map(t => {
  const porEixo: Record<string, Coeficientes> = {}
  for (const e of eixosDisponiveis(t.value)) {
    const c = calcularBaseTotal(t.value, e, 0)
    if (c) porEixo[e] = c
  }
  return { ...t, porEixo }
})
const EIXOS = Array.from(new Set(linhas.flatMap(l => Object.keys(l.porEixo)))).sort((a, b) => Number(a) - Number(b))

// Exemplo resolvido com os números da própria tabela.
const EXEMPLO = { tipo: 'granel_solido', eixos: '5', km: 500 }
const exBase = calcularBaseTotal(EXEMPLO.tipo, EXEMPLO.eixos, EXEMPLO.km)!
const exIcms = calcularIcms(exBase.totalInt, PARAMETROS_PADRAO)
const aliquota = `${formatPercent(PARAMETROS_PADRAO.aliquotaIcms)}%`
const reducao = `${formatPercent(PARAMETROS_PADRAO.percentualReducao)}%`

function TabelaCoeficientes({ campo, legenda }: { campo: 'ccdInt' | 'ccInt'; legenda: string }) {
  return (
    <TabelaRolavel legenda={legenda}>
      <thead className="bg-slate-50 text-slate-600">
        <tr>
          <th className="text-left font-medium px-3 py-2">Tipo de carga</th>
          {EIXOS.map(e => <th key={e} className="text-right font-medium px-3 py-2 whitespace-nowrap">{e} eixos</th>)}
        </tr>
      </thead>
      <tbody>
        {linhas.map(l => (
          <tr key={l.value} className="border-t">
            <td className="px-3 py-2 font-medium text-slate-800">{l.label}</td>
            {EIXOS.map(e => (
              <td key={e} className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                {l.porEixo[e] ? coeficiente(l.porEixo[e][campo], campo === 'ccdInt' ? 4 : 2) : <span className="text-slate-300">—</span>}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </TabelaRolavel>
  )
}

export default function Page() {
  return (
    <Artigo
      caminho={CAMINHO}
      trilha={[{ href: '/ro/icms-frete', label: 'ICMS Frete RO' }]}
      titulo="Tabela do ICMS frete em Rondônia (ANTT 2026)"
      atualizado="21/11/2026"
      intro={
        <p>
          A base de cálculo do ICMS do frete usada no GeraGuia vem da tabela de pisos mínimos de frete da ANTT,
          na versão da <strong>Portaria SUROC nº 22/2026</strong>. Abaixo estão todos os coeficientes, a fórmula e um
          exemplo resolvido.
        </p>
      }
    >
      <Chamada
        href="/ro/icms-frete"
        titulo="Calcule e gere o DARE direto do XML da NF-e"
        texto="A calculadora aplica esta tabela, faz o rateio da carga fracionada e emite o DARE da SEFIN-RO."
        botao="Abrir calculadora"
      />

      <Secao titulo="Como a base de cálculo é formada">
        <p>Para cada viagem, a tabela da ANTT dá dois coeficientes, conforme o tipo de carga e o número de eixos carregados:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>CCD</strong>: coeficiente de custo de deslocamento, em reais por quilômetro.</li>
          <li><strong>CC</strong>: coeficiente de carga e descarga, um valor fixo em reais por viagem.</li>
        </ul>
        <div className="rounded-xl border bg-white p-4 font-mono text-sm space-y-1">
          <div>Base de cálculo = CCD × distância (km) + CC</div>
          <div>ICMS = base × alíquota − redução</div>
        </div>
        <p>
          O padrão do GeraGuia é alíquota de {aliquota} com redução de {reducao} sobre o imposto. Os dois percentuais
          podem ser ajustados no cadastro de cada empresa. Confira o enquadramento da sua com o seu contador.
        </p>
        <p>
          Na <strong>carga fracionada</strong> (várias notas no mesmo caminhão), a base da viagem é dividida entre as
          notas pelo peso: base da nota = base da viagem × peso da nota ÷ peso total da carga.
        </p>
      </Secao>

      <Secao titulo="Exemplo: granel sólido, 5 eixos, 500 km">
        <TabelaRolavel legenda="Exemplo de cálculo">
          <tbody>
            <tr><td className="px-3 py-2">CCD × distância</td><td className="px-3 py-2 text-right tabular-nums">{coeficiente(exBase.ccdInt, 4)} × {EXEMPLO.km} km = {formatReais(exBase.ccdInt * EXEMPLO.km)}</td></tr>
            <tr className="border-t"><td className="px-3 py-2">+ CC</td><td className="px-3 py-2 text-right tabular-nums">{formatReais(exBase.ccInt)}</td></tr>
            <tr className="border-t font-medium"><td className="px-3 py-2">Base de cálculo</td><td className="px-3 py-2 text-right tabular-nums">{formatReais(exBase.totalInt)}</td></tr>
            <tr className="border-t"><td className="px-3 py-2">ICMS ({aliquota})</td><td className="px-3 py-2 text-right tabular-nums">{formatReais(exIcms.icms)}</td></tr>
            <tr className="border-t"><td className="px-3 py-2">− Redução ({reducao})</td><td className="px-3 py-2 text-right tabular-nums">{formatReais(exIcms.reducao)}</td></tr>
            <tr className="border-t font-semibold text-slate-900"><td className="px-3 py-2">ICMS a recolher</td><td className="px-3 py-2 text-right tabular-nums">{formatReais(exIcms.icmsReduzido)}</td></tr>
          </tbody>
        </TabelaRolavel>
      </Secao>

      <Secao titulo="CCD: custo de deslocamento (R$ por km)" id="ccd">
        <TabelaCoeficientes campo="ccdInt" legenda="Coeficiente CCD por tipo de carga e eixos" />
      </Secao>

      <Secao titulo="CC: carga e descarga (R$ por viagem)" id="cc">
        <TabelaCoeficientes campo="ccInt" legenda="Coeficiente CC por tipo de carga e eixos" />
        <p className="text-sm text-slate-500">
          “—” indica que a tabela não tem coeficiente para aquele número de eixos naquele tipo de carga.
          Fonte: tabela de pisos mínimos de frete da ANTT, Portaria SUROC nº 22/2026.
        </p>
      </Secao>

      <Chamada
        href="/ro/icms-frete"
        titulo="Não precisa fazer a conta na mão"
        texto="Carregue o XML da NF-e, informe distância e eixos, e o GeraGuia gera o DARE pronto para pagar."
        botao="Gerar DARE"
      />
    </Artigo>
  )
}
