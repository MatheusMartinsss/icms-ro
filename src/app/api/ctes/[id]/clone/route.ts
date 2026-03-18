import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const original = await prisma.cte.findFirst({
        where: { id: params.id, empresaId: session.user.empresaId },
    })
    if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const clone = await prisma.cte.create({
        data: {
            empresaId: session.user.empresaId,
            status: 'rascunho',
            serie: original.serie,
            nomeRemetente: original.nomeRemetente,
            nomeDestinatario: original.nomeDestinatario,
            valorTotal: original.valorTotal,
            infCte: original.infCte,
        },
    })

    return NextResponse.json(clone, { status: 201 })
}
