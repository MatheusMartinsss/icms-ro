import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const config = await prisma.empresaConfig.findUnique({
        where: { userId: (session.user as any).id },
    })
    return NextResponse.json(config ?? {})
}

export async function PUT(req: Request) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await req.json()
    const { id, userId, updatedAt, ...data } = body
    const config = await prisma.empresaConfig.upsert({
        where: { userId: (session.user as any).id },
        update: data,
        create: { userId: (session.user as any).id, ...data },
    })
    return NextResponse.json(config)
}
