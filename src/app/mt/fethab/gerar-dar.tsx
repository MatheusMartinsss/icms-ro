'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTransportadoras } from '@/components/transportadora-context'
import { isValidCnpj, onlyDigits } from '@/lib/cnpj'
import { baixarBlob } from '@/lib/dare-client'
import { UNIDADE_LABEL, type ProdutoFethab } from '@/lib/fethab'
import { MUNICIPIOS_MT, municipioMtValido } from '@/lib/municipios-mt'
import { informacoesDasNotas, remetenteDa, type NotaNfe } from '@/lib/nfe'
import { cn } from '@/lib/utils'

const PORTAL_SEFAZ = 'https://www.sefaz.mt.gov.br/arrecadacao/darlivre/menudarnovo?tipoTributo=57&tipoContribuinte=0&pagn=contribuinte'

type TipoDocumento = 'ie' | 'cnpj' | 'cpf'

const TIPOS: { id: TipoDocumento; rotulo: string; tamanho: [number, number] }[] = [
  { id: 'ie', rotulo: 'IE', tamanho: [8, 12] },
  { id: 'cnpj', rotulo: 'CNPJ', tamanho: [14, 14] },
  { id: 'cpf', rotulo: 'CPF', tamanho: [11, 11] },
]

export interface GuiaCalculada {
  descricao: string
  codigo: string
  total: number | null
}

interface GuiaGerada {
  codigo: string
  descricao: string
  valor: number
  linhaDigitavel: string | null
}

interface Props {
  produto: ProdutoFethab
  periodo: string
  periodoOk: boolean
  quantidade: number | null
  guias: GuiaCalculada[]
  notas: NotaNfe[]
  consultando: boolean
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pad = (n: number) => String(n).padStart(2, '0')
const isoLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const paraBr = (iso: string) => iso.split('-').reverse().join('/')

// Sem acento e só ASCII visível, como o emissor da SEFAZ aceita.
const paraAscii = (s: string) =>
  s.replace(/º/g, 'o').replace(/ª/g, 'a').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^ -~]/g, '')

function documentoValido(tipo: TipoDocumento, numero: string) {
  const [min, max] = TIPOS.find(t => t.id === tipo)!.tamanho
  if (numero.length < min || numero.length > max) return false
  return tipo !== 'cnpj' || isValidCnpj(numero)
}

export default function GerarDar({ produto, periodo, periodoOk, quantidade, guias, notas, consultando }: Props) {
  const { ativa, carregando, registrarGuia } = useTransportadoras()
  const [tipo, setTipo] = useState<TipoDocumento>('ie')
  const [numero, setNumero] = useState('')
  const [nome, setNome] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [vencimento, setVencimento] = useState(() => isoLocal(new Date()))
  const [informacoes, setInformacoes] = useState('')
  const [gerando, setGerando] = useState<string | null>(null)
  const [geradas, setGeradas] = useState<GuiaGerada[]>([])

  const hoje = isoLocal(new Date())
  const umAno = (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return isoLocal(d) })()

  // O XML manda: remetente, município e números das notas.
  useEffect(() => {
    if (!notas.length) return
    const r = remetenteDa(notas[0])
    if (r.uf === 'MT' && r.ie) { setTipo('ie'); setNumero(r.ie) }
    else if (r.tipoDocumento && r.documento) { setTipo(r.tipoDocumento); setNumero(r.documento) }
    setNome(r.nome)
    if (r.uf === 'MT' && r.municipio) setMunicipio(r.municipio)
    setInformacoes(paraAscii(informacoesDasNotas(notas)).slice(0, 220))
  }, [notas])

  // Sem XML, começa pela empresa ativa (só se o campo ainda estiver vazio).
  useEffect(() => {
    if (carregando || !ativa || notas.length || numero) return
    const ie = onlyDigits(ativa.inscricaoEstadual)
    const deMt = ativa.uf === 'MT'
    setTipo(deMt && ie ? 'ie' : 'cnpj')
    setNumero(deMt && ie ? ie : onlyDigits(ativa.cnpj))
    setNome(ativa.nomeFantasia || ativa.razaoSocial)
    if (deMt && ativa.municipio && !municipio) setMunicipio(ativa.municipio)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, ativa?.id])

  const docOk = documentoValido(tipo, numero)
  const municipioOk = municipioMtValido(municipio)
  const vencimentoOk = !!vencimento && vencimento >= hoje && vencimento <= umAno
  const quantidadeOk = quantidade !== null && quantidade > 0

  const pendencias = [
    !docOk && 'documento do remetente',
    !municipioOk && 'município',
    !periodoOk && 'período',
    !quantidadeOk && 'quantidade',
    !vencimentoOk && 'vencimento',
  ].filter(Boolean) as string[]

  const unidade = UNIDADE_LABEL[produto.unidade]
  const quantidadeTexto = quantidade === null
    ? ''
    : `${quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ${unidade.curta}`

  const empresaDoDocumento = () =>
    ativa && (onlyDigits(ativa.cnpj) === numero || onlyDigits(ativa.inscricaoEstadual) === numero) ? ativa : null

  const gerar = async (guia: GuiaCalculada) => {
    if (pendencias.length || guia.total === null || quantidade === null) return
    setGerando(guia.codigo)
    const empresa = empresaDoDocumento()
    const base = {
      ferramenta: 'fethab-mt' as const,
      transportadoraId: empresa?.id ?? '',
      transportadora: {
        cnpj: numero,
        razaoSocial: empresa?.razaoSocial || nome || `${tipo.toUpperCase()} ${numero}`,
        nomeFantasia: empresa?.nomeFantasia ?? null,
      },
      notaFiscal: notas.map(n => n.numero).join(', ').slice(0, 80),
      destinatario: null,
      origem: municipio,
      destino: null,
      produto: `${produto.nome} · ${guia.descricao}`,
      baseCalculoTexto: quantidadeTexto,
      valorBase: quantidade,
      codigoReceita: guia.codigo,
      dataVencimento: paraBr(vencimento),
      mesReferencia: periodo,
    }
    try {
      const res = await fetch('/api/fethab/dar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documento: { tipo, numero },
          codigoReceita: guia.codigo,
          periodoReferencia: periodo,
          dataVencimento: paraBr(vencimento),
          quantidade,
          municipio,
          informacoes: paraAscii(informacoes).slice(0, 220) || null,
          valorEsperado: guia.total,
        }),
      })
      if (!res.ok) {
        const corpo = await res.json().catch(() => ({}))
        throw new Error(corpo.error || `Falha ao gerar o DAR (${res.status})`)
      }
      baixarBlob(await res.blob(), `dar-${guia.codigo}-${periodo.replace('/', '-')}.pdf`)
      const linhaDigitavel = res.headers.get('X-Linha-Digitavel')
      const valor = Number(res.headers.get('X-Valor')) || guia.total
      registrarGuia({ ...base, status: 'EMITIDO', valorIcms: valor, linhaDigitavel, erro: null })
      setGeradas(atual => [{ codigo: guia.codigo, descricao: guia.descricao, valor, linhaDigitavel }, ...atual])
      toast.success(`DAR ${guia.codigo} gerado. O PDF foi baixado.`)
    } catch (error) {
      const mensagem = error instanceof TypeError ? 'Sem conexão com o servidor' : (error as Error).message
      registrarGuia({ ...base, status: 'ERRO', valorIcms: guia.total, linhaDigitavel: null, erro: mensagem })
      toast.error(mensagem, { duration: 10_000 })
    } finally {
      setGerando(null)
    }
  }

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto.replace(/\D/g, ''))
      toast.success('Linha digitável copiada')
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  const tipoAtual = TIPOS.find(t => t.id === tipo)!

  return (
    <div className="bg-white border rounded-2xl p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-medium mb-1">Gerar o DAR</h2>
      <p className="text-sm text-slate-500 mb-4">
        A guia é emitida no sistema da SEFAZ-MT com os dados abaixo. Cada código é uma guia separada.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="documento">Remetente</Label>
          <div className="flex gap-2">
            <div className="flex rounded-md border p-0.5 shrink-0" role="group" aria-label="Tipo de documento">
              {TIPOS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTipo(t.id)}
                  className={cn('px-2.5 text-sm rounded', tipo === t.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}
                >
                  {t.rotulo}
                </button>
              ))}
            </div>
            <Input
              id="documento"
              inputMode="numeric"
              placeholder={tipo === 'ie' ? 'Inscrição estadual' : 'Só números'}
              value={numero}
              onChange={e => { setNumero(onlyDigits(e.target.value).slice(0, 14)); setNome('') }}
            />
          </div>
          {nome && docOk && <p className="text-xs text-slate-500 truncate">{nome}</p>}
          {numero && !docOk && <p className="text-xs text-red-600">{tipoAtual.rotulo} inválido.</p>}
          {tipo !== 'ie' && <p className="text-xs text-slate-500">Quem tem inscrição em MT deve usar a IE.</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="municipio">Município do remetente</Label>
          <Input
            id="municipio"
            list="municipios-mt"
            autoComplete="off"
            placeholder="Ex: Sorriso"
            value={municipio}
            onChange={e => setMunicipio(e.target.value)}
          />
          <datalist id="municipios-mt">
            {MUNICIPIOS_MT.map(m => <option key={m} value={m} />)}
          </datalist>
          {municipio && !municipioOk && <p className="text-xs text-red-600">Município fora da lista da SEFAZ-MT.</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vencimento">Vencimento</Label>
          <Input id="vencimento" type="date" min={hoje} max={umAno} value={vencimento} onChange={e => setVencimento(e.target.value)} />
          {!vencimentoOk && <p className="text-xs text-red-600">Entre hoje e um ano à frente.</p>}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="informacoes">Informações na guia</Label>
            <span className="text-xs text-slate-400">{informacoes.length}/220</span>
          </div>
          <textarea
            id="informacoes"
            rows={2}
            maxLength={220}
            placeholder="Números das NF-e, placa etc."
            value={informacoes}
            onChange={e => setInformacoes(e.target.value)}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {guias.map((g, i) => {
          const semValor = g.total === null || g.total <= 0
          return (
            <Button
              key={g.codigo}
              className="w-full justify-between h-auto py-2.5 gap-3"
              variant={i === 0 ? 'default' : 'secondary'}
              disabled={!!gerando || pendencias.length > 0 || semValor || consultando}
              onClick={() => gerar(g)}
            >
              <span className="text-left whitespace-normal">
                {gerando === g.codigo ? 'Gerando na SEFAZ-MT…' : `Gerar DAR ${g.descricao}`}
                <span className="ml-2 font-mono text-xs opacity-70">{g.codigo}</span>
              </span>
              <span className="font-semibold">{semValor ? '—' : brl(g.total!)}</span>
            </Button>
          )
        })}
        {pendencias.length > 0 && <p className="text-xs text-slate-500">Falta: {pendencias.join(', ')}.</p>}
        {gerando && <p className="text-xs text-slate-500">A SEFAZ-MT pode levar até um minuto. Não feche a página.</p>}
      </div>

      {geradas.length > 0 && (
        <ul className="mt-5 border-t pt-4 space-y-3">
          {geradas.map((g, i) => (
            <li key={i} className="text-sm">
              <div className="flex justify-between gap-3">
                <span>DAR {g.descricao} <span className="font-mono text-xs text-slate-400">{g.codigo}</span></span>
                <span className="font-medium">{brl(g.valor)}</span>
              </div>
              {g.linhaDigitavel && (
                <button
                  type="button"
                  onClick={() => copiar(g.linhaDigitavel!)}
                  className="mt-0.5 font-mono text-xs text-sky-700 hover:underline break-all text-left"
                >
                  {g.linhaDigitavel}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-slate-400">
        Antes de emitir, o valor é conferido com o da SEFAZ-MT. Se não bater, nenhuma guia é gerada.
        Se o emissor estiver fora do ar, use o{' '}
        <a className="underline" href={PORTAL_SEFAZ} target="_blank" rel="noopener noreferrer">portal da SEFAZ-MT</a>.
      </p>
    </div>
  )
}
