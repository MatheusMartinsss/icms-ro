import 'server-only'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export const jsonError = (error: string, status: number, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status })

export function handleError(error: unknown) {
  if (error instanceof ZodError) {
    const first = error.issues[0]
    return jsonError(first ? `${first.path.join('.') || 'dados'}: ${first.message}` : 'Dados inválidos', 400)
  }
  console.error(error)
  return jsonError('Erro interno', 500)
}
