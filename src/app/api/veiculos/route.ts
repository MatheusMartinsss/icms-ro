import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

const include = { proprietario: true } as const

export async function GET(req: Request) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.toUpperCase()

    const veiculos = await prisma.veiculo.findMany({
        where: {
            empresaId: session.user.empresaId,
            ...(q ? { placa: { contains: q } } : {}),
        },
        include,
        orderBy: { placa: 'asc' },
        take: 20,
    })

    return NextResponse.json(veiculos)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body      = await req.json()
    const empresaId = session.user.empresaId
    const placa     = body.placa?.replace(/[^A-Z0-9]/gi, '').toUpperCase()

    if (!placa) return NextResponse.json({ error: 'Placa obrigatória' }, { status: 400 })

    const veiculo = await prisma.veiculo.upsert({
        where:   { empresaId_placa: { empresaId, placa } },
        update:  buildData(body, placa),
        create:  { empresaId, placa, ...buildData(body, placa) },
        include,
    })

    return NextResponse.json(veiculo, { status: 201 })
}

function buildData(body: any, placa: string) {
    return {
        renavam:       body.renavam        || null,
        tara:          Number(body.tara)   || 0,
        capKG:         body.capKG          ? Number(body.capKG)  : null,
        capM3:         body.capM3          ? Number(body.capM3)  : null,
        tpRod:         body.tpRod          || '01',
        tpCar:         body.tpCar          || '00',
        uf:            body.uf             || null,
        rntrc:         body.rntrc          || null,
        proprietarioId: body.proprietarioId || null,
    }
}
