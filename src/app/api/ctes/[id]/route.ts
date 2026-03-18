import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

async function getOwned(id: string, empresaId: string) {
    return prisma.cte.findFirst({ where: { id, empresaId } })
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const cte = await getOwned(params.id, session.user.empresaId)
    if (!cte) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(cte)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const existing = await getOwned(params.id, session.user.empresaId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const { infCte, status, idNuvem, chave } = body

    const ide = infCte?.ide ?? (existing.infCte as any)?.ide ?? {}
    const updated = await prisma.cte.update({
        where: { id: params.id },
        data: {
            ...(infCte ? {
                infCte,
                nCT: ide.nCT ?? existing.nCT,
                serie: ide.serie ?? existing.serie,
                nomeRemetente: infCte?.rem?.xNome ?? existing.nomeRemetente,
                nomeDestinatario: infCte?.dest?.xNome ?? existing.nomeDestinatario,
                valorTotal: infCte?.vPrest?.vTPrest ?? existing.valorTotal,
                dhEmi: ide.dhEmi ? new Date(ide.dhEmi) : existing.dhEmi,
            } : {}),
            ...(status ? { status } : {}),
            ...(idNuvem !== undefined ? { idNuvem } : {}),
            ...(chave !== undefined ? { chave } : {}),
        },
    })

    return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const existing = await getOwned(params.id, session.user.empresaId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.cte.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
}
