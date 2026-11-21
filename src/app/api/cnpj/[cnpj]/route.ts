import { NextResponse } from 'next/server'
import { DadosEmpresa, isValidCnpj, onlyDigits } from '@/lib/cnpj'
import { CnpjNaoEncontrado, consultarCnpj } from '@/lib/cnpj-lookup'
import { jsonError } from '@/lib/api'
import { limitar } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Guarda as consultas por um dia: o mesmo CNPJ não gasta crédito do CNPJá
// de novo, mesmo vindo de outra pessoa.
const CACHE_MS = 24 * 60 * 60_000
const cache = new Map<string, { dados: DadosEmpresa; expira: number }>()

export async function GET(request: Request, { params }: { params: { cnpj: string } }) {
  const cnpj = onlyDigits(params.cnpj)
  if (!isValidCnpj(cnpj)) return jsonError('CNPJ inválido', 400)

  const guardado = cache.get(cnpj)
  if (guardado && guardado.expira > Date.now()) return NextResponse.json(guardado.dados)

  const bloqueio = limitar(request, 'cnpj', 20, 10 * 60_000)
  if (bloqueio) return bloqueio

  try {
    const dados = await consultarCnpj(cnpj)
    if (cache.size > 2000) cache.clear()
    cache.set(cnpj, { dados, expira: Date.now() + CACHE_MS })
    return NextResponse.json(dados)
  } catch (error) {
    if (error instanceof CnpjNaoEncontrado) return jsonError(error.message, 404)
    console.error('[cnpj]', error)
    return jsonError((error as Error).message || 'Falha na consulta do CNPJ', 502)
  }
}
