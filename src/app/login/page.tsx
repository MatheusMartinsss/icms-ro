'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        const result = await signIn('credentials', {
            email,
            password,
            redirect: false,
        })
        setLoading(false)
        if (result?.error) {
            toast.error('Email ou senha incorretos')
        } else {
            router.push('/')
            router.refresh()
        }
    }

    return (
        <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl border shadow-sm p-8 w-full max-w-sm space-y-6">
                <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                        F
                    </div>
                    <h1 className="text-xl font-semibold text-slate-800">FreteCalc</h1>
                    <p className="text-sm text-slate-500">Entre com sua conta</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            required
                            autoComplete="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="voce@empresa.com"
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <Label htmlFor="password">Senha</Label>
                        <Input
                            id="password"
                            type="password"
                            required
                            autoComplete="current-password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="mt-1"
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading
                            ? <><span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white mr-2" />Entrando...</>
                            : 'Entrar'
                        }
                    </Button>
                </form>

                <p className="text-center text-sm text-slate-500">
                    Não tem conta?{' '}
                    <Link href="/cadastro" className="text-sky-600 hover:underline">
                        Criar empresa
                    </Link>
                </p>
            </div>
        </main>
    )
}
