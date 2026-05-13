import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

const MICROSERVICE_URL = process.env.NFE_MICROSERVICE_URL!

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const mdfe = await prisma.mdfe.findFirst({ where: { idNuvem: id, empresaId: session.user.empresaId } })
    if (!mdfe) return NextResponse.json({ error: 'MDF-e não encontrado' }, { status: 404 })
    if (!mdfe.chave) return NextResponse.json({ error: 'MDF-e ainda não possui chave de acesso' }, { status: 422 })

    const empresa = await prisma.empresa.findUnique({ where: { id: session.user.empresaId } })
    if (!empresa?.nfeMicroserviceApiKey)
        return NextResponse.json({ error: 'API Key do microservice não configurada' }, { status: 500 })

    let res: Response
    try {
        res = await fetch(`${MICROSERVICE_URL}/api/v1/mdfe/${mdfe.chave}/damdfe`, {
            headers: {
                'Accept': 'application/pdf',
                'X-API-Key': empresa.nfeMicroserviceApiKey,
            },
        })
    } catch (err: any) {
        return NextResponse.json({ error: 'Falha ao conectar ao servidor fiscal', details: err?.message }, { status: 503 })
    }

    if (!res.ok) {
        const text = await res.text()
        return NextResponse.json({ error: 'Falha ao gerar DAMDFE', details: text.slice(0, 200) }, { status: res.status })
    }

    const pdf = await res.arrayBuffer()

    return new Response(pdf, {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${mdfe.chave}-damdfe.pdf"`,
        },
    })
}
