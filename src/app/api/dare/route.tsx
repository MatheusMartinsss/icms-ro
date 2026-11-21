import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleError, jsonError } from '@/lib/api'
import { GdareError, emitirNoGdare } from '@/lib/gdare'
import { limitar } from '@/lib/rate-limit'
import { contribuinteSchema, PADRAO_DARE } from '@/lib/transportadora-schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// A SEFIN às vezes demora. Em plataformas com limite de tempo (Vercel) isso
// evita cortar a resposta em 10s, que era a causa das falhas do DARE.
export const maxDuration = 120

const opcional = z.string().trim().max(500).optional().nullable().transform(v => (v ? v : null))

// O site é público: os dados da transportadora vêm do navegador em cada pedido.
const schema = z.object({
  transportadora: contribuinteSchema,
  notaFiscal: z.string().trim().min(1, 'informe a nota fiscal').max(60),
  destinatario: opcional,
  origem: opcional,
  destino: opcional,
  produto: opcional,
  baseCalculoTexto: opcional,
  valorIcms: z.coerce.number().positive('o valor do DARE precisa ser maior que zero').max(10_000_000),
  codigoReceita: z.string().trim().regex(/^\d{3,6}$/).optional().nullable().or(z.literal('')),
  dataVencimento: z.string().trim().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'vencimento no formato dd/mm/aaaa').optional().nullable().or(z.literal('')),
  mesReferencia: z.string().trim().regex(/^\d{2}\/\d{4}$/, 'referência no formato mm/aaaa').optional().nullable().or(z.literal('')),
})

const round2 = (n: number) => Math.round(n * 100) / 100

export async function POST(request: Request) {
  // Cada emissão abre o Chrome no gdare. 30 a cada 10 minutos por IP cobre
  // uma carga fracionada grande sem deixar alguém lotar o serviço.
  const bloqueio = limitar(request, 'dare', 30, 10 * 60_000)
  if (bloqueio) return bloqueio

  let input: z.infer<typeof schema>
  try {
    input = schema.parse(await request.json())
  } catch (error) {
    return handleError(error)
  }

  const t = input.transportadora
  try {
    const result = await emitirNoGdare({
      cnpj: t.cnpj,
      notaFiscal: input.notaFiscal,
      destinatario: input.destinatario,
      origem: input.origem?.toLocaleUpperCase('pt-BR'),
      destino: input.destino?.toLocaleUpperCase('pt-BR'),
      produto: input.produto || PADRAO_DARE.produtoDare,
      baseCalculo: input.baseCalculoTexto,
      valor: round2(input.valorIcms),
      codigoReceita: input.codigoReceita || PADRAO_DARE.codigoReceita,
      dataVencimento: input.dataVencimento || null,
      mesReferencia: input.mesReferencia || null,
      // Só é usado se a SEFIN não tiver o cadastro da empresa.
      contribuinte: {
        nome: t.razaoSocial,
        cep: t.cep,
        endereco: [t.logradouro, t.numero, t.bairro].filter(Boolean).join(', '),
        municipio: t.municipio,
        uf: t.uf,
        telefone: t.telefone,
      },
    })

    const headers: Record<string, string> = {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="dare-${encodeURIComponent(input.notaFiscal)}.pdf"`,
    }
    if (result.linhaDigitavel) headers['X-Linha-Digitavel'] = result.linhaDigitavel
    if (result.dataVencimento) headers['X-Data-Vencimento'] = result.dataVencimento
    if (result.mesReferencia) headers['X-Mes-Referencia'] = result.mesReferencia
    return new NextResponse(new Uint8Array(result.pdf), { headers })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[dare ${t.cnpj} NF ${input.notaFiscal}] ${message}`)
    // 400/422 do gdare são dados recusados. O resto é falha do serviço.
    const status = error instanceof GdareError && [400, 422].includes(error.status) ? 422 : 502
    return jsonError(message, status)
  }
}
