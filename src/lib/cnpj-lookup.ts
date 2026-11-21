import 'server-only'
import { DadosEmpresa, onlyDigits } from '@/lib/cnpj'

export class CnpjNaoEncontrado extends Error {
  constructor(cnpj: string) {
    super(`CNPJ ${cnpj} não encontrado na Receita`)
  }
}

// Mesma estratégia do gflona: CNPJá (traz a inscrição estadual) e, se ele
// falhar ou não estiver configurado, BrasilAPI.
export async function consultarCnpj(cnpj: string): Promise<DadosEmpresa> {
  const digits = onlyDigits(cnpj)
  const apiKey = process.env.CNPJA_API_KEY
  const baseUrl = process.env.CNPJA_BASE_URL

  if (apiKey && baseUrl) {
    try {
      const res = await fetch(`${baseUrl}/office/${digits}?registrations=ORIGIN`, {
        headers: { Authorization: apiKey },
        signal: AbortSignal.timeout(15000),
        cache: 'no-store',
      })
      if (res.ok) return mapCnpja(digits, await res.json())
      console.warn(`[cnpj] CNPJá respondeu ${res.status} para ${digits}, usando BrasilAPI`)
    } catch (error) {
      console.warn(`[cnpj] CNPJá falhou para ${digits}, usando BrasilAPI: ${(error as Error).message}`)
    }
  }

  // A BrasilAPI recusa (403) o User-Agent padrão do Node.
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
    headers: { 'User-Agent': 'calculadora-icms/1.0' },
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  })
  if (res.status === 404) throw new CnpjNaoEncontrado(digits)
  if (!res.ok) throw new Error(`Consulta de CNPJ indisponível (BrasilAPI ${res.status})`)
  return mapBrasilApi(digits, await res.json())
}

function mapCnpja(cnpj: string, data: any): DadosEmpresa {
  const phone = data.phones?.[0]
  const registrations: any[] = data.registrations ?? []
  const registration = registrations.find(r => r.enabled !== false) ?? registrations[0]
  return {
    cnpj,
    razaoSocial: data.company?.name ?? '',
    nomeFantasia: data.alias ?? '',
    inscricaoEstadual: registration?.number ?? '',
    email: data.emails?.[0]?.address ?? '',
    telefone: phone ? `(${phone.area}) ${phone.number}` : '',
    cep: onlyDigits(data.address?.zip),
    logradouro: data.address?.street ?? '',
    numero: data.address?.number ?? '',
    complemento: data.address?.details ?? '',
    bairro: data.address?.district ?? '',
    municipio: data.address?.city ?? '',
    codigoMunicipio: String(data.address?.municipality ?? ''),
    uf: data.address?.state ?? '',
    fonte: 'cnpja',
  }
}

function mapBrasilApi(cnpj: string, data: any): DadosEmpresa {
  return {
    cnpj,
    razaoSocial: data.razao_social ?? '',
    nomeFantasia: data.nome_fantasia ?? '',
    inscricaoEstadual: '',
    email: data.email ?? '',
    telefone: data.ddd_telefone_1 ?? '',
    cep: onlyDigits(data.cep),
    logradouro: [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(' '),
    numero: data.numero ?? '',
    complemento: data.complemento ?? '',
    bairro: data.bairro ?? '',
    municipio: data.municipio ?? '',
    codigoMunicipio: String(data.codigo_municipio_ibge ?? data.codigo_municipio ?? ''),
    uf: data.uf ?? '',
    fonte: 'brasilapi',
  }
}
