'use client'

import { ChangeEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import xml2js from 'xml2js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import axios from 'axios'
import { toast } from 'sonner'
import { emitirCte } from '@/services/cte'
import { CtePartesBuilder } from '@/lib/cte/cte'
import Indice from '../../indice.json'
import { useEmpresaConfig } from '@/components/configuracoes-empresa'

type Status = 'idle' | 'loading' | 'success' | 'error'

type ParteForm = {
    xNome: string
    cnpj: string
    cpf: string
    ie: string
    fone: string
    email: string
    xLgr: string
    nro: string
    xBairro: string
    cMun: string
    xMun: string
    uf: string
    cep: string
}

const emptyParte = (): ParteForm => ({
    xNome: '', cnpj: '', cpf: '', ie: '', fone: '', email: '',
    xLgr: '', nro: '', xBairro: '', cMun: '', xMun: '', uf: '', cep: '',
})

function parteFromEmit(emit: any): ParteForm {
    const e = emit?.enderEmit ?? {}
    return {
        xNome: emit?.xNome ?? '',
        cnpj: String(emit?.CNPJ ?? '').replace(/\D/g, ''),
        cpf: String(emit?.CPF ?? '').replace(/\D/g, ''),
        ie: emit?.IE ?? '',
        fone: e.fone ?? emit?.fone ?? '',
        email: emit?.email ?? '',
        xLgr: e.xLgr ?? '',
        nro: e.nro ?? '',
        xBairro: e.xBairro ?? '',
        cMun: e.cMun ?? '',
        xMun: e.xMun ?? '',
        uf: e.UF ?? '',
        cep: String(e.CEP ?? '').replace(/\D/g, ''),
    }
}

function parteFromDest(dest: any): ParteForm {
    const e = dest?.enderDest ?? {}
    return {
        xNome: dest?.xNome ?? '',
        cnpj: String(dest?.CNPJ ?? '').replace(/\D/g, ''),
        cpf: String(dest?.CPF ?? '').replace(/\D/g, ''),
        ie: dest?.IE ?? '',
        fone: dest?.fone ?? '',
        email: dest?.email ?? '',
        xLgr: e.xLgr ?? '',
        nro: e.nro ?? '',
        xBairro: e.xBairro ?? '',
        cMun: e.cMun ?? '',
        xMun: e.xMun ?? '',
        uf: e.UF ?? '',
        cep: String(e.CEP ?? '').replace(/\D/g, ''),
    }
}

export default function EmitirCtePage() {
    const { config: empresa } = useEmpresaConfig()
    const [nfe, setNfe] = useState<any>(null)
    const [status, setStatus] = useState<Status>('idle')
    const [errMsg, setErrMsg] = useState('')

    const [rem, setRem] = useState<ParteForm>(emptyParte())
    const [dest, setDest] = useState<ParteForm>(emptyParte())
    const [toma, setToma] = useState('3')
    const [carga, setCarga] = useState({ proPred: 'MADEIRA', peso: '', vCarga: '', rntrc: '' })
    const [trib, setTrib] = useState({ vTPrest: '', pICMS: '12', cst: '00' })
    const [calc, setCalc] = useState({
        show: false,
        origem: '', destino: '', distancia: '0', eixos: '4',
        tipoCarga: 'geral', peso: '', pesoTotalCarga: '', multiplasNfe: false,
    })
    const [calcResultado, setCalcResultado] = useState({ base: 0, icms: 0, icmsReduzido: 0 })
    const [obs, setObs] = useState('TRANSPORTE SUBCONTRATADO NOS TERMOS DO ANEXO XIII - PARTE 01 - CAPÍTULO 01 - SUBSEÇÃO 01 - ARTIGO 40 - DECRETO22.721/2018.CRÉDITO PRESUMIDO EM 20%,CONFORME ANEXO IV - PARTE 02 - ITEM 03 - SEÇÃO VI - ARTIGO 10 - DECRETO 22.721/2018.')

    const setR = (f: keyof ParteForm, v: string) => setRem(s => ({ ...s, [f]: v }))
    const setD = (f: keyof ParteForm, v: string) => setDest(s => ({ ...s, [f]: v }))
    const setC = (f: keyof typeof carga, v: string) => setCarga(s => ({ ...s, [f]: v }))
    const setT = (f: keyof typeof trib, v: string) => setTrib(s => ({ ...s, [f]: v }))
    const setCalcF = <K extends keyof typeof calc>(f: K, v: typeof calc[K]) =>
        setCalc(s => ({ ...s, [f]: v }))

    const SCALE = 10000
    const calcFrete = () => {
        const data = Indice.find(item => item.tipo === calc.tipoCarga)
        if (!data) return
        const ccdInt = Math.round(Number((data.coeficientes.ccd as any)[calc.eixos]) * SCALE)
        const ccInt = Math.round(Number((data.coeficientes.cc as any)[calc.eixos]) * SCALE)
        const distInt = Math.round(Number(calc.distancia))
        const totalInt = ccdInt * distInt + ccInt
        const totalReais = totalInt / SCALE
        let base = 0
        if (calc.multiplasNfe && calc.pesoTotalCarga) {
            base = Math.round(Number(calc.peso) * (totalReais / Number(calc.pesoTotalCarga)) * SCALE)
        } else {
            base = Math.round(totalReais * SCALE)
        }
        const icms = Math.round(base * 0.12)
        const reducao = Math.round(icms * 0.20)
        const icmsReduzido = icms - reducao
        setCalcResultado({ base, icms, icmsReduzido })
        setTrib(s => ({ ...s, vTPrest: (base / SCALE).toFixed(2) }))
    }

    const [fetchingDist, setFetchingDist] = useState(false)
    const fetchCalcDistance = async (origem: string, destino: string) => {
        if (!origem || !destino) return
        setFetchingDist(true)
        try {
            const { data } = await axios.post('/api/', { body: { origem, destino, distancia: '0' } })
            const km = String(Math.round(data.rows[0].elements[0].distance.value / 1000))
            setCalc(s => ({
                ...s,
                origem: data.origin_addresses ?? s.origem,
                destino: data.destination_addresses ?? s.destino,
                distancia: km,
            }))
        } catch {
            // mantém distância manual
        } finally {
            setFetchingDist(false)
        }
    }

    // Quando abre a calculadora, pré-preenche origem/destino das partes e busca distância
    useEffect(() => {
        if (!calc.show) return
        const origem = rem.xMun && rem.uf ? `${rem.xMun} - ${rem.uf}` : ''
        const destino = dest.xMun && dest.uf ? `${dest.xMun} - ${dest.uf}` : ''
        setCalc(s => ({ ...s, origem, destino }))
        if (origem && destino) fetchCalcDistance(origem, destino)
    }, [calc.show])

    // Sincroniza RNTRC com config da empresa
    useEffect(() => {
        if (empresa.rntrc) setCarga(s => ({ ...s, rntrc: empresa.rntrc }))
    }, [empresa.rntrc])

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
                    const { dest: d, emit: em, ide, transp, total } = NFe.infNFe
                    let pesoLiquido = 0
                    if (transp?.vol) {
                        const vols = Array.isArray(transp.vol) ? transp.vol : [transp.vol]
                        pesoLiquido = vols.reduce((acc: number, v: any) => acc + (Number(v.pesoL) || 0), 0)
                    }
                    const vNF = total?.ICMSTot?.vNF ?? ''
                    setNfe({ emit: em, dest: d, ide, peso: String(pesoLiquido).replace(/\D/g, ''), raw: result })
                    setRem(parteFromEmit(em))
                    setDest(parteFromDest(d))
                    setCarga(s => ({ ...s, peso: String(pesoLiquido).replace(/\D/g, ''), vCarga: String(vNF) }))
                    setErrMsg('')
                    setStatus('idle')
                } catch {
                    setErrMsg('Não foi possível ler os dados da NF-e.')
                }
            })
        }
        reader.readAsText(file)
    }

    const vBC = Number(trib.vTPrest) || 0
    const pICMS = Number(trib.pICMS) || 12
    const vICMS = Math.round(vBC * (pICMS / 100) * 100) / 100

    const handleSalvarRascunho = async () => {
        if (!nfe) return
        setStatus('loading')
        try {
            const payload = new CtePartesBuilder(nfe)
                .buildCompl({ xObs: obs })
                .buildvPrest({ total: vBC, xNome: 'Valor do Frete' })
                .buildImp({ vBC, pICMS, vICMS })
                .buildInfCteNorm({
                    infCarga: { proPred: carga.proPred, vCarga: Number(carga.vCarga) || undefined },
                    infModal: { versaoModal: '4.00', rodo: { RNTRC: carga.rntrc } },
                })
                .buildEmitente({ CNPJ: empresa.cnpj || undefined, IE: empresa.ie || undefined })
                .buildRemetente()
                .buildDestinatario()
                .build()

            await fetch('/api/ctes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ infCte: payload.infCte, status: 'rascunho' }),
            })
            setStatus('idle')
            toast.success('Rascunho salvo com sucesso')
        } catch {
            setStatus('error')
            toast.error('Erro ao salvar rascunho')
        }
    }

    const handleEmitir = async () => {
        if (!nfe) return
        setStatus('loading')
        setErrMsg('')
        try {
            // Busca config atualizada do banco para garantir sequenciaCte correto
            const cfgRes = await fetch('/api/empresa')
            const cfgAtual = cfgRes.ok ? await cfgRes.json() : empresa
            const nCT: number = cfgAtual.sequenciaCte ?? empresa.sequenciaCte ?? 1
            const serie: number = cfgAtual.serie ?? empresa.serie ?? 99

            // Reconstrói o nfe com os dados editados — campos opcionais vazios viram undefined
            const clean = (v: string | undefined) => (v && v.trim() !== '' ? v : undefined)
            const nfeEditado = {
                ...nfe,
                emit: {
                    ...nfe.emit,
                    xNome: rem.xNome,
                    CNPJ: clean(rem.cnpj),
                    CPF: !rem.cnpj ? clean(rem.cpf) : undefined,
                    IE: clean(rem.ie),
                    email: clean(rem.email),
                    enderEmit: {
                        xLgr: rem.xLgr, nro: rem.nro, xBairro: rem.xBairro,
                        cMun: rem.cMun, xMun: rem.xMun, UF: rem.uf,
                        CEP: clean(rem.cep),
                        fone: clean(rem.fone),
                    },
                },
                dest: {
                    ...nfe.dest,
                    xNome: dest.xNome,
                    CNPJ: clean(dest.cnpj),
                    CPF: !dest.cnpj ? clean(dest.cpf) : undefined,
                    IE: clean(dest.ie),
                    email: clean(dest.email),
                    fone: clean(dest.fone),
                    enderDest: {
                        xLgr: dest.xLgr, nro: dest.nro, xBairro: dest.xBairro,
                        cMun: dest.cMun, xMun: dest.xMun, UF: dest.uf,
                        CEP: clean(dest.cep),
                    },
                },
                peso: carga.peso,
            }

            const payload = new CtePartesBuilder(nfeEditado)
                .builIde({ nCT, serie, toma3: { toma: Number(toma) as any } })
                .buildCompl({ xObs: obs })
                .buildvPrest({ total: vBC, xNome: 'Valor do Frete' })
                .buildImp({ vBC, pICMS, vICMS })
                .buildInfCteNorm({
                    infCarga: { proPred: carga.proPred, vCarga: Number(carga.vCarga) || undefined },
                    infModal: { versaoModal: '4.00', rodo: { RNTRC: carga.rntrc } },
                })
                .buildEmitente({
                    CNPJ: empresa.cnpj || undefined,
                    IE: empresa.ie || undefined,
                })
                .buildRemetente()
                .buildDestinatario()
                .build()

            const result = await emitirCte(payload)

            // Salva no banco independente do resultado
            await fetch('/api/ctes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    infCte: payload.infCte,
                    status: result?.status ?? 'desconhecido',
                    idNuvem: result?.id ?? null,
                    chave: result?.chave ?? null,
                }),
            })

            if (result?.status === 'autorizado') {
                setStatus('success')
                // Incrementa sequência no banco
                await fetch('/api/empresa', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sequenciaCte: nCT + 1 }),
                })
                toast.success('CT-e autorizado pela SEFAZ', {
                    description: `Nº ${result.numero} · Protocolo ${result.autorizacao?.numero_protocolo ?? '—'}`,
                    duration: 8000,
                })
            } else if (result?.status === 'rejeitado') {
                const motivo = result.autorizacao?.motivo_status ?? 'Motivo não informado'
                setStatus('error')
                setErrMsg(motivo)
                toast.error(`CT-e rejeitado (${result.autorizacao?.codigo_status ?? ''})`, {
                    description: motivo,
                    duration: 12000,
                })
            } else {
                setStatus('success')
                toast.info(`CT-e criado — status: ${result?.status ?? 'desconhecido'}`, {
                    description: `ID: ${result?.id ?? '—'}`,
                    duration: 8000,
                })
            }
        } catch (e: any) {
            const apiErr = e?.response?.data
            const msg = apiErr?.details?.error?.message
                ?? apiErr?.error
                ?? e?.message
                ?? 'Erro ao emitir CT-e.'
            setStatus('error')
            setErrMsg(msg)
            toast.error('Falha ao emitir CT-e', { description: msg, duration: 10000 })
        }
    }

    const tomaLabel: Record<string, string> = { '0': 'Remetente', '1': 'Expedidor', '2': 'Recebedor', '3': 'Destinatário' }

    return (
        <main className="min-h-screen bg-slate-50 text-slate-900">
            {/* Topbar */}
            <header className="sticky top-0 z-10 bg-white border-b shadow-sm">
                <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">F</div>
                        <span className="font-semibold text-slate-800">FreteCalc</span>
                    </Link>
                    <span className="text-slate-300">/</span>
                    <span className="text-sm text-slate-500">Emitir CT-e</span>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Emitir CT-e</h1>
                        <p className="text-sm text-slate-500 mt-1">Preencha os dados para emissão do Conhecimento de Transporte Eletrônico.</p>
                    </div>
                </div>

                {/* Upload XML — fora das tabs */}
                <div className="bg-white rounded-2xl border p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                        <Label htmlFor="xml" className="font-medium">XML da NF-e</Label>
                        <Input type="file" accept=".xml" onChange={readXml} id="xml" className="mt-1" />
                    </div>
                    {nfe && (
                        <div className="text-sm text-sky-700 bg-sky-50 rounded-xl px-4 py-2 border border-sky-100 whitespace-nowrap">
                            NF-e <b>{nfe.ide?.nNF}</b> carregada &mdash; {nfe.emit?.enderEmit?.xMun}/{nfe.emit?.enderEmit?.UF} → {nfe.dest?.enderDest?.xMun}/{nfe.dest?.enderDest?.UF}
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <Tabs defaultValue="remetente">
                    <TabsList className="flex-wrap h-auto gap-1">
                        <TabsTrigger value="remetente">Remetente</TabsTrigger>
                        <TabsTrigger value="destinatario">Destinatário</TabsTrigger>
                        <TabsTrigger value="tomador">Tomador</TabsTrigger>
                        <TabsTrigger value="carga">Dados da Carga</TabsTrigger>
                        <TabsTrigger value="tributacao">Tributação / Despesas</TabsTrigger>
                        <TabsTrigger value="observacao">Observação</TabsTrigger>
                    </TabsList>

                    {/* ── Remetente ── */}
                    <TabsContent value="remetente">
                        <Card title="Remetente">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <Field label="Razão Social / Nome" value={rem.xNome} onChange={v => setR('xNome', v)} />
                                </div>
                                <Field label="CNPJ" value={rem.cnpj} onChange={v => setR('cnpj', v.replace(/\D/g, ''))} maxLength={14} mono />
                                <Field label="CPF" value={rem.cpf} onChange={v => setR('cpf', v.replace(/\D/g, ''))} maxLength={11} mono placeholder="Apenas se pessoa física" />
                                <Field label="Inscrição Estadual" value={rem.ie} onChange={v => setR('ie', v)} />
                                <Field label="Telefone" value={rem.fone} onChange={v => setR('fone', v)} />
                                <div className="md:col-span-2">
                                    <Field label="E-mail" value={rem.email} onChange={v => setR('email', v)} />
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Endereço</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-2">
                                        <Field label="Logradouro" value={rem.xLgr} onChange={v => setR('xLgr', v)} />
                                    </div>
                                    <Field label="Número" value={rem.nro} onChange={v => setR('nro', v)} />
                                    <Field label="Bairro" value={rem.xBairro} onChange={v => setR('xBairro', v)} />
                                    <Field label="Município" value={rem.xMun} onChange={v => setR('xMun', v)} />
                                    <Field label="UF" value={rem.uf} onChange={v => setR('uf', v.toUpperCase())} maxLength={2} />
                                    <Field label="CEP" value={rem.cep} onChange={v => setR('cep', v.replace(/\D/g, ''))} maxLength={8} mono />
                                    <Field label="Cód. Município (IBGE)" value={rem.cMun} onChange={v => setR('cMun', v)} />
                                </div>
                            </div>
                        </Card>
                    </TabsContent>

                    {/* ── Destinatário ── */}
                    <TabsContent value="destinatario">
                        <Card title="Destinatário">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <Field label="Razão Social / Nome" value={dest.xNome} onChange={v => setD('xNome', v)} />
                                </div>
                                <Field label="CNPJ" value={dest.cnpj} onChange={v => setD('cnpj', v.replace(/\D/g, ''))} maxLength={14} mono />
                                <Field label="CPF" value={dest.cpf} onChange={v => setD('cpf', v.replace(/\D/g, ''))} maxLength={11} mono placeholder="Apenas se pessoa física" />
                                <Field label="Inscrição Estadual" value={dest.ie} onChange={v => setD('ie', v)} />
                                <Field label="Telefone" value={dest.fone} onChange={v => setD('fone', v)} />
                                <div className="md:col-span-2">
                                    <Field label="E-mail" value={dest.email} onChange={v => setD('email', v)} />
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Endereço</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-2">
                                        <Field label="Logradouro" value={dest.xLgr} onChange={v => setD('xLgr', v)} />
                                    </div>
                                    <Field label="Número" value={dest.nro} onChange={v => setD('nro', v)} />
                                    <Field label="Bairro" value={dest.xBairro} onChange={v => setD('xBairro', v)} />
                                    <Field label="Município" value={dest.xMun} onChange={v => setD('xMun', v)} />
                                    <Field label="UF" value={dest.uf} onChange={v => setD('uf', v.toUpperCase())} maxLength={2} />
                                    <Field label="CEP" value={dest.cep} onChange={v => setD('cep', v.replace(/\D/g, ''))} maxLength={8} mono />
                                    <Field label="Cód. Município (IBGE)" value={dest.cMun} onChange={v => setD('cMun', v)} />
                                </div>
                            </div>
                        </Card>
                    </TabsContent>

                    {/* ── Tomador ── */}
                    <TabsContent value="tomador">
                        <Card title="Tomador do Serviço">
                            <p className="text-sm text-slate-500 mb-4">
                                Indica quem é o responsável pelo pagamento do frete.
                            </p>
                            <div className="max-w-xs">
                                <Label htmlFor="toma">Tomador</Label>
                                <Select value={toma} onValueChange={setToma}>
                                    <SelectTrigger id="toma" className="w-full mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">0 — Remetente</SelectItem>
                                        <SelectItem value="1">1 — Expedidor</SelectItem>
                                        <SelectItem value="2">2 — Recebedor</SelectItem>
                                        <SelectItem value="3">3 — Destinatário</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {(toma === '0' || toma === '3') && (
                                <div className="mt-5 rounded-xl bg-sky-50 border border-sky-100 p-4 text-sm text-slate-700 space-y-1">
                                    <p className="font-medium text-sky-800 mb-2">
                                        {tomaLabel[toma]} selecionado como tomador
                                    </p>
                                    {toma === '0' && (
                                        <>
                                            <p><span className="text-slate-400">Nome:</span> {rem.xNome || '—'}</p>
                                            <p><span className="text-slate-400">CNPJ/CPF:</span> {rem.cnpj || rem.cpf || '—'}</p>
                                            <p><span className="text-slate-400">IE:</span> {rem.ie || '—'}</p>
                                        </>
                                    )}
                                    {toma === '3' && (
                                        <>
                                            <p><span className="text-slate-400">Nome:</span> {dest.xNome || '—'}</p>
                                            <p><span className="text-slate-400">CNPJ/CPF:</span> {dest.cnpj || dest.cpf || '—'}</p>
                                            <p><span className="text-slate-400">IE:</span> {dest.ie || '—'}</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </Card>
                    </TabsContent>

                    {/* ── Dados da Carga ── */}
                    <TabsContent value="carga">
                        <Card title="Dados da Carga">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Field label="Produto predominante" value={carga.proPred} onChange={v => setC('proPred', v.toUpperCase())} placeholder="Ex: MADEIRA" />
                                <Field label="Peso líquido (kg)" value={carga.peso} onChange={v => setC('peso', v.replace(/\D/g, ''))} placeholder="Ex: 18000" />
                                <Field label="Valor da carga (R$)" value={carga.vCarga} onChange={v => setC('vCarga', v)} placeholder="Ex: 50000.00" />
                                <Field label="RNTRC" value={carga.rntrc} onChange={v => setC('rntrc', v)} placeholder="00000000" />
                            </div>
                        </Card>
                    </TabsContent>

                    {/* ── Tributação / Despesas ── */}
                    <TabsContent value="tributacao">
                        <Card title="Tributação / Despesas">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Valor do frete + botão calculadora */}
                                <div>
                                    <Label htmlFor="vTPrest">Valor do Frete (R$)</Label>
                                    <div className="flex gap-2 mt-1">
                                        <Input
                                            id="vTPrest"
                                            value={trib.vTPrest}
                                            onChange={e => setT('vTPrest', e.target.value)}
                                            placeholder="Ex: 1500.00"
                                        />
                                        <Button
                                            type="button"
                                            variant={calc.show ? 'default' : 'outline'}
                                            size="sm"
                                            className="whitespace-nowrap shrink-0"
                                            onClick={() => setCalcF('show', !calc.show)}
                                            title="Usar Calculadora de ICMS"
                                        >
                                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3M13 3h5m0 0v5m0-5L10 11" />
                                            </svg>
                                            Calculadora
                                        </Button>
                                    </div>
                                </div>

                                <Field label="Alíquota ICMS (%)" value={trib.pICMS} onChange={v => setT('pICMS', v)} placeholder="12" />

                                <div>
                                    <Label htmlFor="cst">CST</Label>
                                    <Select value={trib.cst} onValueChange={v => setT('cst', v)}>
                                        <SelectTrigger id="cst" className="w-full mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="00">00 — Tributação Normal</SelectItem>
                                            <SelectItem value="20">20 — Com Redução de BC</SelectItem>
                                            <SelectItem value="40">40 — Isento</SelectItem>
                                            <SelectItem value="41">41 — Não Tributado</SelectItem>
                                            <SelectItem value="60">60 — ICMS cobrado anteriormente</SelectItem>
                                            <SelectItem value="90">90 — Outros</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Calculadora inline */}
                            {calc.show && (
                                <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-5 space-y-4">
                                    <p className="text-sm font-semibold text-sky-800">Calculadora de ICMS</p>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                            <Label>Origem</Label>
                                            <Input
                                                className="mt-1" value={calc.origem}
                                                onChange={e => setCalcF('origem', e.target.value)}
                                                onBlur={() => fetchCalcDistance(calc.origem, calc.destino)}
                                                placeholder="Ex: Buritis - RO"
                                            />
                                        </div>
                                        <div>
                                            <Label>Destino</Label>
                                            <Input
                                                className="mt-1" value={calc.destino}
                                                onChange={e => setCalcF('destino', e.target.value)}
                                                onBlur={() => fetchCalcDistance(calc.origem, calc.destino)}
                                                placeholder="Ex: Itajaí - SC"
                                            />
                                        </div>
                                        <div>
                                            <Label>Distância (km)</Label>
                                            <div className="relative mt-1">
                                                <Input
                                                    value={fetchingDist ? '' : calc.distancia}
                                                    onChange={e => { if (/^\d*$/.test(e.target.value)) setCalcF('distancia', e.target.value) }}
                                                    placeholder={fetchingDist ? 'Buscando...' : 'Ex: 3500'}
                                                    disabled={fetchingDist}
                                                />
                                                {fetchingDist && (
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <Label>Eixos</Label>
                                            <Select value={calc.eixos} onValueChange={v => setCalcF('eixos', v)}>
                                                <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {['2','3','4','5','6','7','8','9'].map(n => (
                                                        <SelectItem key={n} value={n}>{n} eixos</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>Tipo de carga</Label>
                                            <Select value={calc.tipoCarga} onValueChange={v => setCalcF('tipoCarga', v)}>
                                                <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="geral">Geral</SelectItem>
                                                    <SelectItem value="granel_solido">Granel Sólido</SelectItem>
                                                    <SelectItem value="granel_liquido">Granel Líquido</SelectItem>
                                                    <SelectItem value="frigorificada_aquecida">Frigorificada ou Aquecida</SelectItem>
                                                    <SelectItem value="conteinerizada">Conteinerizada</SelectItem>
                                                    <SelectItem value="neogranel">Neogranel</SelectItem>
                                                    <SelectItem value="perigosa_granel_solido">Perigosa Granel Sólido</SelectItem>
                                                    <SelectItem value="perigosa_granel_liquido">Perigosa Granel Líquido</SelectItem>
                                                    <SelectItem value="perigosa_frigorificada_aquecida">Perigosa Frigorificada/Aquecida</SelectItem>
                                                    <SelectItem value="perigosa_conteinerizada">Perigosa Conteinerizada</SelectItem>
                                                    <SelectItem value="perigosa_carga_geral">Perigosa Carga Geral</SelectItem>
                                                    <SelectItem value="carga_granel_pressurizada">Carga Granel Pressurizada</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="flex items-center gap-2 mt-5 cursor-pointer select-none text-sm">
                                                <div
                                                    onClick={() => setCalcF('multiplasNfe', !calc.multiplasNfe)}
                                                    className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${calc.multiplasNfe ? 'bg-sky-600 border-sky-600' : 'bg-white border-slate-300'}`}
                                                >
                                                    {calc.multiplasNfe && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                                </div>
                                                Carga Parcial
                                            </label>
                                        </div>
                                    </div>

                                    {calc.multiplasNfe && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <Label>Peso Total da Carga (kg)</Label>
                                                <Input className="mt-1" value={calc.pesoTotalCarga} onChange={e => { if (/^\d*$/.test(e.target.value)) setCalcF('pesoTotalCarga', e.target.value) }} placeholder="Ex: 25000" />
                                            </div>
                                            <div>
                                                <Label>Peso Líquido desta NF-e (kg)</Label>
                                                <Input className="mt-1" value={calc.peso} onChange={e => { if (/^\d*$/.test(e.target.value)) setCalcF('peso', e.target.value) }} placeholder="Ex: 5000" />
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-3">
                                        <Button type="button" onClick={calcFrete} size="sm">
                                            Calcular
                                        </Button>
                                        {calcResultado.base > 0 && (
                                            <span className="text-sm text-sky-700">
                                                Frete: <b>R$ {(calcResultado.base / SCALE).toFixed(2)}</b>
                                                &nbsp;·&nbsp; ICMS: <b>R$ {(calcResultado.icms / SCALE).toFixed(2)}</b>
                                                &nbsp;·&nbsp; Red. 20%: <b>R$ {(calcResultado.icmsReduzido / SCALE).toFixed(2)}</b>
                                            </span>
                                        )}
                                    </div>

                                    {calcResultado.base > 0 && (
                                        <p className="text-xs text-sky-600">
                                            Valor preenchido automaticamente no campo "Valor do Frete".
                                        </p>
                                    )}
                                </div>
                            )}

                            {vBC > 0 && (
                                <div className="mt-4 rounded-xl bg-slate-50 border p-4 text-sm text-slate-600 space-y-1">
                                    <p className="font-semibold text-slate-700 mb-1">Resumo</p>
                                    <p>Valor do frete: <b>R$ {vBC.toFixed(2)}</b></p>
                                    <p>ICMS ({pICMS}%): <b>R$ {vICMS.toFixed(2)}</b></p>
                                </div>
                            )}
                        </Card>
                    </TabsContent>

                    {/* ── Observação ── */}
                    <TabsContent value="observacao">
                        <Card title="Observação">
                            <div>
                                <Label htmlFor="xObs">Texto complementar (xObs)</Label>
                                <textarea
                                    id="xObs"
                                    value={obs}
                                    onChange={e => setObs(e.target.value)}
                                    rows={6}
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 resize-y focus:outline-none focus:ring-2 focus:ring-sky-500"
                                />
                                <p className="text-xs text-slate-400 mt-1">{obs.length} caracteres</p>
                            </div>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Feedback inline (detalhe extra além do toast) */}
                {status === 'error' && errMsg && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                        <b>Rejeição SEFAZ:</b> {errMsg}
                    </div>
                )}

                <div className="flex gap-3 pb-8">
                    <Button onClick={handleEmitir} disabled={!nfe || status === 'loading'} className="gap-2">
                        {status === 'loading' && (
                            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        )}
                        {status === 'loading' ? 'Emitindo...' : 'Emitir CT-e'}
                    </Button>
                    <Button variant="outline" onClick={handleSalvarRascunho} disabled={!nfe || status === 'loading'}>
                        Salvar rascunho
                    </Button>
                    <Link href="/"><Button variant="ghost">Cancelar</Button></Link>
                </div>
            </div>
        </main>
    )
}

/* ── Helpers de layout ── */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4 mt-2">
            <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">{title}</h2>
            {children}
        </div>
    )
}

function Field({
    label, value, onChange, placeholder, maxLength, mono,
}: {
    label: string
    value: string
    onChange: (v: string) => void
    placeholder?: string
    maxLength?: number
    mono?: boolean
}) {
    return (
        <div>
            <Label>{label}</Label>
            <Input
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                maxLength={maxLength}
                className={`mt-1 ${mono ? 'font-mono' : ''}`}
            />
        </div>
    )
}
