import { Artigo, Chamada, Secao, TabelaRolavel } from '@/components/conteudo'
import { CRV_SERRADA, m3, volumeFrancon, volumeSerrada, volumeSmalian } from '@/lib/cubagem'
import { metadataPagina } from '@/lib/site'

const CAMINHO = '/cubagem-madeira/como-calcular'

export const metadata = metadataPagina({
  titulo: 'Como calcular a cubagem de madeira: fórmulas e exemplos',
  descricao: 'Como calcular o volume de madeira em m³: tora pelo método geométrico (Smalian) e pelo Francon, madeira serrada em centímetros e polegadas, romaneio e rendimento tora → serrada, com exemplos resolvidos.',
  caminho: CAMINHO,
})

const num = (v: number, casas: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

// Exemplos calculados com as mesmas funções da calculadora.
const S = { d1: 48, d2: 46, d3: 40, d4: 38, comp: 4.5 }
const sBase = (S.d1 + S.d2) / 2 / 100
const sTopo = (S.d3 + S.d4) / 2 / 100
const sABase = (Math.PI * sBase * sBase) / 4
const sATopo = (Math.PI * sTopo * sTopo) / 4
const sVol = volumeSmalian(S, S.comp)!

const F = { circ: 140, comp: 4.5 }
const fVol = volumeFrancon(F.circ, F.comp)!

const P = { esp: 5, larg: 20, comp: 3, qtd: 10 }
const pVol = volumeSerrada(P.esp, P.larg, P.comp, P.qtd, 'cm')!
const Q = { esp: 2, larg: 8, comp: 3, qtd: 10 }
const qVol = volumeSerrada(Q.esp, Q.larg, Q.comp, Q.qtd, 'pol')!

const Linha = ({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) => (
  <tr className={forte ? 'border-t font-semibold text-slate-900' : 'border-t first:border-t-0'}>
    <td className="px-3 py-2">{rotulo}</td>
    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{valor}</td>
  </tr>
)

export default function Page() {
  return (
    <Artigo
      caminho={CAMINHO}
      trilha={[{ href: '/cubagem-madeira', label: 'Cubagem de madeira' }]}
      titulo="Como calcular a cubagem de madeira"
      atualizado="21/11/2026"
      intro={
        <p>
          Cubagem é o cálculo do volume da madeira em metros cúbicos (m³). É ela que vai no romaneio, no preço da carga e
          nos documentos de transporte. A conta muda conforme a madeira está em tora ou já serrada.
        </p>
      }
    >
      <Chamada
        href="/cubagem-madeira"
        titulo="Faça o romaneio na calculadora"
        texto="Tora no geométrico ou Francon, serrada em cm ou polegadas, com total em m³ e valor da carga."
        botao="Abrir calculadora"
      />

      <Secao titulo="Tora: método geométrico (Smalian)">
        <p>
          É o volume real da tora. Usa a média das áreas das duas pontas, com o diâmetro medido sem casca. Como a seção
          raramente é redonda, tire duas medidas cruzadas em cada ponta e use a média.
        </p>
        <div className="rounded-xl border bg-white p-4 font-mono text-sm space-y-1">
          <div>Área da ponta = π × diâmetro² ÷ 4 (diâmetro em metros)</div>
          <div>Volume = (área da base + área do topo) ÷ 2 × comprimento</div>
        </div>
        <TabelaRolavel legenda={`Exemplo: tora com base ${S.d1}/${S.d2} cm, topo ${S.d3}/${S.d4} cm e ${num(S.comp, 2)} m`}>
          <tbody>
            <Linha rotulo={`Diâmetro da base: (${S.d1} + ${S.d2}) ÷ 2`} valor={`${num(sBase, 2)} m`} />
            <Linha rotulo={`Diâmetro do topo: (${S.d3} + ${S.d4}) ÷ 2`} valor={`${num(sTopo, 2)} m`} />
            <Linha rotulo={`Área da base: π × ${num(sBase, 2)}² ÷ 4`} valor={`${num(sABase, 4)} m²`} />
            <Linha rotulo={`Área do topo: π × ${num(sTopo, 2)}² ÷ 4`} valor={`${num(sATopo, 4)} m²`} />
            <Linha rotulo={`Volume: (${num(sABase, 4)} + ${num(sATopo, 4)}) ÷ 2 × ${num(S.comp, 2)}`} valor={`${m3(sVol)} m³`} forte />
          </tbody>
        </TabelaRolavel>
      </Secao>

      <Secao titulo="Tora: método Francon">
        <p>
          Comum na compra e venda de toras. Usa a circunferência medida no meio da tora. O resultado é cerca de 78,5% do
          volume geométrico (π ÷ 4), o que funciona como desconto de casca, rachaduras e perdas no desdobro.
        </p>
        <div className="rounded-xl border bg-white p-4 font-mono text-sm">Volume = (circunferência ÷ 4)² × comprimento</div>
        <TabelaRolavel legenda={`Exemplo: tora com ${F.circ} cm de circunferência e ${num(F.comp, 2)} m`}>
          <tbody>
            <Linha rotulo={`Circunferência ÷ 4: ${num(F.circ / 100, 2)} ÷ 4`} valor={`${num(F.circ / 400, 4)} m`} />
            <Linha rotulo={`Ao quadrado: ${num(F.circ / 400, 4)}²`} valor={`${num((F.circ / 400) ** 2, 4)} m²`} />
            <Linha rotulo={`Volume: ${num((F.circ / 400) ** 2, 4)} × ${num(F.comp, 2)}`} valor={`${m3(fVol)} m³`} forte />
          </tbody>
        </TabelaRolavel>
        <p className="text-sm">Combine antes com o comprador qual método vale e se a medida é com ou sem casca.</p>
      </Secao>

      <Secao titulo="Madeira serrada">
        <p>
          Tábuas, vigas, caibros e ripas são peças retangulares: o volume é o produto das três medidas, vezes a
          quantidade de peças. Converta espessura e largura para metros antes de multiplicar.
        </p>
        <div className="rounded-xl border bg-white p-4 font-mono text-sm">Volume = espessura × largura × comprimento × peças</div>
        <TabelaRolavel legenda="Exemplos de madeira serrada">
          <tbody>
            <Linha rotulo={`${P.qtd} peças de ${P.esp} × ${P.larg} cm com ${P.comp} m: 0,05 × 0,20 × ${P.comp} × ${P.qtd}`} valor={`${m3(pVol)} m³`} />
            <Linha rotulo={`${Q.qtd} peças de ${Q.esp} × ${Q.larg} pol com ${Q.comp} m: 0,0508 × 0,2032 × ${Q.comp} × ${Q.qtd}`} valor={`${m3(qVol)} m³`} />
          </tbody>
        </TabelaRolavel>
        <p className="text-sm">Uma polegada tem 2,54 cm. O comprimento é sempre em metros, mesmo quando a seção vem em polegadas.</p>
      </Secao>

      <Secao titulo="Romaneio">
        <p>
          O romaneio é a lista das toras ou peças de uma carga, com as medidas e o volume de cada linha. O total da carga
          é a soma das linhas. Nos romaneios de serraria, as peças costumam vir em blocos com a mesma bitola
          (espessura × largura) e comprimentos variados. Para chegar ao valor, multiplique o total em m³ pelo preço do m³.
        </p>
      </Secao>

      <Secao titulo="Rendimento: tora para serrada">
        <p>
          Ao serrar uma tora, parte do volume vira costaneira, serragem e aparas. A Resolução CONAMA nº 411/2009 adota
          como referência um coeficiente de rendimento volumétrico (CRV) de {Math.round(CRV_SERRADA * 100)}% para madeira
          serrada: 10 m³ de tora rendem cerca de {num(10 * CRV_SERRADA, 1)} m³ de serrada. O rendimento real varia com a
          espécie, o diâmetro e o equipamento, e o órgão ambiental pode aprovar outro coeficiente com estudo técnico.
        </p>
      </Secao>

      <Chamada
        href="/cubagem-madeira"
        titulo="Não precisa fazer a conta na mão"
        texto="Grátis e sem cadastro. Copie o romaneio para o WhatsApp ou imprima."
        botao="Calcular cubagem"
      />
    </Artigo>
  )
}
