'use client'

import { ChangeEvent, useState } from 'react'
import Link from 'next/link'
import xml2js from 'xml2js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { emitirCte } from '@/services/cte'
import { CtePartesBuilder } from '@/lib/cte/cte'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function EmitirRapidoPage() {
    const [nfe, setNfe] = useState<any>(null)
    const [status, setStatus] = useState<Status>('idle')
    const [errMsg, setErrMsg] = useState('')

    const readXml = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (e) => {
            const content = e.target?.result
            if (!content) return
            xml2js.parseString(content, { explicitArray: false }, (err, result) => {
                if (err) { setErrMsg('XML inválido.'); return }
                try {
                    const { NFe } = result.nfeProc
                    const { dest, emit, ide, transp } = NFe.infNFe
                    let pesoLiquido = 0
                    if (transp?.vol) {
                        const volumes = Array.isArray(transp.vol) ? transp.vol : [transp.vol]
                        pesoLiquido = volumes.reduce((acc: number, vol: any) => acc + (Number(vol.pesoL) || 0), 0)
                    }
                    setNfe({ emit, dest, ide, peso: String(pesoLiquido).replace(/\D/g, ''), raw: result })
                    setStatus('idle')
                    setErrMsg('')
                } catch {
                    setErrMsg('Não foi possível ler os dados da NF-e.')
                }
            })
        }
        reader.readAsText(file)
    }

    const handleEmitir = async () => {
        if (!nfe) return
        setStatus('loading')
        setErrMsg('')
        try {
            const payload = new CtePartesBuilder(nfe)
                .builIde()
                .buildCompl()
                .buildvPrest()
                .buildImp()
                .buildInfCteNorm()
                .buildEmitente()
                .buildRemetente()
                .buildDestinatario()
                .build()
            await emitirCte(payload)
            setStatus('success')
        } catch (e: any) {
            setErrMsg(e?.response?.data?.error || e?.message || 'Erro ao emitir CT-e.')
            setStatus('error')
        }
    }

    return (
        <main className="min-h-screen bg-slate-50 text-slate-900">
            {/* Topbar */}
            <header className="sticky top-0 z-10 bg-white border-b shadow-sm">
                <div className="max-w-2xl mx-auto px-6 h-14 flex items-center gap-3">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                            F
                        </div>
                        <span className="font-semibold text-slate-800">FreteCalc</span>
                    </Link>
                    <span className="text-slate-300">/</span>
                    <span className="text-sm text-slate-500">Emissão Expressa</span>
                </div>
            </header>

            <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center gap-2">
                        <svg className="w-6 h-6 text-sky-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Emissão Expressa
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Carregue o XML da NF-e e emita o CT-e com os dados padrão da empresa.
                    </p>
                </div>

                <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-5">
                    {/* Upload XML */}
                    <div>
                        <Label className="font-medium" htmlFor="xml">XML da NF-e</Label>
                        <Input type="file" accept=".xml" onChange={readXml} id="xml" className="mt-1" />
                    </div>

                    {/* Preview dos dados */}
                    {nfe && (
                        <div className="rounded-xl bg-sky-50 border border-sky-100 p-4 space-y-2 text-sm">
                            <div className="font-medium text-sky-800">NF-e carregada com sucesso</div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-700">
                                <div>
                                    <span className="text-xs text-slate-400 block">Remetente</span>
                                    {nfe.emit?.xNome ?? '-'}
                                </div>
                                <div>
                                    <span className="text-xs text-slate-400 block">Destinatário</span>
                                    {nfe.dest?.xNome ?? '-'}
                                </div>
                                <div>
                                    <span className="text-xs text-slate-400 block">Origem</span>
                                    {nfe.emit?.enderEmit?.xMun} - {nfe.emit?.enderEmit?.UF}
                                </div>
                                <div>
                                    <span className="text-xs text-slate-400 block">Destino</span>
                                    {nfe.dest?.enderDest?.xMun} - {nfe.dest?.enderDest?.UF}
                                </div>
                                <div>
                                    <span className="text-xs text-slate-400 block">Peso líquido</span>
                                    {nfe.peso ? `${nfe.peso} kg` : '-'}
                                </div>
                                <div>
                                    <span className="text-xs text-slate-400 block">Nº NF-e</span>
                                    {nfe.ide?.nNF ?? '-'}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Feedback */}
                    {status === 'success' && (
                        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-700 font-medium">
                            CT-e emitido com sucesso!
                        </div>
                    )}
                    {status === 'error' && (
                        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                            <b>Erro:</b> {errMsg}
                        </div>
                    )}
                    {errMsg && status === 'idle' && (
                        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                            {errMsg}
                        </div>
                    )}

                    <div className="flex gap-3 pt-1">
                        <Button
                            onClick={handleEmitir}
                            disabled={!nfe || status === 'loading'}
                            className="gap-2"
                        >
                            {status === 'loading' && (
                                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                            )}
                            {status === 'loading' ? 'Emitindo...' : 'Emitir CT-e'}
                        </Button>
                        <Link href="/">
                            <Button variant="ghost">Cancelar</Button>
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    )
}
