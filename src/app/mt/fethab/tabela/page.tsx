import { Artigo, Chamada, Secao, TabelaRolavel } from '@/components/conteudo'
import { GRUPOS, PRODUTOS, UNIDADE_LABEL, UPF_FETHAB, percentuaisLocais, valorPorUnidade } from '@/lib/fethab'
import { metadataPagina } from '@/lib/site'

const CAMINHO = '/mt/fethab/tabela'
// Valores de 2026 (a tabela é a mesma de janeiro a dezembro).
const PERIODO = '12/2026'

export const metadata = metadataPagina({
  titulo: 'Tabela do FETHAB 2026: valores e códigos de receita',
  descricao: `Valor do FETHAB em 2026 por tonelada, cabeça ou m³ (UPF/MT de R$ ${UPF_FETHAB.toLocaleString('pt-BR')}), com os códigos de receita do FETHAB e da contribuição à entidade: soja 7237, milho 7235, gado 7241, madeira 7239 e grãos.`,
  caminho: CAMINHO,
})

const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 })
const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}%`

const linhas = PRODUTOS.map(p => {
  const vigente = percentuaisLocais(p, PERIODO)
  const fethab = vigente ? valorPorUnidade(vigente.fethab) : null
  const entidade = vigente?.entidade !== undefined ? valorPorUnidade(vigente.entidade) : null
  return { p, vigente, fethab, entidade, total: (fethab ?? 0) + (entidade ?? 0) }
})

export default function Page() {
  return (
    <Artigo
      caminho={CAMINHO}
      trilha={[{ href: '/mt/fethab', label: 'FETHAB MT' }]}
      titulo="Tabela do FETHAB 2026: valores e códigos de receita"
      atualizado="21/11/2026"
      intro={
        <>
          <p>
            O FETHAB (Fundo Estadual de Transporte e Habitação) de Mato Grosso é cobrado por unidade do produto:
            tonelada, cabeça ou metro cúbico. O valor é um percentual da UPF/MT. A maioria dos produtos também paga a
            contribuição à entidade do setor, que sai em um DAR separado, com código próprio.
          </p>
          <p>
            Os valores abaixo foram conferidos no emissor de DAR da SEFAZ-MT em 21/11/2026, que usa a{' '}
            <strong>UPF de {reais(UPF_FETHAB)}</strong>.
          </p>
        </>
      }
    >
      <Chamada
        href="/mt/fethab"
        titulo="Calcule pela quantidade e gere o DAR"
        texto="Importe o XML da NF-e: o GeraGuia acha o produto, consulta o valor na SEFAZ-MT e gera os DARs em PDF."
        botao="Calcular FETHAB"
      />

      <Secao titulo="Como calcular">
        <div className="rounded-xl border bg-white p-4 font-mono text-sm space-y-1">
          <div>Valor por unidade = UPF × percentual</div>
          <div>FETHAB a recolher = quantidade × valor por unidade</div>
        </div>
        <p>
          Exemplo com madeira: 10% da UPF dá {reais(valorPorUnidade(10))} por m³ de FETHAB (código 7239), mais 3,71% da
          UPF, {reais(valorPorUnidade(3.71))} por m³, de contribuição à entidade (código 8097). Uma carga de 30 m³ paga{' '}
          {reais(Math.round(30 * valorPorUnidade(10) * 100) / 100)} de FETHAB e{' '}
          {reais(Math.round(30 * valorPorUnidade(3.71) * 100) / 100)} à entidade, em dois DARs.
        </p>
      </Secao>

      {GRUPOS.map(grupo => {
        const doGrupo = linhas.filter(l => l.p.grupo === grupo)
        const incidencias = Array.from(new Set(doGrupo.map(l => l.p.incidencia)))
        const composicoes = doGrupo.filter(l => l.p.composicao)
        return (
          <Secao key={grupo} titulo={grupo} id={grupo.toLowerCase()}>
            <TabelaRolavel legenda={`FETHAB 2026: ${grupo}`}>
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Produto</th>
                  <th className="text-right font-medium px-3 py-2 whitespace-nowrap">Código FETHAB</th>
                  <th className="text-right font-medium px-3 py-2 whitespace-nowrap">FETHAB</th>
                  <th className="text-right font-medium px-3 py-2 whitespace-nowrap">Código entidade</th>
                  <th className="text-right font-medium px-3 py-2 whitespace-nowrap">Entidade</th>
                  <th className="text-right font-medium px-3 py-2 whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody>
                {doGrupo.map(({ p, vigente, fethab, entidade, total }) => {
                  const un = UNIDADE_LABEL[p.unidade].curta
                  return (
                    <tr key={p.id} className="border-t align-top">
                      <td className="px-3 py-2 font-medium text-slate-800">{p.nome}<div className="text-xs font-normal text-slate-400">por {un}</div></td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.codigoFethab}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                        {fethab !== null ? reais(fethab) : '—'}
                        {vigente && <div className="text-xs text-slate-400">{pct(vigente.fethab)} UPF</div>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.codigoEntidade ?? '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                        {entidade !== null ? reais(entidade) : '—'}
                        {vigente?.entidade !== undefined && <div className="text-xs text-slate-400">{pct(vigente.entidade)} UPF</div>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap font-medium">{reais(total)}<div className="text-xs font-normal text-slate-400">por {un}</div></td>
                    </tr>
                  )
                })}
              </tbody>
            </TabelaRolavel>
            <div className="text-sm space-y-1">
              {incidencias.map(i => <p key={i}><strong>Quem paga:</strong> {i}</p>)}
              {composicoes.map(({ p }) => <p key={p.id}><strong>{p.nome}:</strong> {p.composicao}.</p>)}
            </div>
          </Secao>
        )
      })}

      <Secao titulo="Observações">
        <ul className="list-disc pl-5 space-y-1">
          <li>Em dezembro de 2025, feijão, gergelim, milheto, painço e os demais grãos ainda tinham os percentuais antigos. Os da tabela valem desde janeiro de 2026 (Lei 12.751/2024).</li>
          <li>Na soja, no algodão e no gado, o adicional já está somado no mesmo código de receita.</li>
          <li>Se a SEFAZ-MT mudar a UPF ou um percentual, o GeraGuia segue o valor que o emissor da SEFAZ calcular na hora de gerar o DAR.</li>
        </ul>
      </Secao>

      <Chamada
        href="/mt/fethab/como-emitir"
        titulo="Primeira vez emitindo?"
        texto="Veja o passo a passo para emitir o DAR do FETHAB com o XML da NF-e."
        botao="Ver passo a passo"
      />
    </Artigo>
  )
}
