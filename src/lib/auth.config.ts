import type { NextAuthConfig } from 'next-auth'

// Config mínima, compatível com Edge Runtime (sem Prisma/pg)
export const authConfig: NextAuthConfig = {
    pages: {
        signIn: '/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user
            const isPublic =
                nextUrl.pathname.startsWith('/login') ||
                nextUrl.pathname.startsWith('/cadastro') ||
                nextUrl.pathname.startsWith('/api/auth') ||
                nextUrl.pathname.startsWith('/api/registro')
            if (!isLoggedIn && !isPublic) return false
            return true
        },
        jwt({ token, user }) {
            if (user) {
                token.id = user.id
                token.empresaId = (user as any).empresaId
                token.role = (user as any).role
            }
            return token
        },
        session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string
                session.user.empresaId = token.empresaId as string
                session.user.role = token.role as string
            }
            return session
        },
    },
    providers: [],
}
