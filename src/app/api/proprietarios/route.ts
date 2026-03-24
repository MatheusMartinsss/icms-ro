import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()

    const proprietarios = await prisma.proprietario.findMany({
        where: {
            empresaId: session.user.empresaId,
            ...(q ? {
                OR: [
                    { xNome: { contains: q, mode: 'insensitive' } },
                    { cpf:   { contains: q.replace(/\D/g, '') } },
                    { cnpj:  { contains: q.replace(/\D/g, '') } },
                ],
            } : {}),
        },
        orderBy: { xNome: 'asc' },
        take: 20,
    })

    return NextResponse.json(proprietarios)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body      = await req.json()
    const empresaId = session.user.empresaId
    const cpf       = body.cpf  ? body.cpf.replace(/\D/g, '')  : null
    const cnpj      = body.cnpj ? body.cnpj.replace(/\D/g, '') : null

    if (!body.xNome?.trim())
        return NextResponse.json({ error: 'xNome obrigatório' }, { status: 400 })
    if (!body.rntrc?.trim())
        return NextResponse.json({ error: 'RNTRC obrigatório' }, { status: 400 })

    // busca existente pelo documento
    const existing = await prisma.proprietario.findFirst({
        where: {
            empresaId,
            ...(cpf  ? { cpf }  :
                cnpj ? { cnpj } : {}),
        },
    })

    const data = {
        xNome:  body.xNome.trim(),
        rntrc:  body.rntrc.trim(),
        tpProp: Number(body.tpProp) ?? 0,
        cpf:    cpf  || null,
        cnpj:   cnpj || null,
        ie:     body.ie || null,
        uf:     body.uf || null,
    }

    const proprietario = existing
        ? await prisma.proprietario.update({ where: { id: existing.id }, data })
        : await prisma.proprietario.create({ data: { empresaId, ...data } })

    return NextResponse.json(proprietario, { status: 201 })
}
