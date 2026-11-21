import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleError, jsonError } from '@/lib/api'
import { isValidCnpj, onlyDigits } from '@/lib/cnpj'
import { CODIGOS_FETHAB, periodoValido } from '@/lib/fethab'
import { GdareError, emitirDarMtNoGdare } from '@/lib/gdare'
import { limitar } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// O emissor da SEFAZ-MT leva de segundos a mais de um minuto.
export const maxDuration = 240

const TAMANHOS = { ie: [8, 12], cnpj: [14, 14], cpf: [11, 11] } as const

const schema = z.object({
  documento: z
    .object({
      tipo: z.enum(['ie', 'cnpj', 'cpf']),
      numero: z.string().transform(onlyDigits),
    })
    .refine(d => {
      const [min, max] = TAMANHOS[d.tipo]
      return d.numero.length >= min && d.numero.length <= max
    }, 'documento do remetente inválido')
    .refine(d => d.tipo !== 'cnpj' || isValidCnpj(d.numero), 'CNPJ do remetente inválido'),
  codigoReceita: z.string().trim().refine(c => CODIGOS_FETHAB.has(c), 'código de receita desconhecido'),
  periodoReferencia: z.string().trim().refine(periodoValido, 'período no formato mm/aaaa'),
  dataVencimento: z.string().trim().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'vencimento no formato dd/mm/aaaa').optional().nullable().or(z.literal('')),
  quantidade: z.coerce.number().positive('a quantidade precisa ser maior que zero').max(10_000_000),
  // Com IE a SEFAZ-MT usa o município do cadastro; só CNPJ e CPF precisam dele.
  municipio: z.string().trim().max(80).optional().nullable(),
  informacoes: z.string().trim().max(220).optional().nullable(),
  valorEsperado: z.coerce.number().positive().max(100_000_000),
}).refine(d => d.documento.tipo === 'ie' || (d.municipio ?? '').length >= 2, {
  message: 'informe o município do remetente',
  path: ['municipio'],
})

export async function POST(request: Request) {
  // Cada guia abre o Chrome no gdare e espera a SEFAZ-MT.
  const bloqueio = limitar(request, 'dar-mt', 20, 10 * 60_000)
  if (bloqueio) return bloqueio

  let input: z.infer<typeof schema>
  try {
    input = schema.parse(await request.json())
  } catch (error) {
    return handleError(error)
  }

  try {
    const result = await emitirDarMtNoGdare({
      documento: input.documento,
      codigoReceita: input.codigoReceita,
      periodoReferencia: input.periodoReferencia,
      dataVencimento: input.dataVencimento || null,
      quantidade: input.quantidade,
      municipio: input.documento.tipo === 'ie' ? null : input.municipio,
      informacoes: input.informacoes || null,
      valorEsperado: input.valorEsperado,
    })

    const headers: Record<string, string> = {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="dar-${input.codigoReceita}.pdf"`,
    }
    if (result.linhaDigitavel) headers['X-Linha-Digitavel'] = result.linhaDigitavel
    if (result.dataVencimento) headers['X-Data-Vencimento'] = result.dataVencimento
    if (result.valor) headers['X-Valor'] = String(result.valor)
    return new NextResponse(new Uint8Array(result.pdf), { headers })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[dar-mt ${input.codigoReceita} ${input.documento.tipo}] ${message}`)
    const status = error instanceof GdareError && [400, 422].includes(error.status) ? 422 : 502
    return jsonError(message, status)
  }
}
