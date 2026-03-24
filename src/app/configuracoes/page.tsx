'use client'

import { Navbar } from '@/components/navbar'
import { ConfiguracoesEmpresa } from '@/components/configuracoes-empresa'

export default function ConfiguracoesPage() {
    return (
        <main className="min-h-screen bg-slate-50 text-slate-900">
            <Navbar />
            <div className="max-w-6xl mx-auto px-6 py-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold">Configurações da Empresa</h1>
                    <p className="text-sm text-slate-500 mt-1">Dados fiscais e configurações gerais</p>
                </div>
                <ConfiguracoesEmpresa />
            </div>
        </main>
    )
}
