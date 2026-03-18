import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

async function getOwned(id: string, empresaId: string) {
    return prisma.mdfe.findFirst({ where: { id, empresaId } })
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const mdfe = await getOwned(params.id, session.user.empresaId)
    if (!mdfe) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(mdfe)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const existing = await getOwned(params.id, session.user.empresaId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const { infMDFe, status, idNuvem, chave, erroMsg } = body

    const ide = infMDFe?.ide ?? (existing.infMDFe as any)?.ide ?? {}

    const updated = await prisma.mdfe.update({
        where: { id: params.id },
        data: {
            ...(infMDFe ? {
                infMDFe,
                nMDF:  ide.nMDF  ?? existing.nMDF,
                serie: ide.serie ?? existing.serie,
                ufIni: ide.UFIni ?? existing.ufIni,
                ufFim: ide.UFFim ?? existing.ufFim,
                dhEmi: ide.dhEmi ? new Date(ide.dhEmi) : existing.dhEmi,
            } : {}),
            ...(status  !== undefined ? { status }  : {}),
            ...(idNuvem !== undefined ? { idNuvem } : {}),
            ...(chave   !== undefined ? { chave }   : {}),
            ...(erroMsg !== undefined ? { erroMsg } : {}),
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

    await prisma.mdfe.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
}
