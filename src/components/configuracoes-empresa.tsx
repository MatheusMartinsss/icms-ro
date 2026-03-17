'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Search } from 'lucide-react'

export type EmpresaConfig = {
    razaoSocial: string
    cnpj: string
    ie: string
    crt: string
    rntrc: string
    cuf: string
    cMunEnv: string
    xMunEnv: string
    ufEnv: string
    sequenciaCte: number
}

const DEFAULT_CONFIG: EmpresaConfig = {
    razaoSocial: '',
    cnpj: '',
    ie: '',
    crt: '3',
    rntrc: '',
    cuf: '',
    cMunEnv: '',
    xMunEnv: '',
    ufEnv: '',
    sequenciaCte: 1,
}

// ── Masks ──────────────────────────────────────────────────────────────────
function maskCNPJ(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 14)
    if (d.length <= 2) return d
    if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
    if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
    if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function unmask(v: string) {
    return v.replace(/\D/g, '')
}

// ── Hook público ──────────────────────────────────────────────────────────
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
            .catch(() => { })
            .finally(() => setLoaded(true))
    }, [])

    return { config, loaded }
}

// ── Componente ────────────────────────────────────────────────────────────
export function ConfiguracoesEmpresa() {
    const [config, setConfig] = useState<EmpresaConfig>(DEFAULT_CONFIG)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [lookingUp, setLookingUp] = useState(false)
    const cnpjDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        fetch('/api/empresa')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data && Object.keys(data).length > 0)
                    setConfig({ ...DEFAULT_CONFIG, ...data })
            })
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [])

    function handleChange(field: keyof EmpresaConfig, value: string) {
        setConfig(prev => ({ ...prev, [field]: value }))
    }

    function handleCNPJChange(raw: string) {
        const digits = unmask(raw).slice(0, 14)
        handleChange('cnpj', digits)

        if (cnpjDebounce.current) clearTimeout(cnpjDebounce.current)
        if (digits.length === 14) {
            cnpjDebounce.current = setTimeout(() => lookupCNPJ(digits), 600)
        }
    }

    async function lookupCNPJ(cnpj: string) {
        const digits = unmask(cnpj)
        if (digits.length !== 14) return
        setLookingUp(true)
        try {
            const res = await fetch(`/api/cnpj/${digits}`)
            if (!res.ok) {
                toast.error('CNPJ não encontrado na Receita Federal')
                return
            }
            const data = await res.json()

            setConfig(prev => ({
                ...prev,
                razaoSocial: data.razaoSocial || prev.razaoSocial,
                xMunEnv: data.xMun || prev.xMunEnv,
                cMunEnv: data.cMun || prev.cMunEnv,
                ufEnv: data.uf || prev.ufEnv,
            }))
            toast.success('Dados preenchidos automaticamente')
        } catch {
            toast.error('Erro ao consultar CNPJ')
        } finally {
            setLookingUp(false)
        }
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
            toast.success('Configurações salvas com sucesso!')
        } catch {
            toast.error('Erro ao salvar configurações')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-8">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
        )
    }

    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-slate-800">Dados da Empresa</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Informações utilizadas na emissão do CT-e.
                </p>
            </div>

            {/* Identificação */}
            <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Identificação</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* CNPJ com lookup */}
                    <div>
                        <Label htmlFor="cnpj">CNPJ</Label>
                        <div className="relative mt-1">
                            <Input
                                id="cnpj"
                                value={maskCNPJ(config.cnpj)}
                                onChange={e => handleCNPJChange(e.target.value)}
                                placeholder="00.000.000/0000-00"
                                className="font-mono pr-8"
                            />
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                                {lookingUp
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Search className="h-3.5 w-3.5" />
                                }
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">Preenchimento automático ao digitar</p>
                    </div>

                    {/* Razão Social */}
                    <div>
                        <Label htmlFor="razaoSocial">Razão Social</Label>
                        <Input
                            id="razaoSocial"
                            value={config.razaoSocial}
                            onChange={e => handleChange('razaoSocial', e.target.value.toUpperCase())}
                            placeholder="TRANSPORTE LTDA"
                            className="mt-1"
                        />
                    </div>

                    <div>
                        <Label htmlFor="ie">Inscrição Estadual</Label>
                        <Input
                            id="ie"
                            value={config.ie}
                            onChange={e => handleChange('ie', e.target.value.replace(/\D/g, ''))}
                            placeholder="000000000000"
                            className="mt-1 font-mono"
                        />
                    </div>

                    <div>
                        <Label htmlFor="crt">CRT (Regime Tributário)</Label>
                        <Input
                            id="crt"
                            value={config.crt}
                            onChange={e => handleChange('crt', e.target.value.replace(/\D/g, ''))}
                            placeholder="3"
                            maxLength={1}
                            className="mt-1"
                        />
                    </div>

                    <div>
                        <Label htmlFor="rntrc">RNTRC</Label>
                        <Input
                            id="rntrc"
                            value={config.rntrc}
                            onChange={e => handleChange('rntrc', e.target.value.replace(/\D/g, ''))}
                            placeholder="00000000"
                            className="mt-1 font-mono"
                        />
                    </div>

                    <div>
                        <Label htmlFor="sequenciaCte">Próximo nº CT-e</Label>
                        <Input
                            id="sequenciaCte"
                            type="number"
                            min={1}
                            value={config.sequenciaCte}
                            onChange={e => setConfig(prev => ({ ...prev, sequenciaCte: Math.max(1, parseInt(e.target.value) || 1) }))}
                            className="mt-1 font-mono"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">Incrementado automaticamente a cada emissão</p>
                    </div>
                </div>
            </div>

            {/* Localização */}
            <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Localização do Emitente</h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <Label htmlFor="cuf">Cód. UF</Label>
                        <Input
                            id="cuf"
                            value={config.cuf}
                            onChange={e => handleChange('cuf', e.target.value.replace(/\D/g, ''))}
                            placeholder="11"
                            maxLength={2}
                            className="mt-1 font-mono"
                        />
                    </div>
                    <div>
                        <Label htmlFor="ufEnv">UF</Label>
                        <Input
                            id="ufEnv"
                            value={config.ufEnv}
                            onChange={e => handleChange('ufEnv', e.target.value.toUpperCase())}
                            placeholder="RO"
                            maxLength={2}
                            className="mt-1"
                        />
                    </div>
                    <div className="col-span-2">
                        <Label htmlFor="cMunEnv">Cód. Município IBGE</Label>
                        <Input
                            id="cMunEnv"
                            value={config.cMunEnv}
                            onChange={e => handleChange('cMunEnv', e.target.value.replace(/\D/g, ''))}
                            placeholder="1100452"
                            maxLength={7}
                            className="mt-1 font-mono"
                        />
                    </div>
                    <div className="col-span-2 md:col-span-4">
                        <Label htmlFor="xMunEnv">Município</Label>
                        <Input
                            id="xMunEnv"
                            value={config.xMunEnv}
                            onChange={e => handleChange('xMunEnv', e.target.value.toUpperCase())}
                            placeholder="PORTO VELHO"
                            className="mt-1"
                        />
                    </div>
                </div>
            </div>

            <Button onClick={handleSave} disabled={saving}>
                {saving
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
                    : 'Salvar configurações'
                }
            </Button>
        </div>
    )
}
