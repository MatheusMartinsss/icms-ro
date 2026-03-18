import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status    = searchParams.get('status')
    const dataInicio = searchParams.get('dataInicio')
    const dataFim   = searchParams.get('dataFim')
    const take = Math.min(parseInt(searchParams.get('take') ?? '25'), 100)
    const skip = parseInt(searchParams.get('skip') ?? '0')

    const where: any = {
        empresaId: session.user.empresaId,
        ...(status ? { status } : {}),
        ...((dataInicio || dataFim) ? {
            dhEmi: {
                ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
                ...(dataFim   ? { lte: new Date(dataFim + 'T23:59:59') } : {}),
            },
        } : {}),
    }

    const [mdfes, total] = await Promise.all([
        prisma.mdfe.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take,
            skip,
            select: {
                id: true, status: true, nMDF: true, serie: true,
                ufIni: true, ufFim: true, dhEmi: true,
                idNuvem: true, chave: true,
                createdAt: true, updatedAt: true,
            },
        }),
        prisma.mdfe.count({ where }),
    ])

    return NextResponse.json({ data: mdfes, total })
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { infMDFe, status, idNuvem, chave, erroMsg } = body

    if (!infMDFe) return NextResponse.json({ error: 'infMDFe obrigatório' }, { status: 400 })

    const ide = infMDFe?.ide ?? {}
    const mdfe = await prisma.mdfe.create({
        data: {
            empresaId: session.user.empresaId,
            status:  status  ?? 'rascunho',
            nMDF:    ide.nMDF   ?? null,
            serie:   ide.serie  ?? null,
            ufIni:   ide.UFIni  ?? null,
            ufFim:   ide.UFFim  ?? null,
            dhEmi:   ide.dhEmi  ? new Date(ide.dhEmi) : null,
            idNuvem: idNuvem ?? null,
            chave:   chave   ?? null,
            erroMsg: erroMsg ?? null,
            infMDFe,
        },
    })

    return NextResponse.json(mdfe, { status: 201 })
}
