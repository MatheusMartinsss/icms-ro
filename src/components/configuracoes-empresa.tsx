'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Search } from 'lucide-react'

export type EmpresaConfig = {
    razaoSocial: string
    nomeFantasia: string
    cnpj: string
    ie: string
    crt: string
    rntrc: string
    cuf: string
    cMunEnv: string
    xMunEnv: string
    ufEnv: string
    sequenciaCte: number
    serie: number
    // Endereço
    xLgr: string
    nro: string
    xCompl: string
    xBairro: string
    cep: string
    fone: string
    email: string
}

const DEFAULT_CONFIG: EmpresaConfig = {
    razaoSocial: '', nomeFantasia: '', cnpj: '', ie: '', crt: '3',
    rntrc: '', cuf: '', cMunEnv: '', xMunEnv: '', ufEnv: '',
    sequenciaCte: 1, serie: 99,
    xLgr: '', nro: '', xCompl: '', xBairro: '', cep: '', fone: '', email: '',
}

// ── Masks ──────────────────────────────────────────────────────────────────────
function maskCNPJ(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 14)
    if (d.length <= 2) return d
    if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
    if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
    if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function maskCEP(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 8)
    if (d.length <= 5) return d
    return `${d.slice(0, 5)}-${d.slice(5)}`
}

function maskPhone(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 2) return d
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function unmask(v: string) { return v.replace(/\D/g, '') }

const UF_CODES: Record<string, number> = {
    RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17,
    MA: 21, PI: 22, CE: 23, RN: 24, PB: 25, PE: 26, AL: 27, SE: 28, BA: 29,
    MG: 31, ES: 32, RJ: 33, SP: 35,
    PR: 41, SC: 42, RS: 43,
    MS: 50, MT: 51, GO: 52, DF: 53,
}

// ── Hook público ───────────────────────────────────────────────────────────────
export function useEmpresaConfig() {
    const [config, setConfig] = useState<EmpresaConfig>(DEFAULT_CONFIG)
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
        fetch('/api/empresa')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data && Object.keys(data).length > 0)
                    setConfig({ ...DEFAULT_CONFIG, ...data })
            })
            .catch(() => {})
            .finally(() => setLoaded(true))
    }, [])

    return { config, loaded }
}

// ── SearchInput helper ─────────────────────────────────────────────────────────
function SearchInput({
    id, value, onChange, onSearch, loading, placeholder, className, label, hint,
}: {
    id: string; value: string; onChange: (v: string) => void
    onSearch: () => void; loading: boolean; placeholder?: string
    className?: string; label: string; hint?: string
}) {
    return (
        <div>
            <Label htmlFor={id}>{label}</Label>
            <div className="relative mt-1">
                <Input
                    id={id}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={`pr-8 ${className ?? ''}`}
                />
                <button
                    type="button"
                    onClick={onSearch}
                    disabled={loading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-50"
                >
                    {loading
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Search className="h-3.5 w-3.5" />
                    }
                </button>
            </div>
            {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
        </div>
    )
}

// ── Componente principal ───────────────────────────────────────────────────────
export function ConfiguracoesEmpresa() {
    const [config, setConfig] = useState<EmpresaConfig>(DEFAULT_CONFIG)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [lookingUpCnpj, setLookingUpCnpj] = useState(false)
    const [lookingUpCep, setLookingUpCep] = useState(false)
    const cnpjDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
    const cepDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        fetch('/api/empresa')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data && Object.keys(data).length > 0)
                    setConfig({ ...DEFAULT_CONFIG, ...data })
            })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    function set(field: keyof EmpresaConfig, value: string | number) {
        setConfig(prev => ({ ...prev, [field]: value }))
    }

    function handleCNPJChange(raw: string) {
        const digits = unmask(raw).slice(0, 14)
        set('cnpj', digits)
        if (cnpjDebounce.current) clearTimeout(cnpjDebounce.current)
        if (digits.length === 14)
            cnpjDebounce.current = setTimeout(() => lookupCNPJ(digits), 700)
    }

    function handleCEPChange(raw: string) {
        const digits = unmask(raw).slice(0, 8)
        set('cep', digits)
        if (cepDebounce.current) clearTimeout(cepDebounce.current)
        if (digits.length === 8)
            cepDebounce.current = setTimeout(() => lookupCEP(digits), 700)
    }

    async function lookupCNPJ(cnpj: string) {
        const digits = unmask(cnpj)
        if (digits.length !== 14) { toast.error('CNPJ incompleto'); return }
        setLookingUpCnpj(true)
        try {
            const res = await fetch(`/api/cnpj/${digits}`)
            if (!res.ok) { toast.error('CNPJ não encontrado'); return }
            const d = await res.json()
            setConfig(prev => ({
                ...prev,
                razaoSocial:  d.razaoSocial  || prev.razaoSocial,
                nomeFantasia: d.nomeFantasia || prev.nomeFantasia,
                xMunEnv:      d.xMun         || prev.xMunEnv,
                cMunEnv:      d.cMun         || prev.cMunEnv,
                ufEnv:        d.uf           || prev.ufEnv,
                cuf:          UF_CODES[d.uf]?.toString() || prev.cuf,
                xLgr:         d.logradouro   || prev.xLgr,
                xBairro:      d.bairro       || prev.xBairro,
                cep:          d.cep          || prev.cep,
                fone:         d.telefone     || prev.fone,
                email:        d.email        || prev.email,
            }))
            toast.success('Dados preenchidos pelo CNPJ')
        } catch { toast.error('Erro ao consultar CNPJ') }
        finally { setLookingUpCnpj(false) }
    }

    async function lookupCEP(cep: string) {
        const digits = unmask(cep)
        if (digits.length !== 8) { toast.error('CEP incompleto'); return }
        setLookingUpCep(true)
        try {
            const res = await fetch(`/api/cep/${digits}`)
            if (!res.ok) { toast.error('CEP não encontrado'); return }
            const d = await res.json()
            setConfig(prev => ({
                ...prev,
                xLgr:    d.xLgr    || prev.xLgr,
                xCompl:  d.xCompl  || prev.xCompl,
                xBairro: d.xBairro || prev.xBairro,
                xMunEnv: d.xMun    || prev.xMunEnv,
                cMunEnv: d.cMun    || prev.cMunEnv,
                ufEnv:   d.uf      || prev.ufEnv,
                cuf:     UF_CODES[d.uf]?.toString() || prev.cuf,
            }))
            toast.success('Endereço preenchido pelo CEP')
        } catch { toast.error('Erro ao consultar CEP') }
        finally { setLookingUpCep(false) }
    }

    async function handleSave() {
        setSaving(true)
        try {
            const res = await fetch('/api/empresa', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            })
            if (!res.ok) throw new Error()
            toast.success('Configurações salvas!')
        } catch { toast.error('Erro ao salvar configurações') }
        finally { setSaving(false) }
    }

    if (loading) return (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-8">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
    )

    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-slate-800">Dados da Empresa</h2>
                <p className="text-sm text-slate-500 mt-1">Informações utilizadas na emissão do CT-e.</p>
            </div>

            {/* Identificação */}
            <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Identificação</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    <SearchInput
                        id="cnpj" label="CNPJ"
                        value={maskCNPJ(config.cnpj)}
                        onChange={handleCNPJChange}
                        onSearch={() => lookupCNPJ(config.cnpj)}
                        loading={lookingUpCnpj}
                        placeholder="00.000.000/0000-00"
                        className="font-mono"
                        hint="Clique na lupa para preencher automaticamente"
                    />

                    <div>
                        <Label htmlFor="razaoSocial">Razão Social</Label>
                        <Input id="razaoSocial" value={config.razaoSocial} className="mt-1"
                            onChange={e => set('razaoSocial', e.target.value.toUpperCase())}
                            placeholder="TRANSPORTE LTDA" />
                    </div>

                    <div>
                        <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                        <Input id="nomeFantasia" value={config.nomeFantasia} className="mt-1"
                            onChange={e => set('nomeFantasia', e.target.value.toUpperCase())}
                            placeholder="TRANSP. LTDA" />
                    </div>

                    <div>
                        <Label htmlFor="ie">Inscrição Estadual</Label>
                        <Input id="ie" value={config.ie} className="mt-1 font-mono"
                            onChange={e => set('ie', unmask(e.target.value))}
                            placeholder="000000000000" />
                    </div>

                    <div>
                        <Label htmlFor="crt">CRT</Label>
                        <Input id="crt" value={config.crt} className="mt-1" maxLength={1}
                            onChange={e => set('crt', unmask(e.target.value))}
                            placeholder="3" />
                    </div>

                    <div>
                        <Label htmlFor="rntrc">RNTRC</Label>
                        <Input id="rntrc" value={config.rntrc} className="mt-1 font-mono"
                            onChange={e => set('rntrc', unmask(e.target.value))}
                            placeholder="00000000" />
                    </div>

                    <div>
                        <Label htmlFor="fone">Telefone</Label>
                        <Input id="fone" value={maskPhone(config.fone)} className="mt-1"
                            onChange={e => set('fone', unmask(e.target.value).slice(0, 11))}
                            placeholder="(00) 00000-0000" />
                    </div>

                    <div>
                        <Label htmlFor="email">E-mail</Label>
                        <Input id="email" type="email" value={config.email} className="mt-1"
                            onChange={e => set('email', e.target.value)}
                            placeholder="contato@empresa.com" />
                    </div>
                </div>
            </div>

            {/* Endereço */}
            <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Endereço</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

                    <div className="col-span-2">
                        <SearchInput
                            id="cep" label="CEP"
                            value={maskCEP(config.cep)}
                            onChange={handleCEPChange}
                            onSearch={() => lookupCEP(config.cep)}
                            loading={lookingUpCep}
                            placeholder="00000-000"
                            className="font-mono"
                            hint="Clique na lupa para preencher o endereço"
                        />
                    </div>

                    <div className="col-span-2 md:col-span-2">
                        <Label htmlFor="xLgr">Logradouro</Label>
                        <Input id="xLgr" value={config.xLgr} className="mt-1"
                            onChange={e => set('xLgr', e.target.value.toUpperCase())}
                            placeholder="RUA DAS FLORES" />
                    </div>

                    <div>
                        <Label htmlFor="nro">Número</Label>
                        <Input id="nro" value={config.nro} className="mt-1"
                            onChange={e => set('nro', e.target.value)}
                            placeholder="123" />
                    </div>

                    <div className="col-span-2 md:col-span-3">
                        <Label htmlFor="xCompl">Complemento</Label>
                        <Input id="xCompl" value={config.xCompl} className="mt-1"
                            onChange={e => set('xCompl', e.target.value.toUpperCase())}
                            placeholder="SALA 01" />
                    </div>

                    <div className="col-span-2">
                        <Label htmlFor="xBairro">Bairro</Label>
                        <Input id="xBairro" value={config.xBairro} className="mt-1"
                            onChange={e => set('xBairro', e.target.value.toUpperCase())}
                            placeholder="CENTRO" />
                    </div>

                    <div className="col-span-2">
                        <Label htmlFor="xMunEnv">Município</Label>
                        <Input id="xMunEnv" value={config.xMunEnv} className="mt-1"
                            onChange={e => set('xMunEnv', e.target.value.toUpperCase())}
                            placeholder="PORTO VELHO" />
                    </div>

                    <div>
                        <Label htmlFor="ufEnv">UF</Label>
                        <Input id="ufEnv" value={config.ufEnv} className="mt-1" maxLength={2}
                            onChange={e => {
                                const uf = e.target.value.toUpperCase()
                                set('ufEnv', uf)
                                if (UF_CODES[uf]) set('cuf', UF_CODES[uf].toString())
                            }}
                            placeholder="RO" />
                    </div>

                    <div>
                        <Label htmlFor="cuf">Cód. UF</Label>
                        <Input id="cuf" value={config.cuf} className="mt-1 font-mono"
                            onChange={e => set('cuf', unmask(e.target.value))}
                            placeholder="11" />
                    </div>

                    <div className="col-span-2">
                        <Label htmlFor="cMunEnv">Cód. Município IBGE</Label>
                        <Input id="cMunEnv" value={config.cMunEnv} className="mt-1 font-mono"
                            onChange={e => set('cMunEnv', unmask(e.target.value))}
                            placeholder="1100452" maxLength={7} />
                    </div>
                </div>
            </div>

            {/* Emissão */}
            <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Emissão CT-e</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="sequenciaCte">Próximo nº CT-e</Label>
                        <Input id="sequenciaCte" type="number" min={1} className="mt-1 font-mono"
                            value={config.sequenciaCte}
                            onChange={e => set('sequenciaCte', Math.max(1, parseInt(e.target.value) || 1))} />
                        <p className="text-[11px] text-slate-400 mt-1">Incrementado automaticamente a cada emissão</p>
                    </div>
                    <div>
                        <Label htmlFor="serie">Série</Label>
                        <Input id="serie" type="number" min={1} max={999} className="mt-1 font-mono"
                            value={config.serie}
                            onChange={e => set('serie', Math.max(1, parseInt(e.target.value) || 99))} />
                        <p className="text-[11px] text-slate-400 mt-1">Série do CT-e (padrão 99)</p>
                    </div>
                </div>
            </div>

            <Button onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : 'Salvar configurações'}
            </Button>
        </div>
    )
}
