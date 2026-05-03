import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { adaptToMicroservice } from '@/lib/cte/microservice-adapters'
import { NextResponse } from 'next/server'

const MICROSERVICE_URL = process.env.NFE_MICROSERVICE_URL!

export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const infCte = body?.infCte

    if (!infCte?.ide)
        return NextResponse.json({ error: 'Body inválido: infCte.ide é obrigatório' }, { status: 400 })

    const empresa = await prisma.empresa.findUnique({ where: { id: session.user.empresaId } })
    if (!empresa)
        return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })

    if (!empresa.nfeMicroserviceApiKey)
        return NextResponse.json({ error: 'API Key do microservice não configurada para esta empresa' }, { status: 500 })

    const payload = adaptToMicroservice(infCte, empresa)

    let res: Response
    try {
        res = await fetch(`${MICROSERVICE_URL}/api/v1/cte/previa-dacte`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/pdf',
                'X-API-Key': empresa.nfeMicroserviceApiKey,
            },
            body: JSON.stringify(payload),
        })
    } catch (err: any) {
        return NextResponse.json(
            { error: 'Falha ao conectar ao servidor fiscal', details: err?.message },
            { status: 503 }
        )
    }

    if (!res.ok) {
        const text = await res.text()
        return NextResponse.json(
            { error: 'Falha ao gerar pré-DACTE', details: text.slice(0, 200) },
            { status: res.status }
        )
    }

    const pdf = await res.arrayBuffer()

    return new Response(pdf, {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'inline; filename="previa-dacte.pdf"',
        },
    })
}
