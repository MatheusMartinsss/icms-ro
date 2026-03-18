import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
    const body = await req.json()
    const { email, password, name, razaoSocial, cnpj } = body

    if (!email || !password || !razaoSocial) {
        return NextResponse.json(
            { error: 'email, password e razaoSocial são obrigatórios' },
            { status: 400 }
        )
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
        return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.$transaction(async (tx) => {
        const empresa = await tx.empresa.create({
            data: { razaoSocial, cnpj: cnpj ?? '' },
        })
        return tx.user.create({
            data: {
                email,
                passwordHash,
                name: name ?? null,
                role: 'owner',
                empresaId: empresa.id,
            },
        })
    })

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 })
}
