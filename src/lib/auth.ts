import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { authConfig } from '@/lib/auth.config'

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    adapter: PrismaAdapter(prisma),
    session: { strategy: 'jwt' },
    providers: [
        Credentials({
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Senha', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null
                const user = await prisma.user.findUnique({
                    where: { email: String(credentials.email) },
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        passwordHash: true,
                        empresaId: true,
                        role: true,
                    },
                })
                if (!user) return null
                const valid = await bcrypt.compare(String(credentials.password), user.passwordHash)
                if (!valid) return null
                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    empresaId: user.empresaId,
                    role: user.role,
                }
            },
        }),
    ],
})
