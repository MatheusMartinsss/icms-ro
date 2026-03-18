import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { cteId, tipo, chave, idNuvem, erroMsg, payload } = body

    if (!tipo)
        return NextResponse.json({ error: 'tipo obrigatório' }, { status: 400 })

    const evento = await prisma.cteEvento.create({
        data: {
            empresaId: session.user.empresaId,
            cteId:   cteId   ?? null,
            tipo,
            chave:   chave   ?? null,
            idNuvem: idNuvem ?? null,
            erroMsg: erroMsg ?? null,
            payload: payload ?? null,
        },
    })

    return NextResponse.json(evento, { status: 201 })
}

export async function GET(req: Request) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const cteId = searchParams.get('cteId')

    const eventos = await prisma.cteEvento.findMany({
        where: {
            empresaId: session.user.empresaId,
            ...(cteId ? { cteId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
    })

    return NextResponse.json(eventos)
}
