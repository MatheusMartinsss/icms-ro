import { z } from 'zod'
import { isValidCnpj, onlyDigits } from '@/lib/cnpj'

const texto = z.string().trim().max(200).optional().nullable()
  .transform(v => (v ? v : null))

export const PADRAO_DARE = {
  aliquotaIcms: 12,
  percentualReducao: 20,
  codigoReceita: '1414',
  produtoDare: 'ICMS - SERVIÇO TRANSPORTE DE CARGA',
}

// Valida o formulário antes de gravar no navegador.
export const transportadoraSchema = z.object({
  cnpj: z.string().transform(onlyDigits).refine(isValidCnpj, 'CNPJ inválido'),
  razaoSocial: z.string().trim().min(2, 'razão social é obrigatória').max(200),
  nomeFantasia: texto,
  inscricaoEstadual: texto,
  email: texto,
  telefone: texto,
  cep: z.string().optional().nullable().transform(v => (v ? onlyDigits(v) : null)),
  logradouro: texto,
  numero: texto,
  complemento: texto,
  bairro: texto,
  municipio: texto,
  codigoMunicipio: texto,
  uf: z.string().trim().toUpperCase().max(2).optional().nullable().transform(v => (v ? v : null)),
  aliquotaIcms: z.coerce.number().min(0, 'alíquota inválida').max(100, 'alíquota inválida'),
  percentualReducao: z.coerce.number().min(0, 'redução inválida').max(100, 'redução inválida'),
  codigoReceita: z.string().trim().regex(/^\d{3,6}$/, 'código de receita deve ter só números'),
  produtoDare: z.string().trim().min(2, 'informe o produto do DARE').max(200),
})

export type TransportadoraDados = z.infer<typeof transportadoraSchema>

// Contribuinte que o servidor aceita em /api/dare.
export const contribuinteSchema = z.object({
  cnpj: z.string().transform(onlyDigits).refine(isValidCnpj, 'CNPJ inválido'),
  razaoSocial: z.string().trim().min(2, 'razão social é obrigatória').max(200),
  cep: texto,
  logradouro: texto,
  numero: texto,
  bairro: texto,
  municipio: texto,
  uf: texto,
  telefone: texto,
})
