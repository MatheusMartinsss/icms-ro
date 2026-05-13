'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Search, PenLine } from 'lucide-react'
import { useEmpresaConfig } from '@/components/configuracoes-empresa'
import { MdfeBuilder, type CteSelecionado, type SegCarga, type InfPag } from '@/lib/mdfe/builder'
import { emitirMdfe, imprimirMdfe } from '@/services/mdfe'
import { Navbar } from '@/components/navbar'

// ─── Schema ───────────────────────────────────────────────────────────────────

const munItem  = z.object({ cMun: z.string().min(1, 'Selecione um município'), xMun: z.string().min(1, 'Nome obrigatório') })
const ufItem   = z.object({ uf: z.string().min(2) })

const propItem = z.object({
    cpfCnpj: z.enum(['cpf', 'cnpj']),
    cpf:     z.string().optional(),
    cnpj:    z.string().optional(),
    rntrc:   z.string().min(1, 'Obrigatório'),
    xNome:   z.string().min(2, 'Obrigatório'),
    ie:      z.string().optional(),
    uf:      z.string().optional(),
    tpProp:  z.string().min(1, 'Obrigatório'),
})

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
    // Veículo de tração
    rntrc:    z.string().refine(v => !v || /^([0-9]{8}|ISENTO)$/.test(v), '8 dígitos ou ISENTO'),
    placa:    z.string().min(7, 'Placa inválida'),
    renavam:  z.string().optional(),
    tara:     z.string().min(1, 'Obrigatório'),
    capKG:    z.string().optional(),
    capM3:    z.string().optional(),
    tpRod:    z.string().min(1, 'Obrigatório'),
    tpCar:    z.string().min(1, 'Obrigatório'),
    ufVeic:   z.string().min(2, 'Obrigatório'),
    prop:     propItem.optional(),
    condNome: z.string().min(2, 'Obrigatório'),
    condCpf:  z.string().min(11, 'CPF inválido'),
    // Reboques (máx 3)
    veicReboque: z.array(z.object({
        placa:   z.string().min(7, 'Placa inválida'),
        renavam: z.string().optional(),
        tara:    z.string().min(1, 'Obrigatório'),
        capKG:   z.string().optional(),
        capM3:   z.string().optional(),
        tpCar:   z.string().min(1, 'Obrigatório'),
        ufVeic:  z.string().optional(),
        prop:    propItem.optional(),
    })).max(3),
    // Produto predominante (modal rodoviário)
    tpCarga:      z.string().min(1, 'Obrigatório'),
    xProd:        z.string().min(2, 'Obrigatório'),
    prodNCM:      z.string().refine(v => !v || /^\d{8}$/.test(v), 'NCM deve ter 8 dígitos').optional(),
    cepCarrega:   z.string().optional(),
    cepDescarrega: z.string().optional(),
    // Pagamento do Frete
    infPag: z.array(z.object({
        xNome:     z.string().min(2, 'Obrigatório'),
        doc:       z.string().refine(v => !v || [11, 14].includes(v.replace(/\D/g, '').length), 'CPF (11) ou CNPJ (14 dígitos)').optional(),
        chPix:     z.string().optional(),
        indPag:    z.enum(['0', '1']),
        tpComp:    z.enum(['01', '02', '03', '99']),
        vContrato: z.string(),
    })),
    // Contratante do Serviço
    contCNPJ: z.string().refine(v => v.replace(/\D/g,'').length === 14, 'CNPJ inválido'),
    contNome: z.string().optional(),
    // Totais
    vCarga: z.string().refine(v => Number(v) > 0, 'Obrigatório'),
    qCarga: z.string().min(1, 'Obrigatório'),
    cUnid:  z.enum(['01', '02']),
    infCpl: z.string(),
    // Seguro da Carga
    segRespSeg:   z.enum(['1', '2']),
    segCNPJResp:  z.string().refine(v => v.replace(/\D/g,'').length === 14, 'CNPJ inválido'),
    segXSeg:      z.string().min(2, 'Nome da seguradora obrigatório').max(30, 'Máximo 30 caracteres'),
    segCNPJSeg:   z.string().refine(v => v.replace(/\D/g,'').length === 14, 'CNPJ inválido'),
    segNApol:     z.string().optional(),
    segNAver:     z.string().optional(),
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

const TP_PROP = [
    { value: '0', label: 'TAC Agregado' },
    { value: '1', label: 'TAC Independente' },
    { value: '2', label: 'Outros' },
]

const TP_RESP_SEG = [
    { value: '1', label: 'Emitente' },
    { value: '2', label: 'Contratante do Serviço' },
]

const TP_CARGA = [
    { value: '01', label: 'Granel sólido' },
    { value: '02', label: 'Granel líquido' },
    { value: '03', label: 'Frigorificado' },
    { value: '04', label: 'Conteinerizada' },
    { value: '05', label: 'Carga Geral' },
    { value: '06', label: 'Neogranel' },
    { value: '07', label: 'Perigosa (granel sólido)' },
    { value: '08', label: 'Perigosa (granel líquido)' },
    { value: '09', label: 'Perigosa (frigorificada)' },
    { value: '10', label: 'Perigosa (conteinerizada)' },
    { value: '11', label: 'Perigosa (carga geral)' },
]

function defaultProp() {
    return { cpfCnpj: 'cpf' as const, cpf: '', cnpj: '', rntrc: '', xNome: '', ie: '', uf: '', tpProp: '0' }
}

function todayStr() { return new Date().toISOString().slice(0, 10) }

function defaultValues(): FormValues {
    return {
        modal: '1', tpEmit: '1',
        ufIni: 'RO', ufFim: 'RO',
        dtViagem: todayStr(), hrSaida: '',
        munCarrega:  [],
        percurso:    [],
        munDescarga: [],
        rntrc: '', placa: '', renavam: '', tara: '', capKG: '', capM3: '',
        tpRod: '01', tpCar: '00', ufVeic: 'RO', prop: undefined,
        condNome: '', condCpf: '',
        veicReboque: [],
        infPag: [] as any[],
        contCNPJ: '', contNome: '',
        tpCarga: '05', xProd: '', prodNCM: '', cepCarrega: '', cepDescarrega: '',
        vCarga: '', qCarga: '', cUnid: '01',
        infCpl: '',
        segRespSeg: '1', segCNPJResp: '', segXSeg: '', segCNPJSeg: '', segNApol: '0000', segNAver: '0000',
    }
}

function maskCpf(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 3) return d
    if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
    if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}
function maskCnpj(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 14)
    if (d.length <= 2) return d
    if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`
    if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
    if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}
function maskPlaca(v: string) { return v.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 7) }
function maskRntrc(v: string) {
    const up = v.toUpperCase()
    if (!up || /^[0-9]/.test(up)) return up.replace(/\D/g, '').slice(0, 8)
    return up.replace(/[^A-Z]/g, '').slice(0, 6)
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

type Status = 'idle' | 'loading' | 'success' | 'error'

function Card({ title, children, className, action }: { title: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
    return (
        <div className={`bg-white rounded-2xl border shadow-sm mt-2 ${className ?? ''}`}>
            <div className="px-5 py-3 border-b flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</h2>
                {action}
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

// ─── MotoristaSearch ──────────────────────────────────────────────────────────

interface Motorista { id: string; xNome: string; cpf: string | null }

function MotoristaSearch({ onSelect }: { onSelect: (m: Motorista) => void }) {
    const [query, setQuery]       = useState('')
    const [results, setResults]   = useState<Motorista[]>([])
    const [open, setOpen]         = useState(false)
    const [loading, setLoading]   = useState(false)
    const timerRef                = useRef<ReturnType<typeof setTimeout> | null>(null)
    const justPicked              = useRef(false)

    useEffect(() => {
        if (justPicked.current) return
        if (!query.trim()) { setResults([]); return }
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(async () => {
            setLoading(true)
            try {
                const res  = await fetch(`/api/parceiros?q=${encodeURIComponent(query)}`)
                const data = await res.json()
                setResults((data as Motorista[]).filter(p => p.cpf))
            } finally { setLoading(false) }
        }, 300)
    }, [query])

    function handleSelect(m: Motorista) {
        justPicked.current = true
        onSelect(m)
        setQuery('')
        setResults([])
        setOpen(false)
    }

    return (
        <div className="relative">
            <Input
                value={query}
                onChange={e => { justPicked.current = false; setQuery(e.target.value); setOpen(true) }}
                onFocus={() => { if (!justPicked.current) setOpen(true) }}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                placeholder="Buscar motorista por nome ou CPF..."
                className="h-8 text-sm"
            />
            {open && (results.length > 0 || loading) && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {loading && <p className="px-3 py-2 text-xs text-slate-400">Buscando...</p>}
                    {!loading && results.map(m => (
                        <button key={m.id} type="button" onMouseDown={() => handleSelect(m)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between gap-2">
                            <span className="font-medium">{m.xNome}</span>
                            <span className="text-xs text-slate-400 font-mono shrink-0">
                                {m.cpf ? m.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '—'}
                            </span>
                        </button>
                    ))}
                    {!loading && results.length === 0 && query.trim() && (
                        <p className="px-3 py-2 text-xs text-slate-400">Nenhum motorista encontrado.</p>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── VeiculoRecord + PlacaInput ───────────────────────────────────────────────

interface VeiculoRecord {
    id: string; placa: string; tpRod: string; tpCar: string
    tara: number; capKG: number | null; capM3: number | null
    uf: string | null; renavam: string | null; rntrc: string | null
    proprietarioId: string | null
    proprietario: ProprietarioRecord | null
}

function PlacaInput({ value, onChange, onSelect, error }: {
    value: string
    onChange: (v: string) => void
    onSelect: (v: VeiculoRecord) => void
    error?: string
}) {
    const [results, setResults] = useState<VeiculoRecord[]>([])
    const [open, setOpen]       = useState(false)
    const [loading, setLoading] = useState(false)
    const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
    const justPicked  = useRef(false)   // true após selecionar — impede reabrir o dropdown

    useEffect(() => {
        if (justPicked.current) return
        const q = value.replace(/[^A-Z0-9]/gi, '')
        if (q.length < 2) { setResults([]); setOpen(false); return }
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(async () => {
            setLoading(true)
            try {
                const res  = await fetch(`/api/veiculos?q=${encodeURIComponent(q)}`)
                const data = await res.json()
                setResults(Array.isArray(data) ? data : [])
                setOpen(true)
            } finally { setLoading(false) }
        }, 300)
    }, [value])

    return (
        <div className="relative">
            <Label className="text-xs text-slate-600">Placa *</Label>
            <div className="relative mt-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <Input
                    value={value}
                    onChange={e => {
                        justPicked.current = false
                        onChange(maskPlaca(e.target.value))
                    }}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    onFocus={() => { if (!justPicked.current && results.length > 0) setOpen(true) }}
                    placeholder="ABC1D23"
                    className={`pl-8 h-8 font-mono text-sm uppercase ${error ? 'border-red-500' : ''}`}
                />
            </div>
            {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
            {open && (results.length > 0 || loading) && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {loading && <p className="px-3 py-2 text-xs text-slate-400">Buscando...</p>}
                    {!loading && results.map(v => (
                        <button key={v.id} type="button" onMouseDown={() => {
                            justPicked.current = true
                            onSelect(v)
                            setOpen(false)
                        }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between gap-2">
                            <span className="font-mono font-semibold">{v.placa}</span>
                            <span className="text-xs text-slate-400">
                                {TP_ROD.find(r => r.value === v.tpRod)?.label ?? v.tpRod} · {v.tara} kg
                                {v.proprietario ? ` · ${v.proprietario.xNome}` : ''}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── VeiculoDetalheModal ──────────────────────────────────────────────────────

const TP_OWNER = [
    { value: 'proprio',   label: 'Próprio' },
    { value: 'terceiro',  label: 'Terceiro' },
]

function VeiculoDetalheModal({ open, onClose, isTracao, fieldPrefix, control, errors: _errors, setValue, getValues, watch, showProp, setShowProp, propId, onPropId }: {
    open: boolean
    onClose: () => void
    isTracao: boolean
    fieldPrefix: string
    control: any; errors: any; setValue: any; getValues: any; watch: any
    showProp: boolean
    setShowProp: (v: boolean) => void
    propId: string | null
    onPropId: (id: string | null) => void
}) {
    const f          = (name: string) => (fieldPrefix ? `${fieldPrefix}.${name}` : name) as any
    const propPrefix = (fieldPrefix ? `${fieldPrefix}.prop` : 'prop') as any

    const [tpOwner,  setTpOwner]  = useState<string>('proprio')
    const [propMode, setPropMode] = useState<'buscar' | 'cadastrar'>('buscar')
    const [propForm, setPropForm] = useState(defaultProp)

    useEffect(() => {
        if (!open) return
        const owned = showProp ? 'terceiro' : 'proprio'
        setTpOwner(owned)
        if (owned === 'terceiro') {
            const existing = getValues(propPrefix)
            if (existing?.xNome) {
                setPropForm({ cpfCnpj: existing.cpfCnpj ?? 'cpf', cpf: existing.cpf ?? '', cnpj: existing.cnpj ?? '', rntrc: existing.rntrc ?? '', xNome: existing.xNome ?? '', ie: existing.ie ?? '', uf: existing.uf ?? '', tpProp: existing.tpProp ?? '0' })
                setPropMode('cadastrar')
            } else {
                setPropForm(defaultProp()); setPropMode('buscar')
            }
        } else {
            setPropForm(defaultProp()); setPropMode('buscar')
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    function setProp(patch: Partial<ReturnType<typeof defaultProp>>) {
        setPropForm(prev => ({ ...prev, ...patch }))
    }

    function handleOwnerChange(val: string) {
        setTpOwner(val)
        if (val === 'proprio') {
            setShowProp(false); setValue(propPrefix, undefined); onPropId(null); setPropForm(defaultProp())
        } else {
            setShowProp(true)
        }
    }

    async function handleSaveAll() {
        const vals = getValues()

        // 1. Salva/atualiza proprietário (se terceiro)
        let resolvedPropId = propId
        if (tpOwner === 'terceiro') {
            if (!propForm.xNome || !propForm.rntrc) {
                toast.error('Preencha Nome e RNTRC do proprietário.')
                return
            }
            try {
                const res  = await fetch('/api/proprietarios', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        xNome:  propForm.xNome,   rntrc:  propForm.rntrc,
                        tpProp: Number(propForm.tpProp ?? '0'),
                        cpf:    propForm.cpfCnpj === 'cpf'  ? (propForm.cpf  || null) : null,
                        cnpj:   propForm.cpfCnpj === 'cnpj' ? (propForm.cnpj || null) : null,
                        ie:     propForm.ie  || null,
                        uf:     propForm.uf  || null,
                    }),
                })
                const saved = await res.json()
                resolvedPropId = saved.id ?? null
                onPropId(resolvedPropId)
                // Sync para o form principal (XML builder)
                setValue(propPrefix, { ...propForm })
            } catch { toast.error('Erro ao salvar proprietário.'); return }
        }

        // 2. Salva veículo vinculado ao proprietário
        const base = isTracao ? {
            placa:   vals.placa,       renavam: vals.renavam || null,
            tara:    Number(vals.tara) || 0,
            capKG:   vals.capKG        ? Number(vals.capKG) : null,
            capM3:   vals.capM3        ? Number(vals.capM3) : null,
            tpRod:   vals.tpRod,       tpCar:   vals.tpCar,
            uf:      vals.ufVeic,      proprietarioId: resolvedPropId,
        } : (() => {
            const idx = Number(fieldPrefix.split('.')[1])
            const r   = vals.veicReboque[idx]
            return {
                placa:   r.placa,       renavam: r.renavam || null,
                tara:    Number(r.tara) || 0,
                capKG:   r.capKG        ? Number(r.capKG) : null,
                capM3:   r.capM3        ? Number(r.capM3) : null,
                tpCar:   r.tpCar,       uf:      r.ufVeic || null,
                proprietarioId: resolvedPropId,
            }
        })()
        try {
            await fetch('/api/veiculos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(base) })
            toast.success('Veículo salvo no cadastro.')
            onClose()
        } catch { toast.error('Erro ao salvar veículo.') }
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isTracao ? 'Veículo de Tração' : 'Reboque'} — Cadastro</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-1">

                    {/* Linha 0 — placa + tara */}
                    <div className="grid grid-cols-2 gap-4">
                        <Controller name={f('placa')} control={control} render={({ field, fieldState }) => (
                            <Field label="Placa *" error={fieldState.error?.message}
                                value={field.value ?? ''} onChange={v => field.onChange(maskPlaca(v))}
                                placeholder="ABC1D23" mono />
                        )} />
                        <Controller name={f('tara')} control={control} render={({ field, fieldState }) => (
                            <Field label="Tara (KG) *" error={fieldState.error?.message}
                                value={field.value ?? ''} onChange={v => field.onChange(v.replace(/\D/g, ''))} placeholder="0" mono />
                        )} />
                    </div>

                    {/* Linha 1 — identificação */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Controller name={f('renavam')} control={control} render={({ field }) => (
                            <Field label="RENAVAM" value={field.value ?? ''} onChange={v => field.onChange(v.replace(/\D/g, '').slice(0, 11))} placeholder="00000000000" mono />
                        )} />
                        <Controller name={f('ufVeic')} control={control} render={({ field, fieldState }) => (
                            <UfSelect label="UF Licenciamento" value={field.value ?? ''} onChange={field.onChange} error={fieldState.error?.message} />
                        )} />
                        <Controller name={f('capKG')} control={control} render={({ field }) => (
                            <Field label="Cap. KG" value={field.value ?? ''} onChange={v => field.onChange(v.replace(/\D/g, ''))} placeholder="0" mono />
                        )} />
                        <Controller name={f('capM3')} control={control} render={({ field }) => (
                            <Field label="Cap. M³" value={field.value ?? ''} onChange={v => field.onChange(v.replace(/\D/g, ''))} placeholder="0" mono />
                        )} />
                    </div>

                    {/* Linha 2 — tipo + proprietário */}
                    <div className={`grid gap-4 ${isTracao ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'}`}>
                        {isTracao && (
                            <Controller name={f('tpRod')} control={control} render={({ field, fieldState }) => (
                                <SelectField label="Tipo de Rodado" value={field.value} onChange={field.onChange} options={TP_ROD} error={fieldState.error?.message} />
                            )} />
                        )}
                        <Controller name={f('tpCar')} control={control} render={({ field, fieldState }) => (
                            <SelectField label="Tipo de Carroceria" value={field.value} onChange={field.onChange} options={TP_CAR} error={fieldState.error?.message} />
                        )} />
                        <div>
                            <Label className="text-xs text-slate-600">Tipo de Proprietário</Label>
                            <select value={tpOwner} onChange={e => handleOwnerChange(e.target.value)}
                                className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 text-sm bg-white">
                                {TP_OWNER.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Proprietário (quando terceiro) — estado local, separado do form principal */}
                    {tpOwner !== 'proprio' && (
                        <div className="border rounded-xl p-4 space-y-4">
                            {/* Toggle buscar / cadastrar */}
                            <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
                                {(['buscar', 'cadastrar'] as const).map(mode => (
                                    <button key={mode} type="button"
                                        onClick={() => { setPropMode(mode); if (mode === 'cadastrar' && propMode === 'buscar') { setPropForm(defaultProp()); onPropId(null) } }}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${propMode === mode ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                                        {mode === 'buscar' ? 'Buscar cadastro' : 'Novo proprietário'}
                                    </button>
                                ))}
                            </div>

                            {propMode === 'buscar' ? (
                                /* ── Modo busca ── */
                                <ProprietarioInput
                                    value={propForm.xNome}
                                    onChange={v => setProp({ xNome: v })}
                                    onSelect={p => {
                                        onPropId(p.id)
                                        setPropForm({ cpfCnpj: p.cpf ? 'cpf' : 'cnpj', cpf: p.cpf ?? '', cnpj: p.cnpj ?? '', rntrc: p.rntrc, xNome: p.xNome, ie: p.ie ?? '', uf: p.uf ?? '', tpProp: String(p.tpProp) })
                                        setPropMode('cadastrar')
                                    }}
                                />
                            ) : (
                                /* ── Modo cadastro ── */
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Nome / Razão Social *" value={propForm.xNome} onChange={v => setProp({ xNome: v })} placeholder="Nome do proprietário" />
                                        <SelectField label="Tipo de Proprietário" value={propForm.tpProp} onChange={v => setProp({ tpProp: v })} options={TP_PROP} />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex gap-4">
                                            {(['cpf', 'cnpj'] as const).map(t => (
                                                <label key={t} className="flex items-center gap-1.5 text-xs cursor-pointer">
                                                    <input type="radio" value={t} checked={propForm.cpfCnpj === t} onChange={() => setProp({ cpfCnpj: t })} className="accent-sky-600" />
                                                    {t.toUpperCase()}
                                                </label>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            {propForm.cpfCnpj === 'cpf'
                                                ? <Field label="CPF" value={maskCpf(propForm.cpf)} onChange={v => setProp({ cpf: v.replace(/\D/g, '').slice(0, 11) })} placeholder="000.000.000-00" mono />
                                                : <Field label="CNPJ" value={maskCnpj(propForm.cnpj)} onChange={v => setProp({ cnpj: v.replace(/\D/g, '').slice(0, 14) })} placeholder="00.000.000/0001-00" mono />
                                            }
                                            <Field label="RNTRC *" value={maskRntrc(propForm.rntrc)} onChange={v => setProp({ rntrc: maskRntrc(v) })} placeholder="00000000" mono />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="IE" value={propForm.ie} onChange={v => setProp({ ie: v })} placeholder="Inscrição Estadual" mono />
                                        <UfSelect label="UF" value={propForm.uf} onChange={v => setProp({ uf: v })} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2 border-t">
                        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">Fechar</button>
                        <button type="button" onClick={handleSaveAll}
                            className="text-sm font-semibold bg-sky-600 hover:bg-sky-700 text-white px-4 py-1.5 rounded-lg transition-colors">
                            Salvar
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// ─── ProprietarioRecord + ProprietarioInput ───────────────────────────────────

interface ProprietarioRecord {
    id: string; xNome: string; cpf: string | null; cnpj: string | null
    rntrc: string; ie: string | null; uf: string | null; tpProp: number
}

function ProprietarioInput({ value, onChange, onSelect, error }: {
    value: string
    onChange: (v: string) => void
    onSelect: (p: ProprietarioRecord) => void
    error?: string
}) {
    const [results, setResults] = useState<ProprietarioRecord[]>([])
    const [open, setOpen]       = useState(false)
    const [loading, setLoading] = useState(false)
    const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
    const justPicked = useRef(false)

    useEffect(() => {
        if (justPicked.current) return
        if (!value.trim() || value.length < 2) { setResults([]); setOpen(false); return }
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(async () => {
            setLoading(true)
            try {
                const res  = await fetch(`/api/proprietarios?q=${encodeURIComponent(value)}`)
                const data = await res.json()
                setResults(Array.isArray(data) ? data : [])
                setOpen(true)
            } finally { setLoading(false) }
        }, 300)
    }, [value])

    return (
        <div className="relative">
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <Input
                    value={value}
                    onChange={e => {
                        justPicked.current = false
                        onChange(e.target.value)
                    }}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    onFocus={() => { if (!justPicked.current && results.length > 0) setOpen(true) }}
                    placeholder="Buscar por nome, CPF ou CNPJ..."
                    className={`pl-8 h-8 text-sm ${error ? 'border-red-500' : ''}`}
                />
            </div>
            {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
            {open && (results.length > 0 || loading) && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {loading && <p className="px-3 py-2 text-xs text-slate-400">Buscando...</p>}
                    {!loading && results.map(p => (
                        <button key={p.id} type="button" onMouseDown={() => { justPicked.current = true; onSelect(p); setOpen(false) }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between gap-2">
                            <span className="font-medium truncate">{p.xNome}</span>
                            <span className="text-xs text-slate-400 font-mono shrink-0">
                                {p.cpf ? p.cpf : p.cnpj ?? '—'} · RNTRC: {p.rntrc}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function EmitirMdfePage() {
    const searchParams = useSearchParams()
    const { config: empresa } = useEmpresaConfig()

    const [draftId, setDraftId]               = useState<string | null>(null)
    const [loadedStatus, setLoadedStatus]     = useState<string | null>(null)
    const [nMDFe, setNMDFe]                   = useState<number>(1)
    const [status, setStatus]                 = useState<Status>('idle')
    const [errMsg, setErrMsg]                 = useState('')
    const [emittedIdNuvem, setEmittedIdNuvem] = useState<string | null>(null)
    const [ctesSelecionados, setCtesSelecionados] = useState<CteSelecionado[]>([])
    const [cteDataMap, setCteDataMap]             = useState<Record<string, { cMunCarrega: string; xMunCarrega: string; cMunDescarga: string; xMunDescarga: string; peso: number; valor: number }>>({})
    const [ctesDisponiveis, setCtesDisponiveis]   = useState<any[]>([])
    const [buscaCte, setBuscaCte]             = useState('')
    const [showPropTracao, setShowPropTracao]       = useState(false)
    const [showPropReboques, setShowPropReboques]   = useState<boolean[]>([])
    const [propIdTracao, setPropIdTracao]           = useState<string | null>(null)
    const [propIdReboques, setPropIdReboques]       = useState<(string | null)[]>([])
    const [modalTracao, setModalTracao]             = useState(false)
    const [modalReboqueIdx, setModalReboqueIdx]     = useState<number | null>(null)

    const { control, handleSubmit, setValue, getValues, reset, watch,
        formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: defaultValues(),
    })

    const { fields: munCarregaFields,   append: addMunCarrega,   remove: removeMunCarrega   } = useFieldArray({ control, name: 'munCarrega' })
    const { fields: percursoFields,     append: addPercurso,     remove: removePercurso     } = useFieldArray({ control, name: 'percurso' })
    const { fields: munDescargaFields,  append: addMunDescarga,  remove: removeMunDescarga  } = useFieldArray({ control, name: 'munDescarga' })
    const { fields: reboqueFields,      append: addReboque,      remove: removeReboque      } = useFieldArray({ control, name: 'veicReboque' })
    const { fields: pagFields,          append: addPagItem,      remove: removePagItem      } = useFieldArray({ control, name: 'infPag' })

    const ufIni = watch('ufIni')
    const ufFim = watch('ufFim')

    // Pré-preenche com dados da empresa
    useEffect(() => {
        if (empresa.rntrc)        setValue('rntrc', empresa.rntrc)
        if (empresa.ufEnv)        setValue('ufIni', empresa.ufEnv)
        if (empresa.sequenciaMdfe) setNMDFe(empresa.sequenciaMdfe)
        if (empresa.cnpj) {
            setValue('segCNPJResp', empresa.cnpj.replace(/\D/g, ''))
            setValue('segCNPJSeg',  empresa.cnpj.replace(/\D/g, ''))
            setValue('contCNPJ',    empresa.cnpj.replace(/\D/g, ''))
        }
        if (empresa.razaoSocial) {
            setValue('segXSeg',  empresa.razaoSocial.toUpperCase().slice(0, 30))
            setValue('contNome', empresa.razaoSocial)
        }
    }, [empresa.rntrc, empresa.ufEnv, empresa.sequenciaMdfe, empresa.cnpj, empresa.razaoSocial])

    // Carrega rascunho via ?id=
    useEffect(() => {
        const id = searchParams.get('id')
        if (!id) return
        setDraftId(id)
        fetch(`/api/mdfes/${id}`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then((mdfe: any) => {
                if (mdfe.status) setLoadedStatus(mdfe.status)
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
                    infPag: (() => {
                        const raw = rodo.infPag ?? []
                        const list = Array.isArray(raw) ? raw : [raw]
                        return list.map((p: any) => ({
                            xNome:     p.xNome ?? '',
                            doc:       (p.cnpj ?? p.CNPJ ?? p.cpf ?? p.CPF ?? '').replace(/\D/g, ''),
                            chPix:     p.infBanc?.PIX ?? '',
                            indPag:    p.indPag ?? '0',
                            tpComp:    p.comp?.[0]?.tpComp ?? '99',
                            vContrato: String(p.vContrato ?? ''),
                        }))
                    })(),
                    contCNPJ: ((rodo.infANTT?.infContratante?.[0]?.cnpj ?? rodo.infANTT?.infContratante?.[0]?.CNPJ ?? '')).replace(/\D/g, ''),
                    contNome: rodo.infANTT?.infContratante?.[0]?.xNome ?? '',
                    rntrc:    rodo.infANTT?.RNTRC ?? '',
                    placa:    veic.placa ?? '',
                    renavam:  veic.RENAVAM ?? '',
                    tara:     String(veic.tara ?? ''),
                    capKG:    String(veic.capKG ?? ''),
                    capM3:    String(veic.capM3 ?? ''),
                    tpRod:    veic.tpRod ?? '01',
                    tpCar:    veic.tpCar ?? '00',
                    ufVeic:   veic.UF ?? 'RO',
                    prop: veic.prop ? {
                        cpfCnpj: veic.prop.CPF ? 'cpf' as const : 'cnpj' as const,
                        cpf:    veic.prop.CPF  ?? '',
                        cnpj:   veic.prop.CNPJ ?? '',
                        rntrc:  veic.prop.RNTRC ?? '',
                        xNome:  veic.prop.xNome ?? '',
                        ie:     veic.prop.IE ?? '',
                        uf:     veic.prop.UF ?? '',
                        tpProp: String(veic.prop.tpProp ?? '0'),
                    } : undefined,
                    condNome: cond.xNome ?? '',
                    condCpf:  cond.CPF ?? '',
                    veicReboque: (rodo.veicReboque ?? []).map((r: any) => ({
                        placa:   r.placa ?? '',
                        renavam: r.RENAVAM ?? '',
                        tara:    String(r.tara ?? ''),
                        capKG:   String(r.capKG ?? ''),
                        capM3:   String(r.capM3 ?? ''),
                        tpCar:   r.tpCar ?? '00',
                        ufVeic:  r.UF ?? '',
                        prop:    r.prop ? {
                            cpfCnpj: r.prop.CPF ? 'cpf' as const : 'cnpj' as const,
                            cpf:    r.prop.CPF  ?? '',
                            cnpj:   r.prop.CNPJ ?? '',
                            rntrc:  r.prop.RNTRC ?? '',
                            xNome:  r.prop.xNome ?? '',
                            ie:     r.prop.IE ?? '',
                            uf:     r.prop.UF ?? '',
                            tpProp: String(r.prop.tpProp ?? '0'),
                        } : undefined,
                    })),
                    tpCarga:      inf.infModal?.rodo?.prodPred?.tpCarga ?? '06',
                    xProd:        inf.infModal?.rodo?.prodPred?.xProd   ?? '',
                    prodNCM:      inf.infModal?.rodo?.prodPred?.NCM      ?? '',
                    cepCarrega:   inf.infModal?.rodo?.prodPred?.infLotacao?.cepCarrega    ?? '',
                    cepDescarrega: inf.infModal?.rodo?.prodPred?.infLotacao?.cepDescarrega ?? '',
                    vCarga:   String(tot.vCarga ?? ''),
                    qCarga:   String(tot.qCarga ?? ''),
                    cUnid:    tot.cUnid ?? '01',
                    infCpl:   inf.infAdic?.infCpl ?? '',
                    segRespSeg:  (inf.seg?.respSeg ?? '1') as '1' | '2',
                    segCNPJResp: (inf.seg?.cnpj ?? inf.seg?.CNPJ ?? '').replace(/\D/g, ''),
                    segXSeg:     inf.seg?.infSeg?.xSeg ?? '',
                    segCNPJSeg:  (inf.seg?.infSeg?.cnpj ?? inf.seg?.infSeg?.CNPJ ?? '').replace(/\D/g, ''),
                    segNApol:    inf.seg?.nApol ?? '',
                    segNAver:    (Array.isArray(inf.seg?.nAver) ? inf.seg.nAver[0] : (inf.seg?.nAver ?? '')) ?? '',
                })
                const cteList: CteSelecionado[] = []
                for (const mun of inf.infDoc?.infMunDescarga ?? []) {
                    for (const cte of mun.infCTe ?? []) {
                        cteList.push({ chave: cte.chCTe, cMunDescarga: mun.cMunDescarga, xMunDescarga: mun.xMunDescarga })
                    }
                }
                setCtesSelecionados(cteList)
                setShowPropTracao(!!veic.prop)
                setShowPropReboques((rodo.veicReboque ?? []).map((r: any) => !!r.prop))
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
            .buildRodo({
                placa:   vals.placa,
                tpRod:   vals.tpRod,
                tpCar:   vals.tpCar,
                uf:      vals.ufVeic,
                tara:    Number(vals.tara) || 0,
                capKG:   vals.capKG  ? Number(vals.capKG)  : undefined,
                capM3:   vals.capM3  ? Number(vals.capM3)  : undefined,
                renavam: vals.renavam || undefined,
                prop:    vals.prop ? {
                    rntrc:  vals.prop.rntrc,
                    xNome:  vals.prop.xNome,
                    tpProp: Number(vals.prop.tpProp),
                    cpf:    vals.prop.cpfCnpj === 'cpf'  ? vals.prop.cpf?.replace(/\D/g,'') || undefined : undefined,
                    cnpj:   vals.prop.cpfCnpj === 'cnpj' ? vals.prop.cnpj?.replace(/\D/g,'') || undefined : undefined,
                    ie:     vals.prop.ie  || undefined,
                    uf:     vals.prop.uf  || undefined,
                } : undefined,
            }, {
                tpCarga: vals.tpCarga,
                xProd:   vals.xProd,
                ncm:     vals.prodNCM || undefined,
                ...(ctesSelecionados.length === 1 ? { infLotacao: {
                    cepCarrega:    vals.cepCarrega    || undefined,
                    cepDescarrega: vals.cepDescarrega || undefined,
                }} : {}),
            }, vals.veicReboque.map(r => ({
                placa:   r.placa,
                tpCar:   r.tpCar,
                tara:    Number(r.tara) || 0,
                capKG:   r.capKG  ? Number(r.capKG)  : undefined,
                capM3:   r.capM3  ? Number(r.capM3)  : undefined,
                uf:      r.ufVeic || undefined,
                renavam: r.renavam || undefined,
                prop:    r.prop ? {
                    rntrc:  r.prop.rntrc,
                    xNome:  r.prop.xNome,
                    tpProp: Number(r.prop.tpProp),
                    cpf:    r.prop.cpfCnpj === 'cpf'  ? r.prop.cpf?.replace(/\D/g,'') || undefined : undefined,
                    cnpj:   r.prop.cpfCnpj === 'cnpj' ? r.prop.cnpj?.replace(/\D/g,'') || undefined : undefined,
                    ie:     r.prop.ie  || undefined,
                    uf:     r.prop.uf  || undefined,
                } : undefined,
            })))
            .addContratante({ cnpj: vals.contCNPJ?.replace(/\D/g, '') || undefined, xNome: vals.contNome || undefined })
            .addCondutor({ xNome: vals.condNome, cpf: vals.condCpf })
            .addCtes(ctesSelecionados)
            .buildTot({ vCarga: Number(vals.vCarga), qCarga: Number(vals.qCarga), cUnid: vals.cUnid })
            .buildAdic(vals.infCpl)
            .buildSeg({
                respSeg:  vals.segRespSeg,
                cnpj:     vals.segCNPJResp?.replace(/\D/g, '') || undefined,
                infSeg:   vals.segXSeg ? {
                    xSeg: vals.segXSeg,
                    cnpj: vals.segCNPJSeg?.replace(/\D/g, '') || undefined,
                } : undefined,
                nApol: vals.segNApol || undefined,
                nAver: vals.segNAver ? [vals.segNAver] : undefined,
            });

        if (vals.infPag.length) {
            builder.buildPag(vals.infPag.map(p => {
                const doc = p.doc?.replace(/\D/g, '') || ''
                return {
                    xNome:     p.xNome,
                    cnpj:      doc.length === 14 ? doc : undefined,
                    cpf:       doc.length === 11 ? doc : undefined,
                    chPix:     p.chPix || undefined,
                    indPag:    p.indPag,
                    vContrato: Number(p.vContrato) || 0,
                    comp:      [{ tpComp: p.tpComp, vComp: Number(p.vContrato) || 0 }],
                }
            }))
        }

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
            console.error('MDFE_EMIT_ERROR =>', e?.response?.data ?? e)
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

    function recalcTotals(map: Record<string, { peso: number; valor: number }>, selected: CteSelecionado[]) {
        const chaves = new Set(selected.map(c => c.chave))
        const entries = Object.entries(map).filter(([k]) => chaves.has(k)).map(([, v]) => v)
        const totalPeso  = entries.reduce((s, d) => s + d.peso,  0)
        const totalValor = entries.reduce((s, d) => s + d.valor, 0)
        if (totalPeso  > 0) setValue('qCarga', String(Math.round(totalPeso  * 1000) / 1000))
        if (totalValor > 0) setValue('vCarga', totalValor.toFixed(2))
    }

    function extractCteData(full: any) {
        const ide      = full.infCte?.ide ?? {}
        const dest     = full.infCte?.dest ?? {}
        const ender    = dest.enderDest ?? {}
        const infCarga = full.infCte?.infCTeNorm?.infCarga ?? {}
        console.log('CTE_RAW infCarga =>', infCarga, '| qtCarga =>', infCarga.qtCarga)

        const cMunCarrega  = String(ide.cMunIni ?? '')
        const xMunCarrega  = ide.xMunIni ?? ''
        const cMunDescarga = String(ender.cMun ?? ide.cMunFim ?? '')
        const xMunDescarga = ender.xMun ?? ide.xMunFim ?? dest.xNome ?? ''

        // infQ é o array de quantidades no CT-e (qtCarga é nome alternativo)
        const qtArr: any[] = Array.isArray(infCarga.infQ) ? infCarga.infQ
            : infCarga.infQ ? [infCarga.infQ]
            : Array.isArray(infCarga.qtCarga) ? infCarga.qtCarga
            : infCarga.qtCarga ? [infCarga.qtCarga] : []

        let peso = 0
        for (const qt of qtArr) {
            const unid = String(qt.cUnid ?? '')
            const med  = String(qt.tpMed ?? '').toUpperCase()
            if (unid === '01' || med.includes('KG') || med.includes('PESO')) {
                peso = Number(qt.qCarga) || 0; break
            }
        }
        if (!peso) {
            for (const qt of qtArr) {
                if (String(qt.cUnid) === '02') { peso = (Number(qt.qCarga) || 0) * 1000; break }
            }
        }
        if (!peso && qtArr.length > 0) peso = Number(qtArr[0].qCarga) || 0

        const valor = Number(infCarga.vCarga)
            || Number(full.infCte?.vPrest?.vTPrest)
            || Number(full.valorTotal)
            || 0

        const xProd = String(infCarga.proPred ?? '').trim()

        const cepCarrega    = String(full.infCte?.rem?.enderReme?.CEP  ?? '').replace(/\D/g, '')
        const cepDescarrega = String(full.infCte?.dest?.enderDest?.CEP ?? '').replace(/\D/g, '')

        const remNome = String(full.infCte?.rem?.xNome ?? '').trim()
        const remCnpj = String(full.infCte?.rem?.CNPJ  ?? '').replace(/\D/g, '')
        const remCpf  = String(full.infCte?.rem?.CPF   ?? '').replace(/\D/g, '')
        const vFrete  = Number(full.infCte?.vPrest?.vTPrest) || valor

        return { cMunCarrega, xMunCarrega, cMunDescarga, xMunDescarga,
                 ufIni: ide.UFIni ?? '', ufFim: ide.UFFim ?? '', peso, valor,
                 xProd, cepCarrega, cepDescarrega,
                 remNome, remCnpj, remCpf, vFrete }
    }

    function toggleCte(cte: any) {
        const chave = cte.chave ?? ''
        if (!chave) return toast.error('CT-e sem chave de acesso.')
        const exists = ctesSelecionados.some(c => c.chave === chave)

        if (exists) {
            const newSelected = ctesSelecionados.filter(c => c.chave !== chave)
            setCtesSelecionados(newSelected)
            setCteDataMap(prev => {
                const newMap = { ...prev }
                // Remove pagador associado a este CT-e (pela chave gravada no mapa)
                const removedDoc = (newMap[chave] as any)?.remCnpj as string | undefined
                if (removedDoc) {
                    const cur = getValues('infPag') ?? []
                    const idx = cur.findIndex((p: any) => p.doc?.replace(/\D/g, '') === removedDoc)
                    if (idx !== -1) removePagItem(idx)
                }
                delete newMap[chave]
                recalcTotals(newMap, newSelected)
                return newMap
            })
        } else {
            const newSelected = [...ctesSelecionados, { chave, cMunDescarga: '', xMunDescarga: cte.nomeDestinatario ?? '' }]
            setCtesSelecionados(newSelected)

            fetch(`/api/ctes/${cte.id}`).then(r => r.json()).then(full => {
                const { cMunCarrega, xMunCarrega, cMunDescarga, xMunDescarga,
                        ufIni, ufFim, peso, valor, xProd, cepCarrega, cepDescarrega,
                        remNome, remCnpj, remCpf, vFrete } = extractCteData(full)

                console.log('CTE_DATA =>', { cMunCarrega, xMunCarrega, cMunDescarga, xMunDescarga, ufIni, ufFim, peso, valor, xProd, cepCarrega, cepDescarrega })
                if (ufIni) setValue('ufIni', ufIni)
                if (ufFim) setValue('ufFim', ufFim)
                if (xProd) setValue('xProd', xProd)
                if (newSelected.length === 1) {
                    if (cepCarrega)    setValue('cepCarrega',    cepCarrega)
                    if (cepDescarrega) setValue('cepDescarrega', cepDescarrega)
                }

                setCtesSelecionados(prev => prev.map(c =>
                    c.chave === chave ? { ...c, cMunDescarga, xMunDescarga } : c
                ))

                // Atualiza mapa com update funcional para evitar stale closure
                setCteDataMap(prev => {
                    const newMap = { ...prev, [chave]: { cMunCarrega, xMunCarrega, cMunDescarga, xMunDescarga, peso, valor, remCnpj } }
                    recalcTotals(newMap, newSelected)
                    return newMap
                })

                // Adiciona remetente como pagador se ainda não estiver na lista
                if (remNome) {
                    const cur = getValues('infPag') ?? []
                    const docRem = remCnpj || remCpf
                    const jaExiste = docRem
                        ? cur.some((p: any) => p.doc?.replace(/\D/g, '') === docRem)
                        : cur.some((p: any) => p.xNome === remNome)
                    if (!jaExiste) {
                        addPagItem({
                            xNome:     remNome,
                            doc:       docRem,
                            chPix:     getValues('condCpf')?.replace(/\D/g, '') ?? '',
                            indPag:    '0',
                            tpComp:    '99',
                            vContrato: String(vFrete || ''),
                        })
                    }
                }

                if (cMunCarrega) {
                    const curCarrega = getValues('munCarrega') ?? []
                    if (!curCarrega.some((m: any) => String(m.cMun) === cMunCarrega)) {
                        addMunCarrega({ cMun: cMunCarrega, xMun: xMunCarrega })
                    }
                }

                if (cMunDescarga) {
                    const curDescarga = getValues('munDescarga') ?? []
                    if (!curDescarga.some((m: any) => String(m.cMun) === cMunDescarga)) {
                        addMunDescarga({ cMun: cMunDescarga, xMun: xMunDescarga })
                    }
                }
            }).catch(() => {})
        }
    }

    const tabError = {
        percurso: !!(errors.munCarrega),
        veiculo:  !!(errors.placa || errors.tpRod || errors.tpCar || errors.condNome || errors.condCpf || errors.rntrc || errors.tara || errors.veicReboque),
        totais:   !!(errors.vCarga || errors.qCarga || errors.tpCarga || errors.xProd || errors.contCNPJ),
        seguro:   !!(errors.segCNPJResp || errors.segXSeg || errors.segCNPJSeg),
    }

    return (
        <main className="min-h-screen bg-slate-50 text-slate-900">
            <Navbar />

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
                            Informações Adicionais {tabError.totais && <ErrorDot />}
                        </TabsTrigger>
                        <TabsTrigger value="seguro" className="relative">
                            Seguro {tabError.seguro && <ErrorDot />}
                        </TabsTrigger>
                        <TabsTrigger value="pagamento">
                            Pagamento {pagFields.length > 0 && (
                                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-100 text-sky-700 text-[10px] font-bold">{pagFields.length}</span>
                            )}
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
                        <div className="space-y-4 mt-2">

                            {/* Row 1 — Motorista */}
                            <div className="bg-white rounded-2xl border shadow-sm">
                                <div className="px-5 py-3 border-b">
                                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Motorista</h2>
                                </div>
                                <div className="p-5 space-y-4">
                                    {/* Busca */}
                                    <div>
                                        <Label className="text-xs text-slate-600 mb-1 block">Buscar motorista cadastrado</Label>
                                        <MotoristaSearch onSelect={m => {
                                            setValue('condNome', m.xNome)
                                            setValue('condCpf', m.cpf?.replace(/\D/g, '') ?? '')
                                        }} />
                                    </div>

                                    {/* Campos */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="md:col-span-3">
                                            <Controller name="condNome" control={control} render={({ field, fieldState }) => (
                                                <Field label="Nome" error={fieldState.error?.message}
                                                    value={field.value} onChange={field.onChange} placeholder="Nome completo" />
                                            )} />
                                        </div>
                                        <Controller name="condCpf" control={control} render={({ field, fieldState }) => (
                                            <Field label="CPF" error={fieldState.error?.message}
                                                value={maskCpf(field.value)} onChange={v => field.onChange(v.replace(/\D/g, ''))}
                                                placeholder="000.000.000-00" mono />
                                        )} />
                                    </div>

                                    {/* Cadastrar novo */}
                                    {watch('condNome') && (watch('condCpf') ?? '').length >= 11 && (
                                        <button type="button"
                                            onClick={async () => {
                                                try {
                                                    await fetch('/api/parceiros', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            tipoPessoa: 'F',
                                                            xNome: watch('condNome'),
                                                            cpf: (watch('condCpf') ?? '').replace(/\D/g, ''),
                                                        }),
                                                    })
                                                    toast.success('Motorista salvo nos parceiros.')
                                                } catch {
                                                    toast.error('Erro ao salvar motorista.')
                                                }
                                            }}
                                            className="text-xs text-sky-600 hover:text-sky-700 hover:underline"
                                        >
                                            + Salvar motorista nos parceiros
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Row 2 — Veículo de Tração */}
                            <div className="bg-white rounded-2xl border shadow-sm">
                                <div className="px-5 py-3 border-b flex items-center justify-between">
                                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Veículo de Tração</h2>
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={() => {
                                            setValue('renavam', ''); setValue('tara', ''); setValue('capKG', ''); setValue('capM3', '')
                                            setValue('tpRod', '01'); setValue('tpCar', '00'); setValue('ufVeic', 'RO')
                                            setValue('prop', undefined); setPropIdTracao(null); setShowPropTracao(false)
                                            setModalTracao(true)
                                        }}
                                            className="flex items-center gap-1.5 text-xs bg-sky-50 hover:bg-sky-100 text-sky-600 px-2.5 py-1 rounded-lg transition-colors font-medium">
                                            + Novo veículo
                                        </button>
                                        <button type="button" onClick={() => setModalTracao(true)}
                                            className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded-lg transition-colors">
                                            <PenLine className="h-3 w-3" />
                                            Editar cadastro
                                        </button>
                                    </div>
                                </div>
                                <div className="p-5">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <Controller name="placa" control={control} render={({ field, fieldState }) => (
                                            <PlacaInput value={field.value} onChange={field.onChange}
                                                error={fieldState.error?.message}
                                                onSelect={v => {
                                                    field.onChange(v.placa)
                                                    setValue('renavam', v.renavam ?? '')
                                                    setValue('tara',    String(v.tara))
                                                    setValue('capKG',   v.capKG != null ? String(v.capKG) : '')
                                                    setValue('capM3',   v.capM3 != null ? String(v.capM3) : '')
                                                    setValue('tpRod',   v.tpRod)
                                                    setValue('tpCar',   v.tpCar)
                                                    setValue('ufVeic',  v.uf ?? 'RO')
                                                    if (v.rntrc) setValue('rntrc', v.rntrc)
                                                    if (v.proprietario) {
                                                        const p = v.proprietario
                                                        setPropIdTracao(p.id); setShowPropTracao(true)
                                                        setValue('prop', { cpfCnpj: p.cpf ? 'cpf' : 'cnpj', cpf: p.cpf ?? '', cnpj: p.cnpj ?? '', rntrc: p.rntrc, xNome: p.xNome, ie: p.ie ?? '', uf: p.uf ?? '', tpProp: String(p.tpProp) })
                                                    } else {
                                                        setPropIdTracao(null); setShowPropTracao(false); setValue('prop', undefined)
                                                    }
                                                }} />
                                        )} />
                                        <Controller name="tpRod" control={control} render={({ field, fieldState }) => (
                                            <SelectField label="Tipo de Rodado" value={field.value} onChange={field.onChange}
                                                options={TP_ROD} error={fieldState.error?.message} />
                                        )} />
                                        <Controller name="tpCar" control={control} render={({ field, fieldState }) => (
                                            <SelectField label="Tipo de Carroceria" value={field.value} onChange={field.onChange}
                                                options={TP_CAR} error={fieldState.error?.message} />
                                        )} />
                                        <Controller name="tara" control={control} render={({ field, fieldState }) => (
                                            <Field label="Tara (KG) *" error={fieldState.error?.message}
                                                value={field.value} onChange={v => field.onChange(v.replace(/\D/g, ''))} placeholder="0" mono />
                                        )} />
                                    </div>
                                    {showPropTracao && watch('prop.xNome') && (
                                        <p className="mt-2 text-xs text-amber-600">Proprietário: {watch('prop.xNome')}</p>
                                    )}
                                </div>
                            </div>

                            <VeiculoDetalheModal
                                open={modalTracao} onClose={() => setModalTracao(false)}
                                isTracao fieldPrefix=""
                                control={control} errors={errors} setValue={setValue} getValues={getValues} watch={watch}
                                showProp={showPropTracao} setShowProp={setShowPropTracao}
                                propId={propIdTracao} onPropId={setPropIdTracao}
                            />

                            {/* Row 3 — Reboques */}
                            <div className="bg-white rounded-2xl border shadow-sm">
                                <div className="px-5 py-3 border-b flex items-center justify-between">
                                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Reboques ({reboqueFields.length}/3)
                                    </h2>
                                    {reboqueFields.length < 3 && (
                                        <div className="flex items-center gap-2">
                                            <button type="button"
                                                onClick={() => addReboque({ placa: '', renavam: '', tara: '', capKG: '', capM3: '', tpCar: '00', ufVeic: '' })}
                                                className="text-[11px] text-slate-500 hover:text-slate-700 font-medium hover:underline">
                                                + Adicionar
                                            </button>
                                            <button type="button"
                                                onClick={() => {
                                                    addReboque({ placa: '', renavam: '', tara: '', capKG: '', capM3: '', tpCar: '00', ufVeic: '' })
                                                    setModalReboqueIdx(reboqueFields.length)
                                                }}
                                                className="flex items-center gap-1 text-[11px] bg-sky-50 hover:bg-sky-100 text-sky-600 px-2 py-0.5 rounded-md transition-colors font-medium">
                                                + Cadastrar reboque
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="p-5 space-y-3">
                                    {reboqueFields.length === 0 && (
                                        <p className="text-xs text-slate-400">Nenhum reboque adicionado.</p>
                                    )}
                                    {reboqueFields.map((f, i) => (
                                        <div key={f.id} className="border rounded-xl p-4 bg-slate-50">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-xs font-semibold text-slate-500">Reboque {i + 1}</span>
                                                <div className="flex items-center gap-2">
                                                    <button type="button" onClick={() => {
                                                        setValue(`veicReboque.${i}.renavam`, ''); setValue(`veicReboque.${i}.tara`, '')
                                                        setValue(`veicReboque.${i}.capKG`, ''); setValue(`veicReboque.${i}.capM3`, '')
                                                        setValue(`veicReboque.${i}.tpCar`, '00'); setValue(`veicReboque.${i}.ufVeic`, '')
                                                        setValue(`veicReboque.${i}.prop`, undefined)
                                                        const cur = [...propIdReboques]; cur[i] = null; setPropIdReboques(cur)
                                                        const show = [...showPropReboques]; show[i] = false; setShowPropReboques(show)
                                                        setModalReboqueIdx(i)
                                                    }}
                                                        className="flex items-center gap-1 text-xs bg-sky-50 hover:bg-sky-100 text-sky-600 px-2 py-0.5 rounded-md transition-colors font-medium">
                                                        + Novo
                                                    </button>
                                                    <button type="button" onClick={() => setModalReboqueIdx(i)}
                                                        className="flex items-center gap-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md transition-colors">
                                                        <PenLine className="h-3 w-3" />Editar
                                                    </button>
                                                    <button type="button" onClick={() => removeReboque(i)}
                                                        className="text-xs text-red-400 hover:text-red-600">Remover</button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                <Controller name={`veicReboque.${i}.placa`} control={control} render={({ field, fieldState }) => (
                                                    <PlacaInput value={field.value} onChange={field.onChange}
                                                        error={fieldState.error?.message}
                                                        onSelect={v => {
                                                            field.onChange(v.placa)
                                                            setValue(`veicReboque.${i}.renavam`, v.renavam ?? '')
                                                            setValue(`veicReboque.${i}.tara`,    String(v.tara))
                                                            setValue(`veicReboque.${i}.capKG`,   v.capKG != null ? String(v.capKG) : '')
                                                            setValue(`veicReboque.${i}.capM3`,   v.capM3 != null ? String(v.capM3) : '')
                                                            setValue(`veicReboque.${i}.tpCar`,   v.tpCar)
                                                            setValue(`veicReboque.${i}.ufVeic`,  v.uf ?? '')
                                                            if (v.proprietario) {
                                                                const p = v.proprietario
                                                                const cur = [...propIdReboques]; cur[i] = p.id; setPropIdReboques(cur)
                                                                const show = [...showPropReboques]; show[i] = true; setShowPropReboques(show)
                                                                setValue(`veicReboque.${i}.prop`, { cpfCnpj: p.cpf ? 'cpf' : 'cnpj', cpf: p.cpf ?? '', cnpj: p.cnpj ?? '', rntrc: p.rntrc, xNome: p.xNome, ie: p.ie ?? '', uf: p.uf ?? '', tpProp: String(p.tpProp) })
                                                            } else {
                                                                const cur = [...propIdReboques]; cur[i] = null; setPropIdReboques(cur)
                                                                const show = [...showPropReboques]; show[i] = false; setShowPropReboques(show)
                                                                setValue(`veicReboque.${i}.prop`, undefined)
                                                            }
                                                        }} />
                                                )} />
                                                <Controller name={`veicReboque.${i}.tpCar`} control={control} render={({ field, fieldState }) => (
                                                    <SelectField label="Tipo de Carroceria" value={field.value} onChange={field.onChange}
                                                        options={TP_CAR} error={fieldState.error?.message} />
                                                )} />
                                                <Controller name={`veicReboque.${i}.tara`} control={control} render={({ field, fieldState }) => (
                                                    <Field label="Tara (KG) *" error={fieldState.error?.message}
                                                        value={field.value} onChange={v => field.onChange(v.replace(/\D/g, ''))} placeholder="0" mono />
                                                )} />
                                            </div>
                                            {showPropReboques[i] && watch(`veicReboque.${i}.prop.xNome` as any) && (
                                                <p className="mt-2 text-xs text-amber-600">Proprietário: {watch(`veicReboque.${i}.prop.xNome` as any)}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {modalReboqueIdx !== null && (
                                <VeiculoDetalheModal
                                    open onClose={() => setModalReboqueIdx(null)}
                                    isTracao={false} fieldPrefix={`veicReboque.${modalReboqueIdx}`}
                                    control={control} errors={errors} setValue={setValue} getValues={getValues} watch={watch}
                                    showProp={showPropReboques[modalReboqueIdx] ?? false}
                                    setShowProp={v => { const cur = [...showPropReboques]; cur[modalReboqueIdx!] = v; setShowPropReboques(cur) }}
                                    propId={propIdReboques[modalReboqueIdx] ?? null}
                                    onPropId={id => { const cur = [...propIdReboques]; cur[modalReboqueIdx!] = id; setPropIdReboques(cur) }}
                                />
                            )}

                        </div>
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
                        <Card title="Contratante do Serviço">
                            <div className="grid grid-cols-2 gap-4">
                                <Controller name="contCNPJ" control={control} render={({ field, fieldState }) => (
                                    <Field label="CNPJ do Contratante *" error={fieldState.error?.message}
                                        value={maskCnpj(field.value)} onChange={v => field.onChange(v.replace(/\D/g, '').slice(0, 14))}
                                        placeholder="00.000.000/0001-00" mono />
                                )} />
                                <Controller name="contNome" control={control} render={({ field }) => (
                                    <Field label="Nome do Contratante" value={field.value ?? ''}
                                        onChange={field.onChange} placeholder="Opcional" />
                                )} />
                            </div>
                        </Card>

                        <Card title="Produto Predominante">
                            <div className="grid grid-cols-2 gap-4">
                                <Controller name="tpCarga" control={control} render={({ field, fieldState }) => (
                                    <SelectField label="Tipo de Carga" value={field.value} onChange={field.onChange}
                                        options={TP_CARGA} error={fieldState.error?.message} />
                                )} />
                                <Controller name="xProd" control={control} render={({ field, fieldState }) => (
                                    <Field label="Descrição do Produto" error={fieldState.error?.message}
                                        value={field.value} onChange={field.onChange} placeholder="Ex: Mercadorias em geral" />
                                )} />
                                <Controller name="prodNCM" control={control} render={({ field, fieldState }) => (
                                    <Field label="NCM (8 dígitos)" error={fieldState.error?.message}
                                        value={field.value ?? ''} onChange={v => field.onChange(v.replace(/\D/g, '').slice(0, 8))}
                                        placeholder="00000000" mono />
                                )} />
                            </div>
                            {ctesSelecionados.length === 1 && (
                                <div className="mt-4 grid grid-cols-2 gap-4">
                                    <p className="col-span-2 text-xs text-amber-600 font-medium">Apenas 1 CT-e selecionado — preencha os CEPs de lotação:</p>
                                    <Controller name="cepCarrega" control={control} render={({ field, fieldState }) => (
                                        <Field label="CEP de Carregamento" error={fieldState.error?.message}
                                            value={field.value ?? ''} onChange={v => field.onChange(v.replace(/\D/g, '').slice(0, 8))}
                                            placeholder="00000000" mono />
                                    )} />
                                    <Controller name="cepDescarrega" control={control} render={({ field, fieldState }) => (
                                        <Field label="CEP de Descarregamento" error={fieldState.error?.message}
                                            value={field.value ?? ''} onChange={v => field.onChange(v.replace(/\D/g, '').slice(0, 8))}
                                            placeholder="00000000" mono />
                                    )} />
                                </div>
                            )}
                        </Card>

                        <Card title="Totais da Carga">
                            <div className="grid grid-cols-3 gap-4">
                                <Controller name="vCarga" control={control} render={({ field, fieldState }) => (
                                    <CurrencyInput label="Valor da Carga" value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
                                )} />
                                <Controller name="qCarga" control={control} render={({ field, fieldState }) => (
                                    <Field label="Peso da Mercadoria" error={fieldState.error?.message}
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

                    {/* ── Seguro da Carga ── */}
                    <TabsContent value="seguro">
                        <Card title="Seguro da Carga">
                            <div className="grid grid-cols-2 gap-4">
                                <Controller name="segRespSeg" control={control} render={({ field }) => (
                                    <SelectField label="Responsável pelo Seguro" value={field.value}
                                        onChange={field.onChange} options={TP_RESP_SEG} />
                                )} />
                                <Controller name="segCNPJResp" control={control} render={({ field, fieldState }) => (
                                    <Field label="CNPJ do Responsável *" error={fieldState.error?.message}
                                        value={maskCnpj(field.value)} onChange={v => field.onChange(v.replace(/\D/g, '').slice(0, 14))}
                                        placeholder="00.000.000/0001-00" mono />
                                )} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Controller name="segXSeg" control={control} render={({ field, fieldState }) => (
                                    <Field label="Nome da Seguradora * (máx. 30)" error={fieldState.error?.message}
                                        value={field.value} onChange={v => field.onChange(v.toUpperCase().slice(0, 30))}
                                        placeholder="Ex: PORTO SEGURO" />
                                )} />
                                <Controller name="segCNPJSeg" control={control} render={({ field, fieldState }) => (
                                    <Field label="CNPJ da Seguradora *" error={fieldState.error?.message}
                                        value={maskCnpj(field.value)} onChange={v => field.onChange(v.replace(/\D/g, '').slice(0, 14))}
                                        placeholder="00.000.000/0001-00" mono />
                                )} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Controller name="segNApol" control={control} render={({ field }) => (
                                    <Field label="Número da Apólice" value={field.value ?? ''}
                                        onChange={field.onChange} placeholder="Opcional" />
                                )} />
                                <Controller name="segNAver" control={control} render={({ field }) => (
                                    <Field label="Número de Averbação" value={field.value ?? ''}
                                        onChange={field.onChange} placeholder="Opcional" />
                                )} />
                            </div>
                        </Card>
                    </TabsContent>

                    {/* ── Pagamento do Frete ── */}
                    <TabsContent value="pagamento" className="space-y-4">
                        {pagFields.length === 0 && (
                            <p className="text-sm text-slate-400 text-center py-6">Nenhum pagador adicionado.</p>
                        )}
                        {pagFields.map((f, i) => (
                            <Card key={f.id} title={`Pagador ${i + 1}`} action={
                                <button type="button" onClick={() => removePagItem(i)}
                                    className="text-xs text-red-400 hover:text-red-600">Remover</button>
                            }>
                                <div className="grid grid-cols-2 gap-4">
                                    <Controller name={`infPag.${i}.xNome`} control={control} render={({ field, fieldState }) => (
                                        <Field label="Nome do Pagador *" error={fieldState.error?.message}
                                            value={field.value} onChange={field.onChange} placeholder="Razão social" />
                                    )} />
                                    <Controller name={`infPag.${i}.doc`} control={control} render={({ field, fieldState }) => (
                                        <Field label="CPF / CNPJ do Pagador" error={fieldState.error?.message}
                                            value={field.value ?? ''} onChange={v => field.onChange(v.replace(/\D/g, '').slice(0, 14))}
                                            placeholder="CPF (11) ou CNPJ (14 dígitos)" mono />
                                    )} />
                                    <Controller name={`infPag.${i}.chPix`} control={control} render={({ field }) => (
                                        <Field label="Chave PIX (infBanc)"
                                            value={field.value ?? ''} onChange={field.onChange}
                                            placeholder="CPF, CNPJ, e-mail, telefone ou aleatória" />
                                    )} />
                                    <Controller name={`infPag.${i}.vContrato`} control={control} render={({ field, fieldState }) => (
                                        <Field label="Valor do Contrato *" error={fieldState.error?.message}
                                            value={field.value} onChange={v => field.onChange(v.replace(/[^\d.,]/g, ''))}
                                            placeholder="0,00" mono />
                                    )} />
                                    <Controller name={`infPag.${i}.indPag`} control={control} render={({ field }) => (
                                        <SelectField label="Forma de Pagamento" value={field.value} onChange={field.onChange}
                                            options={[{ value: '0', label: 'À Vista' }, { value: '1', label: 'À Prazo' }]} />
                                    )} />
                                    <Controller name={`infPag.${i}.tpComp`} control={control} render={({ field }) => (
                                        <SelectField label="Tipo do Componente" value={field.value} onChange={field.onChange}
                                            options={[
                                                { value: '01', label: 'Vale Pedágio' },
                                                { value: '02', label: 'Alimentação' },
                                                { value: '03', label: 'Combustível' },
                                                { value: '99', label: 'Outros' },
                                            ]} />
                                    )} />
                                </div>
                            </Card>
                        ))}
                        <button
                            type="button"
                            onClick={() => addPagItem({
                                xNome:     empresa.razaoSocial ?? '',
                                doc:       empresa.cnpj?.replace(/\D/g, '') ?? '',
                                chPix:     getValues('condCpf')?.replace(/\D/g, '') ?? '',
                                indPag:    '0',
                                tpComp:    '99',
                                vContrato: '',
                            })}
                            className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-sm text-slate-500 hover:border-sky-300 hover:text-sky-600 transition-colors"
                        >
                            + Adicionar Pagador
                        </button>
                    </TabsContent>
                </Tabs>

                {/* Erro */}
                {status === 'error' && errMsg && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                        <b>Rejeição SEFAZ:</b> {errMsg}
                    </div>
                )}

                {/* Banner de visualização (status finalizado) */}
                {loadedStatus && ['autorizado', 'encerrado', 'cancelado'].includes(loadedStatus) && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 flex items-center gap-2">
                        <span className="font-semibold">Visualização:</span> este MDF-e está com status <b>{loadedStatus}</b> e não pode ser re-emitido. Os dados são exibidos somente para consulta.
                    </div>
                )}

                {/* Ações */}
                <div className="flex gap-3 pb-8 flex-wrap">
                    {status !== 'success' && !['autorizado', 'encerrado', 'cancelado'].includes(loadedStatus ?? '') && (
                        <Button onClick={handleSubmit(onSubmit, (errs) => { console.error('MDFE_FORM_VALIDATION_ERRORS =>', errs); toast.error('Preencha os campos obrigatórios', { description: 'Verifique os campos destacados.' }) })} disabled={status === 'loading'} className="gap-2">
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
                    {!['autorizado', 'encerrado', 'cancelado'].includes(loadedStatus ?? '') && (
                        <Button variant="outline" onClick={handleSalvar} disabled={status === 'loading' || status === 'success'}>
                            Salvar rascunho
                        </Button>
                    )}
                    <Link href="/mdfe"><Button variant="ghost">Voltar</Button></Link>
                </div>
            </div>
        </main>
    )
}
