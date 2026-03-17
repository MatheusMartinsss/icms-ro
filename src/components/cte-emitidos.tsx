'use client'

import { imprimirCte } from '@/services/cte'
import axios from 'axios'
import { useEffect, useState } from 'react'
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table'

type Ambiente = 'homologacao' | 'producao'

type CteItem = {
    id: string
    ambiente: Ambiente
    created_at: string
    status: string
    data_emissao?: string
    numero?: number
    serie?: number
    valor_total?: number
    chave?: string
}

type ListCteResponse = {
    '@count'?: number
    data: CteItem[]
}

function formatDate(iso?: string) {
    if (!iso) return '-'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('pt-BR')
}

function formatMoney(v?: number) {
    if (v === null || v === undefined) return '-'
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_CLASS: Record<string, string> = {
    autorizado: 'bg-green-100 text-green-700',
    cancelado: 'bg-red-100 text-red-700',
}

export function CteEmitidos() {
    const [top] = useState(20)
    const [skip, setSkip] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [resp, setResp] = useState<ListCteResponse | null>(null)

    const count = resp?.['@count']
    const rows = resp?.data ?? []
    const canPrev = skip > 0
    const canNext = rows.length === top

    useEffect(() => { load() }, [skip])

    async function load() {
        setLoading(true)
        setError(null)
        try {
            const { data } = await axios.get<ListCteResponse>('/api/nuvem/cte/', {
                params: {
                    cpf_cnpj: '29180936000123',
                    ambiente: 'producao',
                    $top: top,
                    $skip: skip,
                    $inlinecount: true,
                },
            })
            setResp(data)
        } catch (e: any) {
            setError(e?.response?.data?.error || e?.message || 'Erro ao buscar CT-e')
        } finally {
            setLoading(false)
        }
    }

    async function cancelar(id: string) {
        if (!confirm('Tem certeza que deseja cancelar este CT-e?')) return
        try {
            await axios.post(`/api/nuvem/cte/${id}/cancelar`, { justificativa: 'ERRO DE DIGITACAO' })
            await load()
            alert('Cancelamento solicitado com sucesso.')
        } catch (e: any) {
            alert(e?.response?.data?.error || e?.message || 'Erro ao cancelar CT-e')
        }
    }

    async function imprimir(id: string) {
        try {
            await imprimirCte(id)
        } catch (e: any) {
            alert(e?.response?.data?.error || e?.message || 'Erro ao imprimir CT-e')
        }
    }

    const columns: ColumnDef<CteItem>[] = [
        {
            accessorKey: 'id',
            header: 'ID',
            cell: ({ row }) => (
                <span className="font-mono text-xs text-slate-500" title={row.original.id}>
                    {row.original.id.slice(0, 8)}…
                </span>
            ),
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => (
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[row.original.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {row.original.status}
                </span>
            ),
        },
        {
            id: 'emissao',
            header: 'Emissão',
            cell: ({ row }) => formatDate(row.original.data_emissao || row.original.created_at),
        },
        {
            id: 'numero',
            header: 'Nº / Série',
            cell: ({ row }) => `${row.original.numero ?? '-'} / ${row.original.serie ?? '-'}`,
        },
        {
            accessorKey: 'valor_total',
            header: 'Valor',
            cell: ({ row }) => (
                <span className="font-medium">{formatMoney(row.original.valor_total)}</span>
            ),
        },
        {
            accessorKey: 'chave',
            header: 'Chave',
            cell: ({ row }) => (
                <span className="font-mono text-xs text-slate-500" title={row.original.chave ?? ''}>
                    {row.original.chave ? `${row.original.chave.slice(0, 12)}…` : '-'}
                </span>
            ),
        },
        {
            id: 'actions',
            header: 'Ações',
            cell: ({ row }) => (
                <div className="flex gap-2">
                    <button
                        onClick={() => imprimir(row.original.id)}
                        className="px-3 py-1 rounded-lg border border-slate-200 text-xs hover:bg-slate-50 transition-colors"
                    >
                        Imprimir
                    </button>
                    <button
                        onClick={() => cancelar(row.original.id)}
                        className="px-3 py-1 rounded-lg border border-red-600 bg-red-600 text-white text-xs hover:bg-red-700 transition-colors"
                    >
                        Cancelar
                    </button>
                </div>
            ),
        },
    ]

    const table = useReactTable({
        data: rows,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    return (
        <div className="space-y-4">
            {/* Paginação */}
            <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">
                    Total: {typeof count === 'number' ? count : '-'} | Mostrando: {rows.length}
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={() => setSkip((s) => Math.max(0, s - top))}
                        disabled={!canPrev || loading}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40 hover:bg-slate-50 transition-colors"
                    >
                        ← Anterior
                    </button>
                    <button
                        onClick={() => setSkip((s) => s + top)}
                        disabled={!canNext || loading}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40 hover:bg-slate-50 transition-colors"
                    >
                        Próximo →
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
                    <b>Erro:</b> {error}
                </div>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead className="bg-slate-700">
                            {table.getHeaderGroups().map((hg) => (
                                <tr key={hg.id} className="border-b border-slate-600">
                                    {hg.headers.map((header) => (
                                        <th
                                            key={header.id}
                                            className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-100"
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(header.column.columnDef.header, header.getContext())}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={columns.length} className="p-10 text-center text-sm text-slate-400">
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
                                            Carregando...
                                        </div>
                                    </td>
                                </tr>
                            ) : table.getRowModel().rows.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length} className="p-10 text-center text-sm text-slate-400">
                                        Nenhum CT-e encontrado.
                                    </td>
                                </tr>
                            ) : (
                                table.getRowModel().rows.map((row) => (
                                    <tr
                                        key={row.id}
                                        className="bg-white odd:bg-slate-50/50 hover:bg-sky-50/40 transition-colors"
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <td key={cell.id} className="px-4 py-3 text-sm text-slate-700">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
