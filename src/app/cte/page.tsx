'use client'

import { imprimirCte } from '@/services/cte'
import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'

type Ambiente = 'homologacao' | 'producao'

type CteAutorizacao = {
    digest_value?: string
    id?: string
    ambiente?: Ambiente
    status?: string
    autor?: { cpf_cnpj?: string }
    chave_acesso?: string
    data_evento?: string
    numero_sequencial?: number
    data_recebimento?: string
    codigo_status?: number
    motivo_status?: string
    numero_protocolo?: string
    codigo_mensagem?: number
    mensagem?: string
    tipo_evento?: string
}

type CteItem = {
    id: string
    ambiente: Ambiente
    created_at: string
    status: string
    referencia?: string
    data_emissao?: string
    modelo?: number
    serie?: number
    numero?: number
    tipo_emissao?: number
    valor_total?: number
    chave?: string
    autorizacao?: CteAutorizacao
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

export default function CtePage() {
    const [ambiente, setAmbiente] = useState<Ambiente>('producao')
    const [top, setTop] = useState(20)
    const [skip, setSkip] = useState(0)

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [resp, setResp] = useState<ListCteResponse | null>(null)

    const count = resp?.['@count']
    const rows = resp?.data ?? []

    const canPrev = skip > 0
    const canNext = rows.length === top
    useEffect(() => {
        load()
    }, [])

    async function load() {
        setLoading(true)
        setError(null)
        try {
            const { data } = await axios.get<ListCteResponse>(`/api/nuvem/cte/`, {
                params: {
                    cpf_cnpj: '29180936000123',
                    ambiente,
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
            await axios.post(`/api/nuvem/cte/${id}/cancelar`, {
                justificativa: 'ERRO DE DIGITACAO',
            })
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

    return (
        <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>CT-e emitidos</h1>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 220px 120px 120px auto',
                    gap: 8,
                    alignItems: 'end',
                }}
            >

            </div>

            {error && (
                <div style={{ padding: 12, border: '1px solid #f5c2c7', borderRadius: 10 }}>
                    <b>Erro:</b> {error}
                </div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>
                    Total: {typeof count === 'number' ? count : '-'} | Mostrando: {rows.length}
                </span>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => setSkip((s) => Math.max(0, s - top))}
                        disabled={!canPrev || loading}
                        style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #ddd' }}
                    >
                        ← Anterior
                    </button>
                    <button
                        onClick={() => setSkip((s) => s + top)}
                        disabled={!canNext || loading}
                        style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #ddd' }}
                    >
                        Próximo →
                    </button>
                </div>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#fafafa' }}>
                            <Th>ID</Th>
                            <Th>Status</Th>
                            <Th>Emissão</Th>
                            <Th>Nº/Série</Th>
                            <Th>Valor</Th>
                            <Th>Chave</Th>
                            <Th style={{ width: 240 }}>Ações</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: 14, textAlign: 'center', opacity: 0.7 }}>
                                    Nenhum CT-e encontrado.
                                </td>
                            </tr>
                        ) : (
                            rows.map((cte) => (
                                <tr key={cte.id} style={{ borderTop: '1px solid #eee' }}>
                                    <Td title={cte.id} mono>
                                        {cte.id.slice(0, 8)}…
                                    </Td>
                                    <Td>{cte.status}</Td>
                                    <Td>{formatDate(cte.data_emissao || cte.created_at)}</Td>
                                    <Td>
                                        {cte.numero ?? '-'} / {cte.serie ?? '-'}
                                    </Td>
                                    <Td>{formatMoney(cte.valor_total)}</Td>
                                    <Td title={cte.chave || ''} mono>
                                        {cte.chave ? `${cte.chave.slice(0, 10)}…` : '-'}
                                    </Td>
                                    <Td>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                onClick={() => imprimir(cte.id)}
                                                style={{
                                                    padding: '8px 10px',
                                                    borderRadius: 10,
                                                    border: '1px solid #ddd',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                Imprimir
                                            </button>
                                            <button
                                                onClick={() => cancelar(cte.id)}
                                                style={{
                                                    padding: '8px 10px',
                                                    borderRadius: 10,
                                                    border: '1px solid #c00',
                                                    background: '#c00',
                                                    color: 'white',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </Td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function Th(props: React.ThHTMLAttributes<HTMLTableCellElement>) {
    return (
        <th
            {...props}
            style={{
                textAlign: 'left',
                fontSize: 12,
                fontWeight: 700,
                padding: 12,
                borderBottom: '1px solid #eee',
                ...props.style,
            }}
        />
    )
}

function Td({
    mono,
    ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { mono?: boolean }) {
    return (
        <td
            {...props}
            style={{
                padding: 12,
                fontSize: 13,
                verticalAlign: 'middle',
                fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' : undefined,
                ...props.style,
            }}
        />
    )
}
