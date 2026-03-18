'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { useEmpresaConfig } from '@/components/configuracoes-empresa'
import { MdfeBuilder, type CteSelecionado } from '@/lib/mdfe/builder'
import { emitirMdfe, imprimirMdfe } from '@/services/mdfe'

// ─── Schema ───────────────────────────────────────────────────────────────────

const munItem  = z.object({ cMun: z.string().min(1, 'Selecione um município'), xMun: z.string().min(1, 'Nome obrigatório') })
const ufItem   = z.object({ uf: z.string().min(2) })

const schema = z.object({
    // Cabeçalho
    modal:       z.string().min(1),
    tpEmit:      z.string().min(1),
    ufIni:       z.string().min(2, 'Obrigatório'),
    ufFim:       z.string().min(2, 'Obrigatório'),
    dtViagem:    z.string().optional(),
    hrSaida:     z.string().optional(),
    // Percurso
    munCarrega:  z.array(munItem).min(1, 'Pelo menos uma cidade de carregamento'),
    percurso:    z.array(ufItem),
    munDescarga: z.array(munItem),
    // Veículo
    rntrc:    z.string().regex(/^([0-9]{8}|ISENTO)$/, '8 dígitos ou ISENTO'),
    placa:    z.string().min(7, 'Placa inválida'),
    tpRod:    z.string().min(1, 'Obrigatório'),
    tpCar:    z.string().min(1, 'Obrigatório'),
    ufVeic:   z.string().min(2, 'Obrigatório'),
    condNome: z.string().min(2, 'Obrigatório'),
    condCpf:  z.string().min(11, 'CPF inválido'),
    // Totais
    vCarga: z.string().refine(v => Number(v) > 0, 'Obrigatório'),
    qCarga: z.string().min(1, 'Obrigatório'),
    cUnid:  z.enum(['01', '02']),
    infCpl: z.string(),
})

type FormValues = z.infer<typeof schema>

// ─── Constantes ───────────────────────────────────────────────────────────────

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

const TP_ROD = [
    { value: '01', label: 'Truck' },
    { value: '02', label: 'Toco' },
    { value: '03', label: 'Cavalo Mecânico' },
    { value: '04', label: 'VAN' },
    { value: '05', label: 'Utilitário' },
    { value: '06', label: 'Outros' },
]

const TP_CAR = [
    { value: '00', label: 'Não aplicável' },
    { value: '01', label: 'Aberta' },
    { value: '02', label: 'Fechada / Baú' },
    { value: '03', label: 'Graneleira' },
    { value: '04', label: 'Porta Container' },
    { value: '05', label: 'Sider' },
]

const MODAIS = [
    { value: '1', label: 'Rodoviário' },
    { value: '2', label: 'Aéreo' },
    { value: '3', label: 'Aquaviário' },
    { value: '4', label: 'Ferroviário' },
]

const TP_EMIT = [
    { value: '1', label: 'Prestador de serviço de transporte' },
    { value: '2', label: 'Transportador de Carga Própria' },
    { value: '3', label: 'Prestador de serviço de transporte (CT-e Globalizado)' },
]

function todayStr() { return new Date().toISOString().slice(0, 10) }

function defaultValues(): FormValues {
    return {
        modal: '1', tpEmit: '1',
        ufIni: 'RO', ufFim: 'RO',
        dtViagem: todayStr(), hrSaida: '',
        munCarrega:  [{ cMun: '', xMun: '' }],
        percurso:    [],
        munDescarga: [],
        rntrc: '', placa: '', tpRod: '01', tpCar: '00', ufVeic: 'RO',
        condNome: '', condCpf: '',
        vCarga: '', qCarga: '', cUnid: '01',
        infCpl: '',
    }
}

function maskCpf(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 3) return d
    if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
    if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}
function maskPlaca(v: string) { return v.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 7) }
function maskRntrc(v: string) {
    const up = v.toUpperCase()
    if (!up || /^[0-9]/.test(up)) return up.replace(/\D/g, '').slice(0, 8)
    return up.replace(/[^A-Z]/g, '').slice(0, 6)
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

type Status = 'idle' | 'loading' | 'success' | 'error'

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-white rounded-2xl border shadow-sm mt-2 ${className ?? ''}`}>
            <div className="px-5 py-3 border-b">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</h2>
            </div>
            <div className="p-5 space-y-3">
                {children}
            </div>
        </div>
    )
}

function Field({ label, value, onChange, placeholder, error, mono, readOnly, type, children }: {
    label: string; value?: string; onChange?: (v: string) => void
    placeholder?: string; error?: string; mono?: boolean; readOnly?: boolean
    type?: string; children?: React.ReactNode
}) {
    return (
        <div>
            <Label className={`text-xs ${error ? 'text-red-600' : 'text-slate-600'}`}>{label}</Label>
            {children ?? (
                <Input
                    type={type}
                    value={value ?? ''} onChange={e => onChange?.(e.target.value)}
                    placeholder={placeholder} readOnly={readOnly}
                    className={`mt-1 h-8 text-sm ${mono ? 'font-mono' : ''} ${error ? 'border-red-500' : ''} ${readOnly ? 'bg-slate-50 text-slate-500 cursor-default' : ''}`}
                />
            )}
            {error && <p className="mt-0.5 text-xs text-red-500">{error}</p>}
        </div>
    )
}

function SelectField({ label, value, onChange, options, error }: {
    label: string; value: string; onChange: (v: string) => void
    options: { value: string; label: string }[]; error?: string
}) {
    return (
        <div>
            <Label className={`text-xs ${error ? 'text-red-600' : 'text-slate-600'}`}>{label}</Label>
            <select
                value={value} onChange={e => onChange(e.target.value)}
                className={`mt-1 h-8 w-full rounded-lg border px-2 text-sm ${error ? 'border-red-500' : 'border-slate-200'} bg-white`}
            >
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {error && <p className="mt-0.5 text-xs text-red-500">{error}</p>}
        </div>
    )
}

function UfSelect({ label, value, onChange, error }: {
    label: string; value: string; onChange: (v: string) => void; error?: string
}) {
    return (
        <div>
            <Label className={`text-xs ${error ? 'text-red-600' : 'text-slate-600'}`}>{label}</Label>
            <select
                value={value} onChange={e => onChange(e.target.value)}
                className={`mt-1 h-8 w-full rounded-lg border px-2 text-sm ${error ? 'border-red-500' : 'border-slate-200'} bg-white`}
            >
                {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
            {error && <p className="mt-0.5 text-xs text-red-500">{error}</p>}
        </div>
    )
}

function ErrorDot() {
    return <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
}

// ─── Cache de municípios por UF ───────────────────────────────────────────────

const munCache: Record<string, { nome: string; codigo_ibge: string }[]> = {}

async function fetchMunicipios(uf: string) {
    if (munCache[uf]) return munCache[uf]
    const res  = await fetch(`https://brasilapi.com.br/api/ibge/municipios/v1/${uf}`)
    const data = await res.json()
    munCache[uf] = data
    return data as { nome: string; codigo_ibge: string }[]
}

function toTitleCase(str: string) {
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// ─── MunAutocomplete ──────────────────────────────────────────────────────────

function MunAutocomplete({
    uf, value, onChange, error, resetOnSelect = false,
}: {
    uf: string
    value: { cMun: string; xMun: string }
    onChange: (v: { cMun: string; xMun: string }) => void
    error?: string
    resetOnSelect?: boolean
}) {
    const [inputVal, setInputVal] = useState(value.xMun ? toTitleCase(value.xMun) : '')
    const [options, setOptions]   = useState<{ nome: string; codigo_ibge: string }[]>([])
    const [filtered, setFiltered] = useState<{ nome: string; codigo_ibge: string }[]>([])
    const [open, setOpen]         = useState(false)
    const [fetching, setFetching] = useState(false)
    const containerRef            = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!uf) return
        setFetching(true)
        fetchMunicipios(uf)
            .then(data => { setOptions(data); setFetching(false) })
            .catch(() => setFetching(false))
    }, [uf])

    useEffect(() => {
        if (!inputVal.trim()) {
            setFiltered(options.slice(0, 8))
        } else {
            const q = inputVal.toLowerCase()
            setFiltered(options.filter(o => o.nome.toLowerCase().includes(q)).slice(0, 8))
        }
    }, [inputVal, options])

    // Sincroniza quando valor externo muda (reset de form)
    useEffect(() => {
        if (!resetOnSelect) setInputVal(value.xMun ? toTitleCase(value.xMun) : '')
    }, [value.xMun])

    function handleSelect(m: { nome: string; codigo_ibge: string }) {
        onChange({ cMun: m.codigo_ibge, xMun: m.nome })
        if (resetOnSelect) {
            setInputVal('')
        } else {
            setInputVal(toTitleCase(m.nome))
        }
        setOpen(false)
    }

    return (
        <div ref={containerRef} className="relative">
            <Input
                value={inputVal}
                onChange={e => {
                    setInputVal(e.target.value)
                    setOpen(true)
                    if (!e.target.value && !resetOnSelect) onChange({ cMun: '', xMun: '' })
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                placeholder={fetching ? 'Carregando...' : 'Buscar município...'}
                disabled={!uf || fetching}
                className={`h-8 text-sm ${error ? 'border-red-500' : ''} ${!uf ? 'bg-slate-50' : ''}`}
            />
            {open && filtered.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {filtered.map(m => (
                        <button
                            key={m.codigo_ibge}
                            type="button"
                            onMouseDown={() => handleSelect(m)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between gap-2"
                        >
                            <span>{toTitleCase(m.nome)}</span>
                            <span className="text-[11px] text-slate-400 font-mono shrink-0">{m.codigo_ibge}</span>
                        </button>
                    ))}
                </div>
            )}
            {error && <p className="mt-0.5 text-xs text-red-500">{error}</p>}
        </div>
    )
}

// ─── Coluna de municípios ─────────────────────────────────────────────────────

function MunCol({
    title, fields, onAdd, onRemove, namePrefix, control, errors,
}: {
    title: string
    fields: { id: string }[]
    onAdd: () => void
    onRemove: (i: number) => void
    namePrefix: 'munCarrega' | 'munDescarga'
    control: any
    errors: any
}) {
    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</span>
                <button type="button" onClick={onAdd}
                    className="text-[11px] text-sky-600 hover:text-sky-700 font-medium hover:underline">
                    + Adicionar
                </button>
            </div>

            {fields.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6 border-2 border-dashed rounded-lg">
                    Nenhuma cidade adicionada
                </p>
            )}

            <div className="space-y-2">
                {fields.map((f, i) => (
                    <div key={f.id} className="bg-slate-50 border rounded-lg p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-400 font-medium">Cidade {i + 1}</span>
                            <button type="button" onClick={() => onRemove(i)}
                                className="text-[11px] text-red-400 hover:text-red-600">
                                Remover
                            </button>
                        </div>
                        <Controller
                            name={`${namePrefix}.${i}.cMun` as any}
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field label="Código IBGE" error={fieldState.error?.message}
                                    value={field.value} onChange={v => field.onChange(v.replace(/\D/g, '').slice(0, 7))}
                                    placeholder="0000000" mono />
                            )}
                        />
                        <Controller
                            name={`${namePrefix}.${i}.xMun` as any}
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field label="Município" error={fieldState.error?.message}
                                    value={field.value} onChange={field.onChange}
                                    placeholder="Nome da cidade" />
                            )}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function EmitirMdfePage() {
    const searchParams = useSearchParams()
    const { config: empresa } = useEmpresaConfig()

    const [draftId, setDraftId]               = useState<string | null>(null)
    const [nMDFe, setNMDFe]                   = useState<number>(1)
    const [status, setStatus]                 = useState<Status>('idle')
    const [errMsg, setErrMsg]                 = useState('')
    const [emittedIdNuvem, setEmittedIdNuvem] = useState<string | null>(null)
    const [ctesSelecionados, setCtesSelecionados] = useState<CteSelecionado[]>([])
    const [ctesDisponiveis, setCtesDisponiveis]   = useState<any[]>([])
    const [buscaCte, setBuscaCte]             = useState('')

    const { control, handleSubmit, setValue, getValues, reset, watch,
        formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: defaultValues(),
    })

    const { fields: munCarregaFields,  append: addMunCarrega,  remove: removeMunCarrega  } = useFieldArray({ control, name: 'munCarrega' })
    const { fields: percursoFields,    append: addPercurso,    remove: removePercurso    } = useFieldArray({ control, name: 'percurso' })
    const { fields: munDescargaFields, append: addMunDescarga, remove: removeMunDescarga } = useFieldArray({ control, name: 'munDescarga' })

    const ufIni = watch('ufIni')
    const ufFim = watch('ufFim')

    // Pré-preenche com dados da empresa
    useEffect(() => {
        if (empresa.rntrc)   setValue('rntrc', empresa.rntrc)
        if (empresa.ufEnv)   setValue('ufIni', empresa.ufEnv)
        if (empresa.sequenciaMdfe) setNMDFe(empresa.sequenciaMdfe)
        if (empresa.xMunEnv) {
            setValue('munCarrega', [{ cMun: empresa.cMunEnv ?? '', xMun: empresa.xMunEnv }])
        }
    }, [empresa.rntrc, empresa.ufEnv, empresa.sequenciaMdfe, empresa.cMunEnv, empresa.xMunEnv])

    // Carrega rascunho via ?id=
    useEffect(() => {
        const id = searchParams.get('id')
        if (!id) return
        setDraftId(id)
        fetch(`/api/mdfes/${id}`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then((mdfe: any) => {
                const inf  = mdfe.infMDFe
                if (!inf) return
                const ide  = inf.ide ?? {}
                const rodo = inf.infModal?.rodo ?? {}
                const veic = rodo.veicTracao ?? {}
                const cond = veic.condutor?.[0] ?? {}
                const tot  = inf.tot ?? {}
                const dhIni = ide.dhIniViagem ?? ''
                reset({
                    modal:    String(ide.modal  ?? '1'),
                    tpEmit:   String(ide.tpEmit ?? '1'),
                    ufIni:    ide.UFIni ?? 'RO',
                    ufFim:    ide.UFFim ?? 'RO',
                    dtViagem: dhIni ? dhIni.slice(0, 10) : todayStr(),
                    hrSaida:  dhIni ? dhIni.slice(11, 16) : '',
                    munCarrega:  (ide.infMunCarrega ?? []).map((m: any) => ({ cMun: m.cMunCarrega ?? '', xMun: m.xMunCarrega ?? '' })),
                    percurso:    (ide.infPercurso ?? []).map((p: any) => ({ uf: p.UFPer })),
                    munDescarga: (inf._munDescarga ?? []).map((m: any) => ({ cMun: m.cMun ?? '', xMun: m.xMun ?? '' })),
                    rntrc:    rodo.infANTT?.RNTRC ?? '',
                    placa:    veic.placa ?? '',
                    tpRod:    veic.tpRod ?? '01',
                    tpCar:    veic.tpCar ?? '00',
                    ufVeic:   veic.UF ?? 'RO',
                    condNome: cond.xNome ?? '',
                    condCpf:  cond.CPF ?? '',
                    vCarga:   String(tot.vCarga ?? ''),
                    qCarga:   String(tot.qCarga ?? ''),
                    cUnid:    tot.cUnid ?? '01',
                    infCpl:   inf.infAdic?.infCpl ?? '',
                })
                const cteList: CteSelecionado[] = []
                for (const mun of inf.infDoc?.infMunDescarga ?? []) {
                    for (const cte of mun.infCTe ?? []) {
                        cteList.push({ chave: cte.chCTe, cMunDescarga: mun.cMunDescarga, xMunDescarga: mun.xMunDescarga })
                    }
                }
                setCtesSelecionados(cteList)
            })
            .catch(() => toast.error('Não foi possível carregar o rascunho'))
    }, [])

    // Busca CT-es autorizados disponíveis
    useEffect(() => {
        fetch('/api/ctes?status=autorizado&take=100')
            .then(r => r.json())
            .then(j => setCtesDisponiveis(j.data ?? []))
            .catch(() => {})
    }, [])

    // ── Salvar rascunho ───────────────────────────────────────────────────────

    const handleSalvar = async () => {
        const vals = getValues()
        const payload = buildPayload(vals, nMDFe, empresa.serieMdfe ?? 1)
        const hdrs = { 'Content-Type': 'application/json' }
        try {
            if (draftId) {
                await fetch(`/api/mdfes/${draftId}`, { method: 'PUT', headers: hdrs, body: JSON.stringify({ infMDFe: payload.infMDFe, status: 'rascunho' }) })
            } else {
                const res = await fetch('/api/mdfes', { method: 'POST', headers: hdrs, body: JSON.stringify({ infMDFe: payload.infMDFe, status: 'rascunho' }) })
                const created = await res.json()
                if (created?.id) setDraftId(created.id)
            }
            toast.success('Rascunho salvo.')
        } catch { toast.error('Erro ao salvar rascunho.') }
    }

    // ── Build payload ─────────────────────────────────────────────────────────

    function buildPayload(vals: FormValues, nMDF: number, serie: number) {
        const dhIniViagem = vals.dtViagem
            ? `${vals.dtViagem}T${vals.hrSaida || '00:00'}:00-04:00`
            : undefined

        const builder = new MdfeBuilder(empresa)
            .buildIde({
                nMDF, serie,
                modal:   Number(vals.modal),
                tpEmit:  Number(vals.tpEmit),
                ufIni:   vals.ufIni,
                ufFim:   vals.ufFim,
                munCarrega: vals.munCarrega,
                percurso:   vals.percurso.map(p => p.uf).filter(Boolean),
                dhIniViagem,
            })
            .buildEmit()
            .buildRodo({ placa: vals.placa, tpRod: vals.tpRod, tpCar: vals.tpCar, uf: vals.ufVeic })
            .addCondutor({ xNome: vals.condNome, cpf: vals.condCpf })
            .addCtes(ctesSelecionados)
            .buildTot({ vCarga: Number(vals.vCarga), qCarga: Number(vals.qCarga), cUnid: vals.cUnid })
            .buildAdic(vals.infCpl)

        if (vals.rntrc) {
            const payload = builder.build()
            ;(payload.infMDFe as any).infModal.rodo.infANTT.RNTRC = vals.rntrc
            // persiste munDescarga para recuperação no rascunho
            ;(payload.infMDFe as any)._munDescarga = vals.munDescarga
            return payload
        }

        const payload = builder.build()
        ;(payload.infMDFe as any)._munDescarga = vals.munDescarga
        return payload
    }

    // ── Emitir ────────────────────────────────────────────────────────────────

    const onSubmit = async (vals: FormValues) => {
        if (ctesSelecionados.length === 0) {
            toast.error('Adicione pelo menos um CT-e ao MDF-e.')
            return
        }
        setStatus('loading')
        setErrMsg('')
        try {
            const cfgRes = await fetch('/api/empresa')
            const cfg    = cfgRes.ok ? await cfgRes.json() : empresa
            const nMDF   = cfg.sequenciaMdfe ?? nMDFe
            const serie  = cfg.serieMdfe     ?? empresa.serieMdfe ?? 1

            const payload = buildPayload(vals, nMDF, serie)
            const result  = await emitirMdfe(payload)

            const saveBody = {
                infMDFe: payload.infMDFe,
                status:  result?.status ?? 'desconhecido',
                idNuvem: result?.id     ?? null,
                chave:   result?.chave  ?? null,
            }

            if (draftId) {
                await fetch(`/api/mdfes/${draftId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(saveBody) })
            } else {
                const res = await fetch('/api/mdfes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(saveBody) })
                const created = await res.json()
                if (created?.id) setDraftId(created.id)
            }

            if (result?.status === 'autorizado') {
                setEmittedIdNuvem(result.id ?? null)
                setStatus('success')
                await fetch('/api/empresa', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sequenciaMdfe: nMDF + 1 }),
                })
                toast.success('MDF-e autorizado pela SEFAZ', {
                    description: `Nº ${result.numero ?? nMDF} · Protocolo ${result.autorizacao?.numero_protocolo ?? '—'}`,
                    duration: 8000,
                })
            } else if (result?.status === 'rejeitado') {
                const motivo = result.autorizacao?.motivo_status ?? 'Motivo não informado'
                setStatus('error')
                setErrMsg(motivo)
                toast.error(`MDF-e rejeitado (${result.autorizacao?.codigo_status ?? ''})`, { description: motivo, duration: 12000 })
                if (draftId) fetch(`/api/mdfes/${draftId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'erro', erroMsg: motivo }) }).catch(() => {})
            } else {
                setStatus('success')
                toast.info(`MDF-e criado — status: ${result?.status ?? 'desconhecido'}`, { duration: 8000 })
            }
        } catch (e: any) {
            const apiErr = e?.response?.data
            const msg = apiErr?.details?.error?.message ?? apiErr?.details?.message ?? apiErr?.error ?? e?.message ?? 'Erro ao emitir MDF-e.'
            setStatus('error')
            setErrMsg(msg)
            toast.error('Falha ao emitir MDF-e', { description: msg, duration: 10000 })
            if (draftId) fetch(`/api/mdfes/${draftId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'erro', erroMsg: msg }) }).catch(() => {})
        }
    }

    // ── CT-es ─────────────────────────────────────────────────────────────────

    const ctesVisiveis = ctesDisponiveis.filter(c => {
        if (!buscaCte) return true
        const q = buscaCte.toLowerCase()
        return (
            c.nomeRemetente?.toLowerCase().includes(q) ||
            c.nomeDestinatario?.toLowerCase().includes(q) ||
            String(c.nCT ?? '').includes(q) ||
            (c.chave ?? '').includes(q)
        )
    })

    function toggleCte(cte: any) {
        const chave = cte.chave ?? ''
        if (!chave) return toast.error('CT-e sem chave de acesso.')
        const exists = ctesSelecionados.some(c => c.chave === chave)
        if (exists) {
            setCtesSelecionados(prev => prev.filter(c => c.chave !== chave))
        } else {
            setCtesSelecionados(prev => [...prev, { chave, cMunDescarga: '', xMunDescarga: cte.nomeDestinatario ?? '' }])
            fetch(`/api/ctes/${cte.id}`).then(r => r.json()).then(full => {
                const dest  = full.infCte?.dest
                const ender = dest?.enderDest ?? {}
                setCtesSelecionados(prev => prev.map(c =>
                    c.chave === chave
                        ? { ...c, cMunDescarga: String(ender.cMun ?? ''), xMunDescarga: ender.xMun ?? dest?.xNome ?? '' }
                        : c
                ))
            }).catch(() => {})
        }
    }

    const tabError = {
        percurso: !!(errors.munCarrega),
        veiculo:  !!(errors.placa || errors.tpRod || errors.tpCar || errors.ufVeic || errors.condNome || errors.condCpf || errors.rntrc),
        totais:   !!(errors.vCarga || errors.qCarga),
    }

    return (
        <main className="min-h-screen bg-slate-50 text-slate-900">
            <header className="sticky top-0 z-10 bg-white border-b shadow-sm">
                <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-3">
                    <Link href="/mdfe" className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">F</div>
                        <span className="font-semibold text-slate-800">FreteCalc</span>
                    </Link>
                    <span className="text-slate-300">/</span>
                    <Link href="/mdfe" className="text-sm text-slate-500 hover:text-slate-700">MDF-e</Link>
                    <span className="text-slate-300">/</span>
                    <span className="text-sm text-slate-500">Emitir</span>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-8 space-y-5">
                <div>
                    <h1 className="text-2xl font-semibold">Emitir MDF-e</h1>
                    <p className="text-sm text-slate-500 mt-1">Manifesto Eletrônico de Documentos Fiscais</p>
                </div>

                {/* ── Dados Gerais ── */}
                <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dados Gerais</h2>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Controller name="modal" control={control} render={({ field }) => (
                            <SelectField label="Modal" value={field.value} onChange={field.onChange} options={MODAIS} />
                        )} />
                        <Field label="N° do MDF-e" value={String(nMDFe)} readOnly mono />
                        <Field label="Data de Emissão" value={todayStr()} readOnly />
                        <Controller name="tpEmit" control={control} render={({ field }) => (
                            <SelectField label="Tipo" value={field.value} onChange={field.onChange} options={TP_EMIT} />
                        )} />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Controller name="ufIni" control={control} render={({ field, fieldState }) => (
                            <UfSelect label="UF Carregamento" value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
                        )} />
                        <Controller name="ufFim" control={control} render={({ field, fieldState }) => (
                            <UfSelect label="UF Descarregamento" value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
                        )} />
                        <Controller name="dtViagem" control={control} render={({ field }) => (
                            <Field label="Data de Viagem" type="date" value={field.value ?? ''} onChange={field.onChange} />
                        )} />
                        <Controller name="hrSaida" control={control} render={({ field }) => (
                            <Field label="Hora de Saída" type="time" value={field.value ?? ''} onChange={field.onChange} />
                        )} />
                    </div>
                </div>

                <Tabs defaultValue="percurso">
                    <TabsList className="w-full justify-start">
                        <TabsTrigger value="percurso" className="relative">
                            Percurso {tabError.percurso && <ErrorDot />}
                        </TabsTrigger>
                        <TabsTrigger value="veiculo" className="relative">
                            Veículo / Condutor {tabError.veiculo && <ErrorDot />}
                        </TabsTrigger>
                        <TabsTrigger value="ctes">
                            CT-es {ctesSelecionados.length > 0 && (
                                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-100 text-sky-700 text-[10px] font-bold">{ctesSelecionados.length}</span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="totais" className="relative">
                            Totais {tabError.totais && <ErrorDot />}
                        </TabsTrigger>
                    </TabsList>

                    {/* ── Percurso ── */}
                    <TabsContent value="percurso">
                        <div className="mt-2 grid grid-cols-3 gap-4">

                            {/* Coluna 1: Cidades de Carregamento */}
                            <div className="bg-white rounded-2xl border shadow-sm flex flex-col">
                                <div className="px-5 py-3 border-b">
                                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cidades de Carregamento</h2>
                                </div>
                                <div className="p-4 flex flex-col gap-3 flex-1">
                                    {/* Autocomplete fixo para adicionar */}
                                    <MunAutocomplete
                                        uf={ufIni}
                                        value={{ cMun: '', xMun: '' }}
                                        onChange={v => { if (v.cMun) addMunCarrega(v) }}
                                        resetOnSelect
                                        error={errors.munCarrega?.message as string | undefined}
                                    />
                                    {/* Lista de itens adicionados */}
                                    <div className="space-y-1.5 min-h-[32px]">
                                        {munCarregaFields.length === 0 && (
                                            <p className="text-xs text-slate-400">Nenhuma cidade adicionada ainda.</p>
                                        )}
                                        {munCarregaFields.map((f, i) => {
                                            const val = (control._formValues.munCarrega?.[i] as any) ?? {}
                                            return (
                                                <div key={f.id} className="flex items-center justify-between bg-slate-50 border rounded-lg px-3 py-1.5">
                                                    <span className="text-sm truncate">{toTitleCase(val.xMun ?? '')}</span>
                                                    <button type="button" onClick={() => removeMunCarrega(i)}
                                                        className="text-xs text-red-400 hover:text-red-600 ml-2 shrink-0">×</button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Coluna 2: UFs de Percurso */}
                            <div className="bg-white rounded-2xl border shadow-sm flex flex-col">
                                <div className="px-5 py-3 border-b">
                                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">UFs de Percurso</h2>
                                </div>
                                <div className="p-4 flex flex-col gap-3 flex-1">
                                    {/* Select fixo para adicionar */}
                                    <select
                                        value=""
                                        onChange={e => { if (e.target.value) addPercurso({ uf: e.target.value }) }}
                                        className="h-8 w-full rounded-lg border border-slate-200 px-2 text-sm bg-white text-slate-500"
                                    >
                                        <option value="">Selecionar UF...</option>
                                        {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                    </select>
                                    {/* Lista */}
                                    <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                                        {percursoFields.length === 0 && (
                                            <p className="text-xs text-slate-400">Nenhuma UF adicionada ainda.</p>
                                        )}
                                        {percursoFields.map((f, i) => {
                                            const val = (control._formValues.percurso?.[i] as any) ?? {}
                                            return (
                                                <span key={f.id} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-1 rounded-full">
                                                    {val.uf}
                                                    <button type="button" onClick={() => removePercurso(i)}
                                                        className="text-slate-400 hover:text-red-500 leading-none">×</button>
                                                </span>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Coluna 3: Cidades de Descarregamento */}
                            <div className="bg-white rounded-2xl border shadow-sm flex flex-col">
                                <div className="px-5 py-3 border-b">
                                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cidades de Descarregamento</h2>
                                </div>
                                <div className="p-4 flex flex-col gap-3 flex-1">
                                    {/* Autocomplete fixo para adicionar */}
                                    <MunAutocomplete
                                        uf={ufFim}
                                        value={{ cMun: '', xMun: '' }}
                                        onChange={v => { if (v.cMun) addMunDescarga(v) }}
                                        resetOnSelect
                                    />
                                    {/* Lista de itens adicionados */}
                                    <div className="space-y-1.5 min-h-[32px]">
                                        {munDescargaFields.length === 0 && (
                                            <p className="text-xs text-slate-400">Nenhuma cidade adicionada ainda.</p>
                                        )}
                                        {munDescargaFields.map((f, i) => {
                                            const val = (control._formValues.munDescarga?.[i] as any) ?? {}
                                            return (
                                                <div key={f.id} className="flex items-center justify-between bg-slate-50 border rounded-lg px-3 py-1.5">
                                                    <span className="text-sm truncate">{toTitleCase(val.xMun ?? '')}</span>
                                                    <button type="button" onClick={() => removeMunDescarga(i)}
                                                        className="text-xs text-red-400 hover:text-red-600 ml-2 shrink-0">×</button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                        </div>
                    </TabsContent>

                    {/* ── Veículo / Condutor ── */}
                    <TabsContent value="veiculo">
                        <Card title="Informações ANTT / Veículo">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Controller name="rntrc" control={control} render={({ field, fieldState }) => (
                                    <Field label="RNTRC" error={fieldState.error?.message}
                                        value={field.value} onChange={v => field.onChange(maskRntrc(v))}
                                        placeholder="00000000" mono />
                                )} />
                                <Controller name="placa" control={control} render={({ field, fieldState }) => (
                                    <Field label="Placa do Veículo" error={fieldState.error?.message}
                                        value={field.value} onChange={v => field.onChange(maskPlaca(v))}
                                        placeholder="ABC1D23" mono />
                                )} />
                                <Controller name="tpRod" control={control} render={({ field, fieldState }) => (
                                    <SelectField label="Tipo de Rodado" value={field.value} onChange={field.onChange}
                                        options={TP_ROD} error={fieldState.error?.message} />
                                )} />
                                <Controller name="tpCar" control={control} render={({ field, fieldState }) => (
                                    <SelectField label="Tipo de Carroceria" value={field.value} onChange={field.onChange}
                                        options={TP_CAR} error={fieldState.error?.message} />
                                )} />
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Controller name="ufVeic" control={control} render={({ field, fieldState }) => (
                                    <UfSelect label="UF do Veículo" value={field.value} onChange={field.onChange}
                                        error={fieldState.error?.message} />
                                )} />
                                <Controller name="condNome" control={control} render={({ field, fieldState }) => (
                                    <Field label="Nome do Condutor" error={fieldState.error?.message}
                                        value={field.value} onChange={field.onChange} placeholder="Nome completo" />
                                )} />
                                <Controller name="condCpf" control={control} render={({ field, fieldState }) => (
                                    <Field label="CPF do Condutor" error={fieldState.error?.message}
                                        value={maskCpf(field.value)} onChange={v => field.onChange(v.replace(/\D/g, ''))}
                                        placeholder="000.000.000-00" mono />
                                )} />
                            </div>
                        </Card>
                    </TabsContent>

                    {/* ── CT-es ── */}
                    <TabsContent value="ctes">
                        <div className="mt-2 grid grid-cols-2 gap-4">
                            {/* Lista selecionados */}
                            <div className="bg-white rounded-2xl border shadow-sm">
                                <div className="px-5 py-3 border-b">
                                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        CT-es vinculados ({ctesSelecionados.length})
                                    </h2>
                                </div>
                                <div className="p-4 space-y-2">
                                    {ctesSelecionados.length === 0 && (
                                        <p className="text-sm text-slate-400 text-center py-10 border-2 border-dashed rounded-lg">
                                            Nenhum CT-e selecionado
                                        </p>
                                    )}
                                    {ctesSelecionados.map(cte => (
                                        <div key={cte.chave} className="flex items-center justify-between rounded-lg bg-slate-50 border px-3 py-2">
                                            <div>
                                                <p className="text-xs font-mono text-slate-700">{cte.chave}</p>
                                                <p className="text-xs text-slate-500">{cte.xMunDescarga || '—'}</p>
                                            </div>
                                            <button type="button" onClick={() => setCtesSelecionados(prev => prev.filter(c => c.chave !== cte.chave))}
                                                className="text-red-400 hover:text-red-600 text-xs ml-4">Remover</button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Busca */}
                            <div className="bg-white rounded-2xl border shadow-sm">
                                <div className="px-5 py-3 border-b">
                                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Buscar CT-es autorizados</h2>
                                </div>
                                <div className="p-4 space-y-3">
                                    <Input
                                        placeholder="Remetente, destinatário, nº ou chave..."
                                        value={buscaCte} onChange={e => setBuscaCte(e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                    <div className="max-h-80 overflow-y-auto space-y-1.5 border rounded-lg p-2">
                                        {ctesVisiveis.length === 0 && (
                                            <p className="text-xs text-slate-400 text-center py-4">Nenhum CT-e autorizado encontrado.</p>
                                        )}
                                        {ctesVisiveis.map(cte => {
                                            const selected = ctesSelecionados.some(c => c.chave === cte.chave)
                                            return (
                                                <button key={cte.id} type="button" onClick={() => toggleCte(cte)}
                                                    className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors border ${selected ? 'bg-sky-50 border-sky-200' : 'hover:bg-slate-50 border-transparent'}`}>
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium">{cte.nomeRemetente ?? '—'} → {cte.nomeDestinatario ?? '—'}</span>
                                                        <span className="text-xs text-slate-400">Nº {cte.nCT ?? '—'}</span>
                                                    </div>
                                                    <span className="text-xs font-mono text-slate-400">{cte.chave ?? 'sem chave'}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* ── Totais / Observação ── */}
                    <TabsContent value="totais">
                        <Card title="Totais da Carga">
                            <div className="grid grid-cols-3 gap-4">
                                <Controller name="vCarga" control={control} render={({ field, fieldState }) => (
                                    <CurrencyInput label="Valor da Carga" value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
                                )} />
                                <Controller name="qCarga" control={control} render={({ field, fieldState }) => (
                                    <Field label="Quantidade" error={fieldState.error?.message}
                                        value={field.value} onChange={v => field.onChange(v.replace(/[^\d.,]/g, ''))}
                                        placeholder="0,000" mono />
                                )} />
                                <Controller name="cUnid" control={control} render={({ field }) => (
                                    <SelectField label="Unidade" value={field.value} onChange={field.onChange}
                                        options={[{ value: '01', label: 'KG' }, { value: '02', label: 'TON' }]} />
                                )} />
                            </div>
                        </Card>

                        <Card title="Observações">
                            <Controller name="infCpl" control={control} render={({ field }) => (
                                <div>
                                    <Label className="text-xs text-slate-600">Informações complementares</Label>
                                    <textarea value={field.value} onChange={e => field.onChange(e.target.value)}
                                        rows={4} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-sky-500" />
                                </div>
                            )} />
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Erro */}
                {status === 'error' && errMsg && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                        <b>Rejeição SEFAZ:</b> {errMsg}
                    </div>
                )}

                {/* Ações */}
                <div className="flex gap-3 pb-8 flex-wrap">
                    {status !== 'success' && (
                        <Button onClick={handleSubmit(onSubmit)} disabled={status === 'loading'} className="gap-2">
                            {status === 'loading' && (
                                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                            )}
                            {status === 'loading' ? 'Emitindo...' : 'Emitir MDF-e'}
                        </Button>
                    )}
                    {status === 'success' && emittedIdNuvem && (
                        <Button onClick={async () => {
                            try { await imprimirMdfe(emittedIdNuvem) }
                            catch (e: any) { toast.error(e?.message ?? 'Erro ao imprimir') }
                        }} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                            Imprimir DAMDFE
                        </Button>
                    )}
                    <Button variant="outline" onClick={handleSalvar} disabled={status === 'loading' || status === 'success'}>
                        Salvar rascunho
                    </Button>
                    <Link href="/mdfe"><Button variant="ghost">Cancelar</Button></Link>
                </div>
            </div>
        </main>
    )
}
