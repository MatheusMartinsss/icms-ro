import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

const MICROSERVICE_URL = process.env.NFE_MICROSERVICE_URL!

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const cte = await prisma.cte.findUnique({ where: { id, empresaId: session.user.empresaId } })
    if (!cte)
        return NextResponse.json({ error: 'CT-e não encontrado' }, { status: 404 })

    // Tenta extrair chave do erroMsg (padrão 539: [chCTe:44dígitos])
    const match = cte.erroMsg?.match(/\[chCTe:(\d{44})\]/)
    const chave = match?.[1] ?? cte.chave

    if (!chave)
        return NextResponse.json({ error: 'Chave do CT-e não encontrada no registro de erro' }, { status: 422 })

    const empresa = await prisma.empresa.findUnique({ where: { id: session.user.empresaId } })
    if (!empresa?.nfeMicroserviceApiKey)
        return NextResponse.json({ error: 'API Key do microservice não configurada' }, { status: 500 })

    let res: Response
    try {
        res = await fetch(`${MICROSERVICE_URL}/api/v1/cte/${chave}/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-API-Key': empresa.nfeMicroserviceApiKey,
            },
        })
    } catch (err: any) {
        return NextResponse.json({ error: 'Falha ao conectar ao servidor fiscal', details: err?.message }, { status: 503 })
    }

    const text = await res.text()
    const data = (() => { try { return JSON.parse(text) } catch { return { raw: text } } })()

    if (!res.ok)
        return NextResponse.json({ error: 'Falha na sincronização', details: data }, { status: res.status })

    const statusMap: Record<string, string> = {
        authorized: 'autorizado',
        cancelled:  'cancelado',
        rejected:   'rejeitado',
    }

    await prisma.cte.update({
        where: { id },
        data: {
            status:  statusMap[data.status] ?? 'autorizado',
            chave:   data.chave ?? chave,
            erroMsg: null,
        },
    })

    return NextResponse.json({ chave: data.chave ?? chave, cstat: data.cstat, xmotivo: data.xmotivo })
}
