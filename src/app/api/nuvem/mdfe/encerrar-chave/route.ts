import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

const MICROSERVICE_URL = process.env.NFE_MICROSERVICE_URL!

export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { chave, cuf, dhEnc, cMun } = await req.json()

    if (!chave || String(chave).replace(/\D/g, '').length !== 44)
        return NextResponse.json({ error: 'Chave de acesso inválida (44 dígitos)' }, { status: 422 })
    if (!cuf || !dhEnc || !cMun)
        return NextResponse.json({ error: 'cuf, dhEnc e cMun são obrigatórios' }, { status: 422 })

    const empresa = await prisma.empresa.findUnique({ where: { id: session.user.empresaId } })
    if (!empresa?.nfeMicroserviceApiKey)
        return NextResponse.json({ error: 'API Key do microservice não configurada' }, { status: 500 })

    const chaveClean = String(chave).replace(/\D/g, '')
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Key': empresa.nfeMicroserviceApiKey,
    }

    // Se o MDF-e não existe na base do microservice, sincroniza do SEFAZ antes de encerrar
    try {
        const check = await fetch(`${MICROSERVICE_URL}/api/v1/mdfe/${chaveClean}`, { headers })
        if (check.status === 404) {
            await fetch(`${MICROSERVICE_URL}/api/v1/mdfe/${chaveClean}/sync`, { method: 'POST', headers })
        }
    } catch {
        // best-effort; prossegue mesmo se falhar
    }

    let res: Response
    try {
        res = await fetch(`${MICROSERVICE_URL}/api/v1/mdfe/${chaveClean}/encerrar`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ cUF: Number(cuf), dhEnc, cMun: String(cMun) }),
        })
    } catch (err: any) {
        return NextResponse.json({ error: 'Falha ao conectar ao servidor fiscal', details: err?.message }, { status: 503 })
    }

    const text = await res.text()
    const data = (() => { try { return JSON.parse(text) } catch { return { raw: text } } })()

    if (!res.ok)
        return NextResponse.json({ error: 'Falha no encerramento', details: data }, { status: res.status })

    // Atualiza status no Prisma se o MDF-e existir na base
    await prisma.mdfe.updateMany({
        where: { chave: chaveClean, empresaId: session.user.empresaId },
        data: { status: 'encerrado' },
    })

    return NextResponse.json({ cstat: data.cstat, xmotivo: data.xmotivo, status: 'encerrado' })
}
