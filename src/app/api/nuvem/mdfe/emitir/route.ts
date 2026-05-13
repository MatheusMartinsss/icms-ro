import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

const MICROSERVICE_URL = process.env.NFE_MICROSERVICE_URL!

const STATUS_MAP: Record<string, string> = {
    authorized: 'autorizado',
    cancelled:  'cancelado',
    closed:     'encerrado',
    rejected:   'rejeitado',
    error:      'erro',
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { infMDFe } = body

    if (!infMDFe?.ide)
        return NextResponse.json({ error: 'Body inválido: infMDFe.ide é obrigatório' }, { status: 400 })

    const empresa = await prisma.empresa.findUnique({ where: { id: session.user.empresaId } })
    if (!empresa)
        return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
    if (!empresa.nfeMicroserviceApiKey)
        return NextResponse.json({ error: 'API Key do microservice não configurada para esta empresa' }, { status: 500 })
    if (!empresa.cnpj)
        return NextResponse.json({ error: 'CNPJ da empresa não configurado' }, { status: 500 })

    const cnpj = empresa.cnpj.replace(/\D/g, '')
    const payload = { cnpj, infMDFe }

    console.log('MDFE_MICROSERVICE_PAYLOAD =>', JSON.stringify(payload, null, 2))

    let res: Response
    try {
        res = await fetch(`${MICROSERVICE_URL}/api/v1/mdfe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
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

    const text = await res.text()
    let data: any
    try {
        data = JSON.parse(text)
    } catch {
        console.error('MDFE_MICROSERVICE_RESPONSE (non-JSON) =>', text.slice(0, 500))
        return NextResponse.json(
            { error: 'Resposta inválida do servidor fiscal', details: text.slice(0, 200) },
            { status: 502 }
        )
    }

    if (!res.ok) {
        console.error('MDFE_MICROSERVICE_ERROR =>', res.status, JSON.stringify(data))
        return NextResponse.json(
            { error: 'Falha ao emitir MDF-e', details: data },
            { status: res.status }
        )
    }

    return NextResponse.json({
        id:      data.id,
        status:  STATUS_MAP[data.status] ?? data.status,
        chave:   data.chave,
        cstat:   data.cstat,
        xmotivo: data.xmotivo,
        numero:  data.numero,
        serie:   data.serie,
    })
}
