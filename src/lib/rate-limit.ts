import 'server-only'
import { NextResponse } from 'next/server'

// Limite simples em memória, por IP. O site é público, e sem isso qualquer um
// poderia gastar os créditos do CNPJá e do Google ou lotar o gdare.
// Vale por processo: no VPS há um processo só, então o limite é exato.

const janelas = new Map<string, number[]>()

function ipDe(request: Request) {
  const real = request.headers.get('x-real-ip')
  if (real) return real.trim()
  // O nginx acrescenta o IP real no fim. Os primeiros podem ser forjados.
  const encaminhado = request.headers.get('x-forwarded-for')
  if (encaminhado) return encaminhado.split(',').pop()!.trim()
  return 'local'
}

export function limitar(request: Request, nome: string, maximo: number, janelaMs: number) {
  const agora = Date.now()
  const chave = `${nome}:${ipDe(request)}`
  const recentes = (janelas.get(chave) ?? []).filter(t => agora - t < janelaMs)

  if (recentes.length >= maximo) {
    janelas.set(chave, recentes)
    const esperaS = Math.ceil((recentes[0] + janelaMs - agora) / 1000)
    return NextResponse.json(
      { error: `Muitas requisições. Tente de novo em ${Math.ceil(esperaS / 60)} minuto(s).` },
      { status: 429, headers: { 'Retry-After': String(esperaS) } },
    )
  }

  recentes.push(agora)
  janelas.set(chave, recentes)
  if (janelas.size > 10000) limpar(agora, janelaMs)
  return null
}

function limpar(agora: number, janelaMs: number) {
  janelas.forEach((tempos, chave) => {
    if (!tempos.some(t => agora - t < janelaMs)) janelas.delete(chave)
  })
}
