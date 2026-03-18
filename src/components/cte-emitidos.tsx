'use client'

import { imprimirCte } from '@/services/cte'
import axios from 'axios'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table'

type CteItem = {
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
    createdAt: string
}

type Filters = {
    remetente: string
    destinatario: string
    dataInicio: string
    dataFim: string
    status: string
}

function formatDate(iso?: string | null) {
    if (!iso) return '-'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatMoney(v?: number | null) {
    if (v === null || v === undefined) return '-'
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_BADGE: Record<string, string> = {
    autorizado:   'bg-green-100 text-green-700 border-green-200',
    cancelado:    'bg-red-100   text-red-700   border-red-200',
    rejeitado:    'bg-amber-100 text-amber-700 border-amber-200',
    rascunho:     'bg-slate-100 text-slate-600 border-slate-200',
    desconhecido: 'bg-slate-100 text-slate-500 border-slate-200',
}

const STATUS_LABEL: Record<string, string> = {
    autorizado:   'Autorizado',
    cancelado:    'Cancelado',
    rejeitado:    'Rejeitado',
    rascunho:     'Rascunho',
    desconhecido: 'Desconhecido',
}

const TAKE = 25

function useDebounce<T>(value: T, delay = 400): T {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(id)
    }, [value, delay])
    return debounced
}

export function CteEmitidos() {
    const router = useRouter()
    const [skip, setSkip] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [rows, setRows] = useState<CteItem[]>([])
    const [total, setTotal] = useState(0)

    const [filters, setFilters] = useState<Filters>({
        remetente: '', destinatario: '', dataInicio: '', dataFim: '', status: '',
    })
    const debouncedRemetente = useDebounce(filters.remetente)
    const debouncedDestinatario = useDebounce(filters.destinatario)

    const setF = <K extends keyof Filters>(k: K, v: Filters[K]) => {
        setFilters(s => ({ ...s, [k]: v }))
        setSkip(0)
    }

    const hasFilters = filters.remetente || filters.destinatario || filters.dataInicio || filters.dataFim || filters.status
    const canPrev = skip > 0
    const canNext = skip + TAKE < total
    const pageNum = Math.floor(skip / TAKE) + 1
    const pageTotal = Math.ceil(total / TAKE) || 1

    // Reset skip when debounced text filters change
    const isFirstRender = useRef(true)
    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return }
        setSkip(0)
    }, [debouncedRemetente, debouncedDestinatario])

    useEffect(() => { load() }, [skip, debouncedRemetente, debouncedDestinatario, filters.dataInicio, filters.dataFim, filters.status])

    async function load() {
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams({
                take: String(TAKE),
                skip: String(skip),
                ...(debouncedRemetente ? { remetente: debouncedRemetente } : {}),
                ...(debouncedDestinatario ? { destinatario: debouncedDestinatario } : {}),
                ...(filters.dataInicio ? { dataInicio: filters.dataInicio } : {}),
                ...(filters.dataFim ? { dataFim: filters.dataFim } : {}),
                ...(filters.status ? { status: filters.status } : {}),
            })
            const res = await fetch(`/api/ctes?${params}`)
            if (!res.ok) throw new Error('Erro ao buscar CT-e')
            const json = await res.json()
            setRows(json.data ?? [])
            setTotal(json.total ?? 0)
        } catch (e: any) {
            setError(e?.message || 'Erro ao buscar CT-e')
        } finally {
            setLoading(false)
        }
    }

    async function cancelar(item: CteItem) {
        if (!item.idNuvem) return alert('CT-e sem ID da Nuvem Fiscal — não pode ser cancelado aqui.')
        if (!confirm('Tem certeza que deseja cancelar este CT-e?')) return
        try {
            await axios.post(`/api/nuvem/cte/${item.idNuvem}/cancelar`, { justificativa: 'ERRO DE DIGITACAO' })
            await fetch(`/api/ctes/${item.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'cancelado' }),
            })
            await load()
        } catch (e: any) {
            alert(e?.response?.data?.error || e?.message || 'Erro ao cancelar CT-e')
        }
    }

    async function imprimir(item: CteItem) {
        if (!item.idNuvem) return alert('CT-e ainda não foi enviado à Nuvem Fiscal.')
        try { await imprimirCte(item.idNuvem) }
        catch (e: any) { alert(e?.message || 'Erro ao imprimir CT-e') }
    }

    const columns: ColumnDef<CteItem>[] = [
        {
            id: 'numero',
            header: 'Nº / Série',
            size: 96,
            cell: ({ row }) => (
                <span className="font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">
                    {row.original.nCT ?? '—'}<span className="text-slate-400 font-normal"> / {row.original.serie ?? '—'}</span>
                </span>
            ),
        },
        {
            accessorKey: 'status',
            header: 'Status',
            size: 108,
            cell: ({ row }) => {
                const s = row.original.status
                return (
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[s] ?? STATUS_BADGE.desconhecido}`}>
                        {STATUS_LABEL[s] ?? s}
                    </span>
                )
            },
        },
        {
            accessorKey: 'nomeRemetente',
            header: 'Remetente',
            cell: ({ row }) => (
                <span className="block truncate" title={row.original.nomeRemetente ?? ''}>
                    {row.original.nomeRemetente ?? <span className="text-slate-400">—</span>}
                </span>
            ),
        },
        {
            accessorKey: 'nomeDestinatario',
            header: 'Destinatário',
            cell: ({ row }) => (
                <span className="block truncate" title={row.original.nomeDestinatario ?? ''}>
                    {row.original.nomeDestinatario ?? <span className="text-slate-400">—</span>}
                </span>
            ),
        },
        {
            accessorKey: 'nomeTomador',
            header: 'Tomador',
            cell: ({ row }) => (
                <span className="block truncate" title={row.original.nomeTomador ?? ''}>
                    {row.original.nomeTomador ?? <span className="text-slate-400">—</span>}
                </span>
            ),
        },
        {
            accessorKey: 'valorTotal',
            header: 'Valor Frete',
            size: 128,
            cell: ({ row }) => (
                <span className="font-medium text-slate-800 whitespace-nowrap">
                    {formatMoney(row.original.valorTotal)}
                </span>
            ),
        },
        {
            accessorKey: 'dhEmi',
            header: 'Emissão',
            size: 96,
            cell: ({ row }) => (
                <span className="text-slate-500 whitespace-nowrap">
                    {formatDate(row.original.dhEmi ?? row.original.createdAt)}
                </span>
            ),
        },
        {
            id: 'actions',
            header: '',
            size: 148,
            cell: ({ row }) => {
                const item = row.original
                const isAutorizado = item.status === 'autorizado'
                const isRascunho = item.status === 'rascunho'
                return (
                    <div className="flex gap-1.5 justify-end">
                        {isRascunho ? (
                            <button
                                onClick={() => router.push(`/cte/emitir?id=${item.id}`)}
                                className="px-2.5 py-1 rounded-lg border border-sky-500 bg-sky-500 text-white text-xs hover:bg-sky-600 transition-colors font-medium"
                            >
                                Continuar
                            </button>
                        ) : (
                            <button
                                onClick={() => imprimir(item)}
                                disabled={!item.idNuvem}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs hover:bg-slate-50 disabled:opacity-40 transition-colors"
                            >
                                Imprimir
                            </button>
                        )}
                        {isAutorizado && (
                            <button
                                onClick={() => cancelar(item)}
                                className="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 text-xs hover:bg-red-50 transition-colors"
                            >
                                Cancelar
                            </button>
                        )}
                    </div>
                )
            },
        },
    ]

    const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() })

    return (
        <div className="flex flex-col gap-4">
            {/* ── Filtros ── */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {/* Remetente */}
                    <div className="relative">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Remetente</label>
                        <div className="relative">
                            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="m21 21-4.35-4.35"/>
                            </svg>
                            <input
                                type="text"
                                value={filters.remetente}
                                onChange={e => setF('remetente', e.target.value)}
                                placeholder="Buscar remetente..."
                                className="w-full rounded-lg border border-slate-200 pl-8 pr-8 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                            />
                            {filters.remetente && (
                                <button onClick={() => setF('remetente', '')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Destinatário */}
                    <div className="relative">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Destinatário</label>
                        <div className="relative">
                            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="m21 21-4.35-4.35"/>
                            </svg>
                            <input
                                type="text"
                                value={filters.destinatario}
                                onChange={e => setF('destinatario', e.target.value)}
                                placeholder="Buscar destinatário..."
                                className="w-full rounded-lg border border-slate-200 pl-8 pr-8 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                            />
                            {filters.destinatario && (
                                <button onClick={() => setF('destinatario', '')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Data início */}
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Data de</label>
                        <input
                            type="date"
                            value={filters.dataInicio}
                            onChange={e => setF('dataInicio', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                        />
                    </div>

                    {/* Data fim */}
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Data até</label>
                        <input
                            type="date"
                            value={filters.dataFim}
                            onChange={e => setF('dataFim', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                        />
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                        <select
                            value={filters.status}
                            onChange={e => setF('status', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white"
                        >
                            <option value="">Todos</option>
                            <option value="autorizado">Autorizado</option>
                            <option value="rascunho">Rascunho</option>
                            <option value="cancelado">Cancelado</option>
                            <option value="rejeitado">Rejeitado</option>
                        </select>
                    </div>
                </div>

                {/* Limpar filtros */}
                {hasFilters && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                        <span className="text-xs text-slate-400">Filtros ativos</span>
                        <button
                            onClick={() => { setFilters({ remetente: '', destinatario: '', dataInicio: '', dataFim: '', status: '' }); setSkip(0) }}
                            className="text-xs text-sky-600 hover:text-sky-800 font-medium"
                        >
                            Limpar tudo
                        </button>
                    </div>
                )}
            </div>

            {error && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
                    <b>Erro:</b> {error}
                </div>
            )}

            {/* ── Tabela ── */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse table-fixed">
                        <colgroup>
                            <col style={{ width: 96 }} />
                            <col style={{ width: 108 }} />
                            <col />
                            <col />
                            <col />
                            <col style={{ width: 128 }} />
                            <col style={{ width: 96 }} />
                            <col style={{ width: 148 }} />
                        </colgroup>
                        <thead className="bg-slate-700">
                            {table.getHeaderGroups().map(hg => (
                                <tr key={hg.id}>
                                    {hg.headers.map(header => (
                                        <th
                                            key={header.id}
                                            className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300 first:rounded-tl-xl last:rounded-tr-xl"
                                        >
                                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={columns.length} className="p-12 text-center text-sm text-slate-400">
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
                                            Carregando...
                                        </div>
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length} className="p-12 text-center">
                                        <p className="text-sm text-slate-400">
                                            {hasFilters ? 'Nenhum CT-e encontrado com esses filtros.' : 'Nenhum CT-e emitido ainda.'}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                table.getRowModel().rows.map(row => (
                                    <tr key={row.id} className="bg-white odd:bg-slate-50/40 hover:bg-sky-50/30 transition-colors">
                                        {row.getVisibleCells().map(cell => (
                                            <td key={cell.id} className="px-4 py-3 text-sm text-slate-700 overflow-hidden">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── Rodapé / Paginação ── */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                    <p className="text-xs text-slate-500">
                        {loading ? '...' : (
                            <>
                                <span className="font-medium text-slate-700">{total}</span> CT-e{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
                                {total > 0 && <span className="ml-2 text-slate-400">· pág. {pageNum} de {pageTotal}</span>}
                            </>
                        )}
                    </p>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setSkip(0)}
                            disabled={!canPrev || loading}
                            className="px-2 py-1 rounded-lg border border-slate-200 text-xs disabled:opacity-40 hover:bg-white transition-colors"
                            title="Primeira página"
                        >
                            «
                        </button>
                        <button
                            onClick={() => setSkip(s => Math.max(0, s - TAKE))}
                            disabled={!canPrev || loading}
                            className="px-3 py-1 rounded-lg border border-slate-200 text-xs disabled:opacity-40 hover:bg-white transition-colors"
                        >
                            ← Anterior
                        </button>
                        <button
                            onClick={() => setSkip(s => s + TAKE)}
                            disabled={!canNext || loading}
                            className="px-3 py-1 rounded-lg border border-slate-200 text-xs disabled:opacity-40 hover:bg-white transition-colors"
                        >
                            Próximo →
                        </button>
                        <button
                            onClick={() => setSkip((pageTotal - 1) * TAKE)}
                            disabled={!canNext || loading}
                            className="px-2 py-1 rounded-lg border border-slate-200 text-xs disabled:opacity-40 hover:bg-white transition-colors"
                            title="Última página"
                        >
                            »
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
