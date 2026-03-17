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
                nextUrl.pathname.startsWith('/api/auth')
            if (!isLoggedIn && !isPublic) return false
            return true
        },
        jwt({ token, user }) {
            if (user) token.id = user.id
            return token
        },
        session({ session, token }) {
            if (token.id && session.user) {
                (session.user as any).id = token.id as string
            }
            return session
        },
    },
    providers: [],
}
