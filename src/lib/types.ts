// Tudo fica no navegador (local storage). Não há conta nem banco.
export interface Transportadora {
  id: string
  cnpj: string
  razaoSocial: string
  nomeFantasia: string | null
  inscricaoEstadual: string | null
  email: string | null
  telefone: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  municipio: string | null
  codigoMunicipio: string | null
  uf: string | null
  aliquotaIcms: number
  percentualReducao: number
  codigoReceita: string
  produtoDare: string
  ativa: boolean
  criadaEm: string
}

export type DareStatus = 'EMITIDO' | 'ERRO'

// Qual ferramenta gerou a guia. Registros antigos não têm o campo e contam como ICMS frete RO.
export type FerramentaId = 'icms-frete-ro' | 'fethab-mt'

// Só a lista. O PDF não fica guardado.
// No FETHAB: transportadora = remetente, valorBase = quantidade,
// baseCalculoTexto = quantidade com unidade, valorIcms = valor da guia.
export interface DareRegistro {
  id: string
  createdAt: string
  ferramenta?: FerramentaId
  status: DareStatus
  transportadoraId: string
  transportadora: { cnpj: string; razaoSocial: string; nomeFantasia: string | null }
  notaFiscal: string
  destinatario: string | null
  origem: string | null
  destino: string | null
  produto: string | null
  baseCalculoTexto: string | null
  valorBase: number | null
  valorIcms: number
  codigoReceita: string
  dataVencimento: string | null
  mesReferencia: string | null
  linhaDigitavel: string | null
  erro: string | null
}

// Dados que o formulário do DARE envia para /api/dare.
export interface DareForm {
  notaFiscal: string
  destinatario: string
  origem: string
  destino: string
  produto: string
  baseCalculoTexto: string
  valorBase: number | null
  valorIcms: number
  codigoReceita: string
  dataVencimento: string
  mesReferencia: string
}

// Dados da empresa que vão junto com cada pedido de DARE.
export interface ContribuinteEnvio {
  cnpj: string
  razaoSocial: string
  cep: string | null
  logradouro: string | null
  numero: string | null
  bairro: string | null
  municipio: string | null
  uf: string | null
  telefone: string | null
}
