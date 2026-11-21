import 'server-only'

export class GdareError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

export interface ContribuinteDare {
  nome?: string | null
  cep?: string | null
  endereco?: string | null
  municipio?: string | null
  uf?: string | null
  telefone?: string | null
}

export interface DarePayload {
  cnpj: string
  notaFiscal: string
  destinatario?: string | null
  origem?: string | null
  destino?: string | null
  produto?: string | null
  baseCalculo?: string | null
  valor: number
  codigoReceita: string
  dataVencimento?: string | null
  mesReferencia?: string | null
  contribuinte?: ContribuinteDare
}

const baseUrl = () => (process.env.GDARE_URL || process.env.NEXT_PUBLIC_DARE_API_URL || '').replace(/\/$/, '')

const authHeaders = (): Record<string, string> => {
  const key = process.env.GDARE_API_KEY
  return key ? { 'x-api-key': key } : {}
}

// O gdare antigo ignora o CNPJ e emite sempre para a transportadora que estava
// fixa no código. Antes da primeira emissão confere se o serviço já é a versão
// nova (que tem /health). Se não for, recusa em vez de gerar guia errada.
let versaoConferida = false
async function garantirVersaoNova() {
  if (versaoConferida) return
  let res: Response
  try {
    res = await fetch(`${baseUrl()}/health`, { headers: authHeaders(), cache: 'no-store', signal: AbortSignal.timeout(10000) })
  } catch (error) {
    throw new GdareError(`Serviço de DARE fora do ar: ${(error as Error).message}`, 502)
  }
  if (!res.ok) {
    throw new GdareError(
      'O serviço de DARE (gdare) está desatualizado e emitiria a guia com o CNPJ errado. Atualize o gdare antes de emitir.',
      502,
    )
  }
  versaoConferida = true
}

async function postarNoGdare(caminho: string, payload: unknown, timeoutMs: number) {
  if (!baseUrl()) throw new GdareError('GDARE_URL não configurada', 500)
  await garantirVersaoNova()

  let res: Response
  try {
    res = await fetch(`${baseUrl()}${caminho}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    throw new GdareError(`Sem resposta do serviço de guias: ${(error as Error).message}`, 504)
  }

  if (!res.ok) {
    let message = `Serviço de guias respondeu ${res.status}`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      // corpo não era JSON
    }
    throw new GdareError(message, res.status)
  }
  return res
}

export async function emitirNoGdare(payload: DarePayload) {
  const res = await postarNoGdare('/dare', payload, 150_000)
  return {
    pdf: Buffer.from(await res.arrayBuffer()),
    linhaDigitavel: res.headers.get('x-linha-digitavel'),
    dataVencimento: res.headers.get('x-data-vencimento'),
    mesReferencia: res.headers.get('x-mes-referencia'),
  }
}

export interface DarMtPayload {
  documento: { tipo: 'ie' | 'cnpj' | 'cpf'; numero: string }
  codigoReceita: string
  periodoReferencia: string // mm/aaaa
  dataVencimento?: string | null // dd/mm/aaaa
  quantidade: number
  municipio: string
  informacoes?: string | null
  // O gdare aborta antes de emitir se a SEFAZ-MT calcular outro valor.
  valorEsperado: number
}

// DAR avulso da SEFAZ-MT (FETHAB). O emissor de MT é lento, por isso o prazo maior.
export async function emitirDarMtNoGdare(payload: DarMtPayload) {
  const res = await postarNoGdare('/dar-mt', payload, 240_000)
  const valor = Number(res.headers.get('x-valor'))
  return {
    pdf: Buffer.from(await res.arrayBuffer()),
    linhaDigitavel: res.headers.get('x-linha-digitavel'),
    dataVencimento: res.headers.get('x-data-vencimento'),
    periodoReferencia: res.headers.get('x-periodo-referencia'),
    valor: Number.isFinite(valor) && valor > 0 ? valor : null,
  }
}
