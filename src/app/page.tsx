'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CteEmitidos } from '@/components/cte-emitidos'
import { Navbar } from '@/components/navbar'

export default function Home() {
    return (
        <main className="min-h-screen bg-slate-50 text-slate-900">
            <Navbar />
            <div className="max-w-6xl mx-auto px-6 py-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-medium">CT-es Emitidos</h2>
                        <div className="flex gap-2">
                            <Link href="/cte/emitir-rapido">
                                <Button variant="outline" className="gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    Emissão Expressa
                                </Button>
                            </Link>
                            <Link href="/cte/emitir">
                                <Button className="gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                    Emitir CT-e
                                </Button>
                            </Link>
                        </div>
                    </div>
                    <CteEmitidos />
                </div>
            </div>
        </main>
    )
}
