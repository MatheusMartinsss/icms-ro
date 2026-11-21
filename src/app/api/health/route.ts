import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Usado pelo deploy para saber se a versão nova já está no ar.
export function GET() {
  return NextResponse.json({ ok: true, version: process.env.APP_VERSION || 'dev' })
}
