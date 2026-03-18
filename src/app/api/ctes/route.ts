import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { upsertParceiro } from '@/lib/upsert-parceiro'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const remetente = searchParams.get('remetente')
    const destinatario = searchParams.get('destinatario')
    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')
    const take = Math.min(parseInt(searchParams.get('take') ?? '50'), 100)
    const skip = parseInt(searchParams.get('skip') ?? '0')

    const where: any = {
        empresaId: session.user.empresaId,
        ...(status ? { status } : {}),
        ...(remetente ? { nomeRemetente: { contains: remetente, mode: 'insensitive' } } : {}),
        ...(destinatario ? { nomeDestinatario: { contains: destinatario, mode: 'insensitive' } } : {}),
        ...((dataInicio || dataFim) ? {
            dhEmi: {
                ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
                ...(dataFim ? { lte: new Date(dataFim + 'T23:59:59') } : {}),
            },
        } : {}),
    }

    const [ctes, total] = await Promise.all([
        prisma.cte.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take,
            skip,
            select: {
                id: true, status: true, nCT: true, serie: true,
                nomeRemetente: true, nomeDestinatario: true, nomeTomador: true,
                valorTotal: true, dhEmi: true,
                idNuvem: true, chave: true,
                createdAt: true, updatedAt: true,
            },
        }),
        prisma.cte.count({ where }),
    ])

    return NextResponse.json({ data: ctes, total })
}

function resolveTomador(infCte: any): string | null {
    const toma = infCte?.ide?.toma3?.toma ?? infCte?.ide?.toma4?.toma
    switch (Number(toma)) {
        case 0: return infCte?.rem?.xNome ?? null   // remetente
        case 1: return infCte?.exped?.xNome ?? null  // expedidor
        case 2: return infCte?.receb?.xNome ?? null  // recebedor
        case 3: return infCte?.dest?.xNome ?? null   // destinatário
        default: return null
    }
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { infCte, status, idNuvem, chave } = body

    if (!infCte) return NextResponse.json({ error: 'infCte obrigatório' }, { status: 400 })

    const ide = infCte?.ide ?? {}
    const empresaId = session.user.empresaId

    const [remetenteId, destinatarioId] = await Promise.all([
        upsertParceiro(empresaId, infCte?.rem ?? {}),
        upsertParceiro(empresaId, infCte?.dest ?? {}),
    ])

    const cte = await prisma.cte.create({
        data: {
            empresaId,
            status: status ?? 'rascunho',
            nCT: ide.nCT ?? null,
            serie: ide.serie ?? null,
            nomeRemetente: infCte?.rem?.xNome ?? null,
            nomeDestinatario: infCte?.dest?.xNome ?? null,
            nomeTomador: resolveTomador(infCte),
            valorTotal: infCte?.vPrest?.vTPrest ?? null,
            dhEmi: ide.dhEmi ? new Date(ide.dhEmi) : null,
            idNuvem: idNuvem ?? null,
            chave: chave ?? null,
            infCte,
            remetenteId,
            destinatarioId,
        },
    })

    return NextResponse.json(cte, { status: 201 })
}
