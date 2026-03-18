import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const parceiro = await prisma.parceiro.findFirst({
        where: { id: params.id, empresaId: session.user.empresaId },
    })
    if (!parceiro) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(parceiro)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const existing = await prisma.parceiro.findFirst({
        where: { id: params.id, empresaId: session.user.empresaId },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const updated = await prisma.parceiro.update({
        where: { id: params.id },
        data: {
            tipoPessoa: body.tipoPessoa ?? existing.tipoPessoa,
            xNome:   body.xNome   ?? existing.xNome,
            cnpj:    body.cnpj    ?? existing.cnpj,
            cpf:     body.cpf     ?? existing.cpf,
            ie:      body.ie      ?? existing.ie,
            fone:    body.fone    ?? existing.fone,
            email:   body.email   ?? existing.email,
            xLgr:   body.xLgr    ?? existing.xLgr,
            nro:    body.nro      ?? existing.nro,
            xCompl: body.xCompl   ?? existing.xCompl,
            xBairro: body.xBairro ?? existing.xBairro,
            cMun:   body.cMun     ?? existing.cMun,
            xMun:   body.xMun     ?? existing.xMun,
            uf:     body.uf       ?? existing.uf,
            cep:    body.cep      ?? existing.cep,
            cPais:  body.cPais    ?? existing.cPais,
            xPais:  body.xPais    ?? existing.xPais,
        },
    })

    return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const existing = await prisma.parceiro.findFirst({
        where: { id: params.id, empresaId: session.user.empresaId },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.parceiro.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
}
