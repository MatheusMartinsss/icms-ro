import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

const MICROSERVICE_URL = process.env.NFE_MICROSERVICE_URL!

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { justificativa } = await req.json()

    if (!justificativa || justificativa.trim().length < 15)
        return NextResponse.json({ error: 'Justificativa deve ter ao menos 15 caracteres' }, { status: 422 })

    const mdfe = await prisma.mdfe.findFirst({ where: { id, empresaId: session.user.empresaId } })
    if (!mdfe) return NextResponse.json({ error: 'MDF-e não encontrado' }, { status: 404 })
    if (!mdfe.chave) return NextResponse.json({ error: 'MDF-e ainda não possui chave de acesso' }, { status: 422 })

    const empresa = await prisma.empresa.findUnique({ where: { id: session.user.empresaId } })
    if (!empresa?.nfeMicroserviceApiKey)
        return NextResponse.json({ error: 'API Key do microservice não configurada' }, { status: 500 })

    let res: Response
    try {
        res = await fetch(`${MICROSERVICE_URL}/api/v1/mdfe/${mdfe.chave}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-API-Key': empresa.nfeMicroserviceApiKey,
            },
            body: JSON.stringify({ xjust: justificativa }),
        })
    } catch (err: any) {
        return NextResponse.json({ error: 'Falha ao conectar ao servidor fiscal', details: err?.message }, { status: 503 })
    }

    const text = await res.text()
    const data = (() => { try { return JSON.parse(text) } catch { return { raw: text } } })()

    if (!res.ok)
        return NextResponse.json({ error: 'Falha no cancelamento', details: data }, { status: res.status })

    await prisma.mdfe.update({
        where: { id },
        data: { status: 'cancelado' },
    })

    return NextResponse.json({ cstat: data.cstat, xmotivo: data.xmotivo, status: 'cancelado' })
}
