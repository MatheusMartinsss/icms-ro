'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { imprimirMdfe, encerrarMdfe, cancelarMdfe } from '@/services/mdfe'
import { useEmpresaConfig } from '@/components/configuracoes-empresa'

interface MdfeItem {
    id: string
    status: string
    nMDF: number | null
    serie: number | null
    ufIni: string | null
    ufFim: string | null
    dhEmi: string | null
    idNuvem: string | null
    chave: string | null
    createdAt: string
}

const STATUS_LABEL: Record<string, string> = {
    rascunho:    'Rascunho',
    autorizado:  'Autorizado',
    encerrado:   'Encerrado',
    cancelado:   'Cancelado',
    erro:        'Erro',
}
const STATUS_COLOR: Record<string, string> = {
    rascunho:   'bg-slate-100 text-slate-600',
    autorizado: 'bg-emerald-100 text-emerald-700',
    encerrado:  'bg-blue-100 text-blue-700',
    cancelado:  'bg-red-100 text-red-600',
    erro:       'bg-orange-100 text-orange-700',
}

export default function MdfePage() {
    const router = useRouter()
    const { config: empresa } = useEmpresaConfig()

    const [items, setItems]   = useState<MdfeItem[]>([])
    const [total, setTotal]   = useState(0)
    const [page, setPage]     = useState(0)
    const [loading, setLoading] = useState(false)
    const [status, setStatus] = useState('')
    const TAKE = 25

    async function load(p = 0, st = status) {
        setLoading(true)
        try {
            const params = new URLSearchParams({ take: String(TAKE), skip: String(p * TAKE) })
            if (st) params.set('status', st)
            const res = await fetch(`/api/mdfes?${params}`)
            const json = await res.json()
            setItems(json.data ?? [])
            setTotal(json.total ?? 0)
            setPage(p)
        } finally { setLoading(false) }
    }

    useEffect(() => { load() }, [])

    async function handleEncerrar(item: MdfeItem) {
        if (!item.idNuvem) return toast.error('MDF-e sem ID da Nuvem Fiscal.')
        if (!confirm('Encerrar este MDF-e?')) return
        try {
            const dhEnc = new Date().toISOString()
            await encerrarMdfe(item.idNuvem, {
                cuf: Number(empresa.cuf ?? '11'),
                dhEnc,
                cMun: empresa.cMunEnv ?? '',
            })
            await fetch(`/api/mdfes/${item.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'encerrado' }),
            })
            toast.success('MDF-e encerrado com sucesso.')
            load(page)
        } catch (e: any) {
            toast.error(e?.response?.data?.details?.message ?? e?.message ?? 'Erro ao encerrar MDF-e.')
        }
    }

    async function handleCancelar(item: MdfeItem) {
        if (!item.idNuvem) return toast.error('MDF-e sem ID da Nuvem Fiscal.')
        if (!confirm('Cancelar este MDF-e?')) return
        try {
            await cancelarMdfe(item.idNuvem)
            await fetch(`/api/mdfes/${item.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'cancelado' }),
            })
            toast.success('MDF-e cancelado.')
            load(page)
        } catch (e: any) {
            toast.error(e?.response?.data?.details?.message ?? e?.message ?? 'Erro ao cancelar MDF-e.')
        }
    }

    const pages = Math.max(1, Math.ceil(total / TAKE))

    return (
        <main className="min-h-screen bg-slate-50 text-slate-900">
            <header className="sticky top-0 z-10 bg-white border-b shadow-sm">
                <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-3">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">F</div>
                        <span className="font-semibold text-slate-800">FreteCalc</span>
                    </Link>
                    <span className="text-slate-300">/</span>
                    <span className="text-sm text-slate-500">MDF-e</span>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-6 py-8 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">MDF-e</h1>
                        <p className="text-sm text-slate-500 mt-1">Manifesto Eletrônico de Documentos Fiscais</p>
                    </div>
                    <Link href="/mdfe/emitir">
                        <button className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors">
                            + Emitir MDF-e
                        </button>
                    </Link>
                </div>

                {/* Filtros */}
                <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-3 items-end">
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Status</label>
                        <select
                            value={status}
                            onChange={e => { setStatus(e.target.value); load(0, e.target.value) }}
                            className="h-9 rounded-lg border border-slate-200 px-2 text-sm"
                        >
                            <option value="">Todos</option>
                            <option value="rascunho">Rascunho</option>
                            <option value="autorizado">Autorizado</option>
                            <option value="encerrado">Encerrado</option>
                            <option value="cancelado">Cancelado</option>
                            <option value="erro">Erro</option>
                        </select>
                    </div>
                </div>

                {/* Tabela */}
                <div className="bg-white rounded-xl border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nº MDF-e</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">UF Ini → Fim</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Emissão</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && (
                                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>
                            )}
                            {!loading && items.length === 0 && (
                                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Nenhum MDF-e encontrado.</td></tr>
                            )}
                            {!loading && items.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 font-mono font-medium">
                                        {item.nMDF ? `${item.serie ?? ''}/${item.nMDF}` : '—'}
                                    </td>
                                    <td className="px-4 py-3 font-medium">
                                        {item.ufIni && item.ufFim ? `${item.ufIni} → ${item.ufFim}` : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">
                                        {item.dhEmi ? new Date(item.dhEmi).toLocaleDateString('pt-BR') : '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[item.status] ?? 'bg-slate-100 text-slate-600'}`}>
                                            {STATUS_LABEL[item.status] ?? item.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1.5 justify-end flex-wrap">
                                            {item.status === 'rascunho' && (
                                                <button
                                                    onClick={() => router.push(`/mdfe/emitir?id=${item.id}`)}
                                                    className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 text-xs hover:bg-sky-100 transition-colors"
                                                >
                                                    Continuar
                                                </button>
                                            )}
                                            {item.status === 'autorizado' && (
                                                <>
                                                    <button
                                                        onClick={() => item.idNuvem && imprimirMdfe(item.idNuvem).catch(e => toast.error(e?.message ?? 'Erro ao imprimir'))}
                                                        disabled={!item.idNuvem}
                                                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs hover:bg-slate-50 disabled:opacity-40 transition-colors"
                                                    >
                                                        Imprimir
                                                    </button>
                                                    <button
                                                        onClick={() => handleEncerrar(item)}
                                                        className="px-2.5 py-1 rounded-lg border border-blue-200 text-blue-700 text-xs hover:bg-blue-50 transition-colors"
                                                    >
                                                        Encerrar
                                                    </button>
                                                    <button
                                                        onClick={() => handleCancelar(item)}
                                                        className="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 text-xs hover:bg-red-50 transition-colors"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </>
                                            )}
                                            {item.status === 'encerrado' && item.idNuvem && (
                                                <button
                                                    onClick={() => imprimirMdfe(item.idNuvem!).catch(e => toast.error(e?.message ?? 'Erro'))}
                                                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs hover:bg-slate-50 transition-colors"
                                                >
                                                    Imprimir
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Paginação */}
                    <div className="border-t px-4 py-3 flex items-center justify-between text-sm text-slate-500">
                        <span>{total} registro{total !== 1 ? 's' : ''}</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => load(0)} disabled={page === 0} className="px-2 py-1 rounded border disabled:opacity-30 hover:bg-slate-50">«</button>
                            <button onClick={() => load(page - 1)} disabled={page === 0} className="px-2 py-1 rounded border disabled:opacity-30 hover:bg-slate-50">‹</button>
                            <span>Página {page + 1} de {pages}</span>
                            <button onClick={() => load(page + 1)} disabled={page >= pages - 1} className="px-2 py-1 rounded border disabled:opacity-30 hover:bg-slate-50">›</button>
                            <button onClick={() => load(pages - 1)} disabled={page >= pages - 1} className="px-2 py-1 rounded border disabled:opacity-30 hover:bg-slate-50">»</button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
}
