import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')
    const cnpj = searchParams.get('cnpj')?.replace(/\D/g, '')

    const parceiros = await prisma.parceiro.findMany({
        where: {
            empresaId: session.user.empresaId,
            ...(cnpj ? { cnpj } : {}),
            ...(q && !cnpj ? { xNome: { contains: q, mode: 'insensitive' } } : {}),
        },
        orderBy: { xNome: 'asc' },
        take: 50,
    })

    return NextResponse.json(parceiros)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const empresaId = session.user.empresaId

    const docKey = body.cnpj ?? body.cpf
    if (docKey) {
        const field = body.cnpj ? { cnpj: body.cnpj } : { cpf: body.cpf }
        const existing = await prisma.parceiro.findFirst({ where: { empresaId, ...field } })
        if (existing) {
            const updated = await prisma.parceiro.update({
                where: { id: existing.id },
                data: buildData(body),
            })
            return NextResponse.json(updated)
        }
    }

    const parceiro = await prisma.parceiro.create({
        data: { empresaId, ...buildData(body) },
    })
    return NextResponse.json(parceiro, { status: 201 })
}

function buildData(body: any) {
    return {
        tipoPessoa: body.tipoPessoa ?? 'J',
        xNome:   body.xNome   ?? '',
        cnpj:    body.cnpj    ?? null,
        cpf:     body.cpf     ?? null,
        ie:      body.ie      ?? null,
        fone:    body.fone    ?? null,
        email:   body.email   ?? null,
        xLgr:   body.xLgr    ?? null,
        nro:    body.nro      ?? null,
        xCompl: body.xCompl   ?? null,
        xBairro: body.xBairro ?? null,
        cMun:   body.cMun     ?? null,
        xMun:   body.xMun     ?? null,
        uf:     body.uf       ?? null,
        cep:    body.cep      ?? null,
        cPais:  body.cPais    ?? '1058',
        xPais:  body.xPais    ?? 'BRASIL',
    }
}
