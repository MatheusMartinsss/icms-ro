'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { imprimirCte } from '@/services/cte'

type CteRow = {
    id: string
    status: string
    nCT: number | null
    serie: number | null
    nomeRemetente: string | null
    nomeDestinatario: string | null
    nomeTomador: string | null
    valorTotal: number | null
    dhEmi: string | null
    idNuvem: string | null
    chave: string | null
    erroMsg: string | null
    createdAt: string
}

const STATUS_LABEL: Record<string, string> = {
    rascunho:   'Rascunho',
    autorizado: 'Autorizado',
    cancelado:  'Cancelado',
    erro:       'Erro',
}

const STATUS_CLASS: Record<string, string> = {
    rascunho:   'bg-slate-100 text-slate-600',
    autorizado: 'bg-emerald-100 text-emerald-700',
    cancelado:  'bg-rose-100 text-rose-700',
    erro:       'bg-red-100 text-red-700',
}

function fmtDate(iso?: string | null) {
    if (!iso) return '—'
    const d = new Date(iso)
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR')
}

function fmtMoney(v?: number | null) {
    if (v == null) return '—'
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function truncate(s?: string | null, n = 22) {
    if (!s) return '—'
    return s.length > n ? s.slice(0, n) + '…' : s
}

const PAGE_SIZE = 20

export default function CtePage() {
    const [rows, setRows]         = useState<CteRow[]>([])
    const [total, setTotal]       = useState(0)
    const [page, setPage]         = useState(0)
    const [loading, setLoading]   = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [syncing, setSyncing]   = useState<string | null>(null)

    const [fRem,    setFRem]    = useState('')
    const [fDest,   setFDest]   = useState('')
    const [fStatus, setFStatus] = useState('todos')
    const [fDe,     setFDe]     = useState('')
    const [fAte,    setFAte]    = useState('')

    const filtersRef = useRef({ fRem, fDest, fStatus, fDe, fAte })
    filtersRef.current = { fRem, fDest, fStatus, fDe, fAte }

    const load = useCallback(async (p: number) => {
        const { fRem, fDest, fStatus, fDe, fAte } = filtersRef.current
        setLoading(true)
        try {
            const params = new URLSearchParams({
                take: String(PAGE_SIZE),
                skip: String(p * PAGE_SIZE),
                ...(fRem    ? { remetente:    fRem }   : {}),
                ...(fDest   ? { destinatario: fDest }  : {}),
                ...(fStatus !== 'todos' ? { status: fStatus } : {}),
                ...(fDe  ? { dataInicio: fDe }  : {}),
                ...(fAte ? { dataFim:    fAte }  : {}),
            })
            const res = await fetch(`/api/ctes?${params}`)
            if (!res.ok) throw new Error('Erro ao buscar CT-es')
            const json = await res.json()
            setRows(json.data ?? [])
            setTotal(json.total ?? 0)
        } catch (e: any) {
            toast.error(e?.message ?? 'Erro ao carregar CT-es')
        } finally {
            setLoading(false)
        }
    }, [])

    // Carga inicial
    useEffect(() => { load(0) }, [load])

    // Filtros com debounce — reseta para página 0
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => { setPage(0); load(0) }, 350)
    }, [fRem, fDest, fStatus, fDe, fAte, load])

    // Paginação
    useEffect(() => { load(page) }, [page, load])

    async function handleDelete(id: string) {
        if (!confirm('Excluir este rascunho? Esta ação não pode ser desfeita.')) return
        setDeleting(id)
        try {
            const res = await fetch(`/api/ctes/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Falha ao excluir')
            toast.success('Rascunho excluído.')
            setRows(r => r.filter(x => x.id !== id))
            setTotal(t => t - 1)
        } catch {
            toast.error('Não foi possível excluir o rascunho.')
        } finally {
            setDeleting(null)
        }
    }

    async function handleSync(id: string) {
        setSyncing(id)
        try {
            const res = await fetch(`/api/ctes/${id}/sync`, { method: 'POST' })
            if (!res.ok) throw new Error('Falha ao sincronizar')
            toast.success('CT-e sincronizado.')
            load(page)
        } catch {
            toast.error('Erro ao sincronizar com SEFAZ.')
        } finally {
            setSyncing(null)
        }
    }

    async function handleDacte(id: string) {
        try { await imprimirCte(id) }
        catch { toast.error('Erro ao gerar DACTE.') }
    }

    const totalPages = Math.ceil(total / PAGE_SIZE) || 1

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="px-6 py-8 space-y-5">

                {/* ── Header ── */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <h1 className="text-xl font-semibold text-slate-800">CT-es Emitidos</h1>
                    <div className="flex items-center gap-2">
                        <Link href="/cte/emitir"
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                            </svg>
                            Emissão Expressa
                        </Link>
                        <Link href="/cte/emitir"
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                            </svg>
                            Emitir CT-e
                        </Link>
                    </div>
                </div>

                {/* ── Filtros ── */}
                <div className="bg-white rounded-2xl border shadow-sm p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        <div>
                            <label className="text-xs font-medium text-slate-500 mb-1 block">Remetente</label>
                            <div className="relative">
                                <svg className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35"/>
                                </svg>
                                <Input value={fRem} onChange={e => setFRem(e.target.value)}
                                    placeholder="Buscar remetente…" className="pl-7 h-8 text-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-500 mb-1 block">Destinatário</label>
                            <div className="relative">
                                <svg className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35"/>
                                </svg>
                                <Input value={fDest} onChange={e => setFDest(e.target.value)}
                                    placeholder="Buscar destinatário…" className="pl-7 h-8 text-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-500 mb-1 block">Data de</label>
                            <Input type="date" value={fDe} onChange={e => setFDe(e.target.value)} className="h-8 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-500 mb-1 block">Data até</label>
                            <Input type="date" value={fAte} onChange={e => setFAte(e.target.value)} className="h-8 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-500 mb-1 block">Status</label>
                            <Select value={fStatus} onValueChange={v => setFStatus(v)}>
                                <SelectTrigger className="h-8 text-sm w-full">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos</SelectItem>
                                    <SelectItem value="rascunho">Rascunho</SelectItem>
                                    <SelectItem value="autorizado">Autorizado</SelectItem>
                                    <SelectItem value="cancelado">Cancelado</SelectItem>
                                    <SelectItem value="erro">Erro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* ── Tabela ── */}
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-800 text-white text-xs uppercase tracking-wide">
                                    <th className="px-4 py-3 text-left font-semibold">Nº / Série</th>
                                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                                    <th className="px-4 py-3 text-left font-semibold">Remetente</th>
                                    <th className="px-4 py-3 text-left font-semibold">Destinatário</th>
                                    <th className="px-4 py-3 text-left font-semibold">Tomador</th>
                                    <th className="px-4 py-3 text-right font-semibold">Valor Frete</th>
                                    <th className="px-4 py-3 text-left font-semibold">Emissão</th>
                                    <th className="px-4 py-3 text-center font-semibold w-32">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="py-16 text-center text-slate-400">
                                            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500 mr-2 align-middle" />
                                            Carregando…
                                        </td>
                                    </tr>
                                ) : rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-16 text-center text-slate-400">
                                            Nenhum CT-e encontrado.
                                        </td>
                                    </tr>
                                ) : rows.map(cte => (
                                    <tr key={cte.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className="font-mono font-semibold text-slate-800">{cte.nCT ?? '—'}</span>
                                            <span className="text-slate-400 mx-1">/</span>
                                            <span className="text-slate-500">{cte.serie ?? '—'}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[cte.status] ?? 'bg-slate-100 text-slate-500'}`}>
                                                {STATUS_LABEL[cte.status] ?? cte.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-700" title={cte.nomeRemetente ?? undefined}>{truncate(cte.nomeRemetente)}</td>
                                        <td className="px-4 py-3 text-slate-700" title={cte.nomeDestinatario ?? undefined}>{truncate(cte.nomeDestinatario)}</td>
                                        <td className="px-4 py-3 text-slate-500" title={cte.nomeTomador ?? undefined}>{truncate(cte.nomeTomador)}</td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-800">{fmtMoney(cte.valorTotal)}</td>
                                        <td className="px-4 py-3 text-slate-600">{fmtDate(cte.dhEmi ?? cte.createdAt)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <ActionIcons
                                                    cte={cte}
                                                    deleting={deleting === cte.id}
                                                    syncing={syncing === cte.id}
                                                    onDelete={() => handleDelete(cte.id)}
                                                    onSync={() => handleSync(cte.id)}
                                                    onDacte={() => handleDacte(cte.idNuvem ?? cte.id)}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* ── Paginação ── */}
                    <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span>
                            {total} CT-{total === 1 ? 'e' : 'es'} encontrado{total !== 1 ? 's' : ''}
                            {' · pág. '}{page + 1} de {totalPages}
                        </span>
                        <div className="flex items-center gap-1">
                            <PagBtn onClick={() => setPage(0)} disabled={page === 0 || loading} title="Primeira">«</PagBtn>
                            <PagBtn onClick={() => setPage(p => p - 1)} disabled={page === 0 || loading} title="Anterior">← Anterior</PagBtn>
                            <PagBtn onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1 || loading} title="Próxima">Próximo →</PagBtn>
                            <PagBtn onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1 || loading} title="Última">»</PagBtn>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}

// ─── Botões de ação (ícones) ──────────────────────────────────────────────────

function ActionIcons({ cte, deleting, syncing, onDelete, onSync, onDacte }: {
    cte: CteRow
    deleting: boolean
    syncing: boolean
    onDelete: () => void
    onSync: () => void
    onDacte: () => void
}) {
    const btn = 'p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

    const EditBtn = (
        <Link href={`/cte/emitir?id=${cte.id}`} title="Continuar edição">
            <span className={`${btn} block text-sky-600 hover:bg-sky-50`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
            </span>
        </Link>
    )

    const ViewBtn = (
        <Link href={`/cte/emitir?id=${cte.id}`} title="Abrir">
            <span className={`${btn} block text-slate-500 hover:bg-slate-100`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
            </span>
        </Link>
    )

    const DacteBtn = (
        <button onClick={onDacte} title="Imprimir DACTE" className={`${btn} text-emerald-600 hover:bg-emerald-50`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
        </button>
    )

    const SyncBtn = (
        <button onClick={onSync} disabled={syncing} title="Sincronizar com SEFAZ" className={`${btn} text-amber-600 hover:bg-amber-50`}>
            {syncing
                ? <span className="block w-4 h-4 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600" />
                : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
            }
        </button>
    )

    const DeleteBtn = (
        <button onClick={onDelete} disabled={deleting} title="Excluir rascunho" className={`${btn} text-slate-400 hover:bg-red-50 hover:text-red-500`}>
            {deleting
                ? <span className="block w-4 h-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
                : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
            }
        </button>
    )

    if (cte.status === 'rascunho' || cte.status === 'erro') return <>{EditBtn}{DeleteBtn}</>
    if (cte.status === 'autorizado')                          return <>{ViewBtn}{DacteBtn}</>
    if (cte.status === 'cancelado')                           return <>{ViewBtn}{SyncBtn}{DacteBtn}</>

    // fallback para status desconhecido
    return <>{ViewBtn}</>
}

// ─── Botão de paginação ───────────────────────────────────────────────────────

function PagBtn({ children, disabled, onClick, title }: {
    children: React.ReactNode
    disabled?: boolean
    onClick: () => void
    title?: string
}) {
    return (
        <button onClick={onClick} disabled={disabled} title={title}
            className="px-2.5 py-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            {children}
        </button>
    )
}
