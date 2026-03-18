'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

function maskCNPJ(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 14)
    if (d.length <= 2) return d
    if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
    if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
    if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export default function CadastroPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        razaoSocial: '',
        cnpj: '',
        name: '',
        email: '',
        password: '',
    })

    function set(field: string, value: string) {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)

        const res = await fetch('/api/registro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        })

        if (!res.ok) {
            const err = await res.json()
            toast.error(err.error ?? 'Erro ao criar conta')
            setLoading(false)
            return
        }

        const result = await signIn('credentials', {
            email: form.email,
            password: form.password,
            redirect: false,
        })

        setLoading(false)

        if (result?.error) {
            toast.error('Conta criada, mas falha no login automático. Faça login manualmente.')
            router.push('/login')
        } else {
            toast.success('Conta criada com sucesso!')
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
                    <p className="text-sm text-slate-500">Crie sua empresa</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="razaoSocial">Razão Social *</Label>
                        <Input
                            id="razaoSocial" required
                            value={form.razaoSocial}
                            onChange={e => set('razaoSocial', e.target.value.toUpperCase())}
                            placeholder="TRANSPORTE LTDA"
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <Label htmlFor="cnpj">CNPJ</Label>
                        <Input
                            id="cnpj"
                            value={maskCNPJ(form.cnpj)}
                            onChange={e => set('cnpj', e.target.value.replace(/\D/g, '').slice(0, 14))}
                            placeholder="00.000.000/0000-00"
                            className="mt-1 font-mono"
                        />
                    </div>
                    <div>
                        <Label htmlFor="name">Seu nome</Label>
                        <Input
                            id="name"
                            value={form.name}
                            onChange={e => set('name', e.target.value)}
                            placeholder="João Silva"
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <Label htmlFor="email">Email *</Label>
                        <Input
                            id="email" type="email" required
                            value={form.email}
                            onChange={e => set('email', e.target.value)}
                            placeholder="voce@empresa.com"
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <Label htmlFor="password">Senha *</Label>
                        <Input
                            id="password" type="password" required
                            value={form.password}
                            onChange={e => set('password', e.target.value)}
                            placeholder="••••••••"
                            className="mt-1"
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading
                            ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Criando conta...</>
                            : 'Criar conta'
                        }
                    </Button>
                </form>

                <p className="text-center text-sm text-slate-500">
                    Já tem conta?{' '}
                    <Link href="/login" className="text-sky-600 hover:underline">
                        Entrar
                    </Link>
                </p>
            </div>
        </main>
    )
}
