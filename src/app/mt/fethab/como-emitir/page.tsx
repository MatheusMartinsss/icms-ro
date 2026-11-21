import Link from 'next/link'
import { Artigo, Chamada, Secao } from '@/components/conteudo'
import { PRODUTOS, UPF_FETHAB } from '@/lib/fethab'
import { metadataPagina } from '@/lib/site'

const CAMINHO = '/mt/fethab/como-emitir'

export const metadata = metadataPagina({
  titulo: 'Como emitir o DAR do FETHAB, passo a passo',
  descricao: 'Passo a passo para emitir o DAR do FETHAB de Mato Grosso: importar o XML da NF-e, conferir produto, quantidade e período, informar a IE do remetente e baixar o PDF da SEFAZ-MT com código de barras e PIX.',
  caminho: CAMINHO,
})

const madeira = PRODUTOS.find(p => p.id === 'madeira')!
const soja = PRODUTOS.find(p => p.id === 'soja')!
const gado = PRODUTOS.find(p => p.id === 'gado-macho')!
const milho = PRODUTOS.find(p => p.id === 'milho')!

const PASSOS: { titulo: string; texto: React.ReactNode }[] = [
  {
    titulo: 'Carregue o XML da NF-e',
    texto: (
      <>
        Abra o <Link href="/mt/fethab" className="text-sky-700 hover:underline">FETHAB MT</Link> e carregue o XML de uma ou
        várias notas. O arquivo é lido no seu navegador e não é enviado para o servidor. O GeraGuia identifica o produto
        pelos itens da nota, soma as quantidades e converte para a unidade do FETHAB (tonelada, cabeça ou m³). O período de
        referência vem da data de emissão.
      </>
    ),
  },
  {
    titulo: 'Confira produto, quantidade e período',
    texto: (
      <>
        Sem XML, escolha o produto e digite a quantidade e o mês da operação. O GeraGuia consulta na SEFAZ-MT o valor
        por unidade daquele período e mostra quanto vai pagar de FETHAB e de contribuição à entidade, se o produto tiver.
      </>
    ),
  },
  {
    titulo: 'Informe o remetente',
    texto: (
      <>
        Use a <strong>inscrição estadual</strong> de Mato Grosso sempre que tiver. Com IE, a SEFAZ-MT preenche nome e
        município pelo cadastro, e você não precisa informar mais nada. Sem IE, informe o CNPJ ou CPF e o município do
        remetente. Quando a nota é importada, o documento do remetente já vem preenchido.
      </>
    ),
  },
  {
    titulo: 'Escolha o vencimento e gere',
    texto: (
      <>
        Escolha a data de vencimento, entre hoje e um ano à frente. O campo de informações já traz o número, a série e a
        chave da NF-e. Ao gerar, o GeraGuia confere se o valor calculado pela SEFAZ-MT é o mesmo mostrado na tela e só
        então emite. Cada código de receita sai em uma guia separada.
      </>
    ),
  },
  {
    titulo: 'Baixe o PDF e pague',
    texto: (
      <>
        O PDF baixado é o DAR oficial da SEFAZ-MT, com as duas vias, o código de barras e o QR Code do PIX. A linha
        digitável fica salva no histórico do navegador para você copiar depois. A guia só tem efeito quando é paga.
      </>
    ),
  },
]

const PERGUNTAS: { pergunta: string; resposta: string }[] = [
  {
    pergunta: 'Qual o código de receita do FETHAB madeira?',
    resposta: `${madeira.codigoFethab} para o FETHAB e ${madeira.codigoEntidade} para a contribuição à entidade. São duas guias.`,
  },
  {
    pergunta: 'Quais os códigos do FETHAB da soja, do milho e do gado?',
    resposta: `Soja: ${soja.codigoFethab} (entidade ${soja.codigoEntidade}). Milho: ${milho.codigoFethab}, sem contribuição à entidade. Gado macho: ${gado.codigoFethab} (entidade ${gado.codigoEntidade}); gado fêmea: 7262 (entidade 8134). A lista completa está na tabela do FETHAB.`,
  },
  {
    pergunta: 'Qual UPF o FETHAB usa em 2026?',
    resposta: `O emissor da SEFAZ-MT calcula com a UPF de R$ ${UPF_FETHAB.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. O GeraGuia consulta o valor na SEFAZ na hora do cálculo, então acompanha qualquer mudança.`,
  },
  {
    pergunta: 'Com inscrição estadual preciso informar o município?',
    resposta: 'Não. Com IE, a SEFAZ-MT usa o município do cadastro da inscrição. O município só é pedido quando o remetente é informado por CNPJ ou CPF.',
  },
  {
    pergunta: 'Dá para pagar o DAR do FETHAB por PIX?',
    resposta: 'Sim. O PDF da SEFAZ-MT traz o QR Code do PIX junto com o código de barras.',
  },
  {
    pergunta: 'Preciso de cadastro ou senha da SEFAZ?',
    resposta: 'Não. O GeraGuia é gratuito e não pede cadastro. As empresas e o histórico de guias ficam salvos só no seu navegador.',
  },
]

const FAQ_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: PERGUNTAS.map(p => ({ '@type': 'Question', name: p.pergunta, acceptedAnswer: { '@type': 'Answer', text: p.resposta } })),
}

export default function Page() {
  return (
    <Artigo
      caminho={CAMINHO}
      trilha={[{ href: '/mt/fethab', label: 'FETHAB MT' }]}
      titulo="Como emitir o DAR do FETHAB, passo a passo"
      atualizado="21/11/2026"
      intro={
        <p>
          O DAR do FETHAB é emitido no sistema da SEFAZ-MT. Com o GeraGuia você faz isso a partir do XML da NF-e, sem
          procurar código de receita nem fazer a conta: o valor vem da própria SEFAZ e o PDF sai pronto para pagar.
        </p>
      }
    >
      <Secao titulo="Passo a passo">
        <ol className="space-y-5">
          {PASSOS.map((p, i) => (
            <li key={p.titulo} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-700 text-sm font-semibold text-white">{i + 1}</span>
              <div>
                <h3 className="font-semibold text-slate-900">{p.titulo}</h3>
                <p className="mt-1">{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </Secao>

      <Chamada
        href="/mt/fethab"
        titulo="Pronto para emitir?"
        texto="Grátis e sem cadastro. Leva cerca de um minuto com o XML da nota."
        botao="Emitir DAR do FETHAB"
      />

      <Secao titulo="Perguntas frequentes">
        <div className="divide-y rounded-xl border bg-white">
          {PERGUNTAS.map(p => (
            <details key={p.pergunta} className="group p-4">
              <summary className="cursor-pointer list-none font-medium text-slate-900 flex justify-between gap-4">
                {p.pergunta}
                <span className="text-slate-400 group-open:rotate-45 transition" aria-hidden>+</span>
              </summary>
              <p className="mt-2 text-sm">{p.resposta}</p>
            </details>
          ))}
        </div>
        <p className="text-sm">
          Valores e códigos de todos os produtos: <Link href="/mt/fethab/tabela" className="text-sky-700 hover:underline">tabela do FETHAB 2026</Link>.
        </p>
      </Secao>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
    </Artigo>
  )
}
