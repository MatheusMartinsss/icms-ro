import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/api'
import { CODIGOS_FETHAB, periodoValido } from '@/lib/fethab'
import { limitar } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Consulta o valor por unidade direto no emissor de DAR da SEFAZ-MT, o mesmo
// endpoint que o formulário deles chama ao escolher a receita. Só leitura:
// nenhuma guia é gerada. A resposta é o valor em reais por unidade, ou "0.0"
// quando o código não vale para o período.
const URL_SEFAZ = 'https://www.sefaz.mt.gov.br/arrecadacao/darlivre/upfmtfethabdropdown'

// A UPF muda no máximo duas vezes por ano. Seis horas de cache bastam.
const CACHE_MS = 6 * 60 * 60_000
const cache = new Map<string, { valor: number | null; expira: number }>()

const consultaSchema = z.object({
  periodo: z.string().refine(periodoValido, 'Período inválido. Use MM/AAAA.'),
  codigos: z.string()
    .transform(s => Array.from(new Set(s.split(',').map(c => c.trim()).filter(Boolean))))
    .refine(cs => cs.length > 0 && cs.length <= 4, 'Informe de 1 a 4 códigos')
    .refine(cs => cs.every(c => CODIGOS_FETHAB.has(c)), 'Código de FETHAB desconhecido'),
})

async function consultarSefaz(codigo: string, periodo: string) {
  const resposta = await fetch(URL_SEFAZ, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (compatible; GeraGuia)',
    },
    body: new URLSearchParams({ codgTributo: codigo, periodoReferencia: `01/${periodo}` }),
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  })
  if (!resposta.ok) throw new Error(`SEFAZ-MT respondeu ${resposta.status}`)
  const texto = (await resposta.text()).trim()
  const valor = Number(texto)
  if (!texto || !Number.isFinite(valor)) throw new Error('Resposta inesperada da SEFAZ-MT')
  return valor > 0 ? valor : null
}

const chave = (codigo: string, periodo: string) => `${codigo}|${periodo}`

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams)
  const consulta = consultaSchema.safeParse(params)
  if (!consulta.success) return jsonError(consulta.error.issues[0]?.message ?? 'Consulta inválida', 400)
  const { periodo, codigos } = consulta.data

  const agora = Date.now()
  const faltando = codigos.filter(c => {
    const guardado = cache.get(chave(c, periodo))
    return !guardado || guardado.expira <= agora
  })

  // Cache não conta no limite: só gasta quem faz a SEFAZ trabalhar.
  if (faltando.length) {
    const bloqueio = limitar(request, 'fethab', 60, 10 * 60_000)
    if (bloqueio) return bloqueio
    try {
      const valores = await Promise.all(faltando.map(c => consultarSefaz(c, periodo)))
      if (cache.size > 2000) cache.clear()
      faltando.forEach((c, i) => cache.set(chave(c, periodo), { valor: valores[i], expira: agora + CACHE_MS }))
    } catch (error) {
      console.error('[fethab]', error)
      return jsonError('Não foi possível consultar a SEFAZ-MT agora', 502)
    }
  }

  const valores = Object.fromEntries(codigos.map(c => [c, cache.get(chave(c, periodo))?.valor ?? null]))
  return NextResponse.json({ periodo, valores })
}
