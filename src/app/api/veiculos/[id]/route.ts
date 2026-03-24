import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body  = await req.json()
    const placa = body.placa?.replace(/[^A-Z0-9]/gi, '').toUpperCase()

    const veiculo = await prisma.veiculo.update({
        where: { id: params.id },
        data: {
            ...(placa ? { placa } : {}),
            renavam:        body.renavam ?? undefined,
            tara:           body.tara  !== undefined ? Number(body.tara)  : undefined,
            capKG:          body.capKG !== undefined ? Number(body.capKG) || null : undefined,
            capM3:          body.capM3 !== undefined ? Number(body.capM3) || null : undefined,
            tpRod:          body.tpRod  ?? undefined,
            tpCar:          body.tpCar  ?? undefined,
            uf:             body.uf     ?? undefined,
            rntrc:          body.rntrc  ?? undefined,
            proprietarioId: body.proprietarioId !== undefined ? (body.proprietarioId || null) : undefined,
        },
        include: { proprietario: true },
    })

    return NextResponse.json(veiculo)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await prisma.veiculo.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
}
