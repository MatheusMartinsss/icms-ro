import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const take = Math.min(parseInt(searchParams.get('take') ?? '50'), 100)
    const skip = parseInt(searchParams.get('skip') ?? '0')

    const where = {
        empresaId: session.user.empresaId,
        ...(status ? { status } : {}),
    }

    const [ctes, total] = await Promise.all([
        prisma.cte.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take,
            skip,
            select: {
                id: true, status: true, nCT: true, serie: true,
                nomeRemetente: true, nomeDestinatario: true,
                valorTotal: true, dhEmi: true,
                idNuvem: true, chave: true,
                createdAt: true, updatedAt: true,
            },
        }),
        prisma.cte.count({ where }),
    ])

    return NextResponse.json({ data: ctes, total })
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { infCte, status, idNuvem, chave } = body

    if (!infCte) return NextResponse.json({ error: 'infCte obrigatório' }, { status: 400 })

    const ide = infCte?.ide ?? {}
    const cte = await prisma.cte.create({
        data: {
            empresaId: session.user.empresaId,
            status: status ?? 'rascunho',
            nCT: ide.nCT ?? null,
            serie: ide.serie ?? null,
            nomeRemetente: infCte?.rem?.xNome ?? null,
            nomeDestinatario: infCte?.dest?.xNome ?? null,
            valorTotal: infCte?.vPrest?.vTPrest ?? null,
            dhEmi: ide.dhEmi ? new Date(ide.dhEmi) : null,
            idNuvem: idNuvem ?? null,
            chave: chave ?? null,
            infCte,
        },
    })

    return NextResponse.json(cte, { status: 201 })
}
