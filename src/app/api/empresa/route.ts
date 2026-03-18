import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const empresa = await prisma.empresa.findUnique({
        where: { id: session.user.empresaId },
    })
    return NextResponse.json(empresa ?? {})
}

export async function PUT(req: Request) {
    const session = await auth()
    if (!session?.user?.empresaId)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id, createdAt, updatedAt, users, ctes, parceiros, ...data } = body

    const empresa = await prisma.empresa.update({
        where: { id: session.user.empresaId },
        data,
    })
    return NextResponse.json(empresa)
}
