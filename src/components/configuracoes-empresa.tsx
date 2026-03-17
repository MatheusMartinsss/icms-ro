'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
}

const DEFAULT_CONFIG: EmpresaConfig = {
    razaoSocial: '',
    cnpj: '29180936000123',
    ie: '000004925301',
    crt: '3',
    rntrc: '01188553',
    cuf: '11',
    cMunEnv: '1100452',
    xMunEnv: 'BURITIS',
    ufEnv: 'RO',
}

const STORAGE_KEY = 'icms-ro:empresa-config'

export function useEmpresaConfig() {
    const [config, setConfig] = useState<EmpresaConfig>(DEFAULT_CONFIG)

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            if (saved) setConfig(JSON.parse(saved))
        } catch {}
    }, [])

    return config
}

export function ConfiguracoesEmpresa() {
    const [config, setConfig] = useState<EmpresaConfig>(DEFAULT_CONFIG)
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) setConfig(JSON.parse(stored))
        } catch {}
    }, [])

    function handleChange(field: keyof EmpresaConfig, value: string) {
        setConfig((prev) => ({ ...prev, [field]: value }))
        setSaved(false)
    }

    function handleSave() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
        setSaved(true)
    }

    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-slate-800">Dados da Empresa</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Informações utilizadas na emissão do CT-e.
                </p>
            </div>

            <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Identificação</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <Label htmlFor="razaoSocial">Razão Social</Label>
                        <Input
                            id="razaoSocial"
                            value={config.razaoSocial}
                            onChange={(e) => handleChange('razaoSocial', e.target.value)}
                            placeholder="Ex: TRANSPORTE LTDA"
                        />
                    </div>
                    <div>
                        <Label htmlFor="cnpj">CNPJ</Label>
                        <Input
                            id="cnpj"
                            value={config.cnpj}
                            onChange={(e) => handleChange('cnpj', e.target.value.replace(/\D/g, ''))}
                            placeholder="00000000000000"
                            maxLength={14}
                        />
                    </div>
                    <div>
                        <Label htmlFor="ie">Inscrição Estadual</Label>
                        <Input
                            id="ie"
                            value={config.ie}
                            onChange={(e) => handleChange('ie', e.target.value)}
                            placeholder="000000000000"
                        />
                    </div>
                    <div>
                        <Label htmlFor="crt">CRT (Regime Tributário)</Label>
                        <Input
                            id="crt"
                            value={config.crt}
                            onChange={(e) => handleChange('crt', e.target.value)}
                            placeholder="3"
                        />
                    </div>
                    <div>
                        <Label htmlFor="rntrc">RNTRC</Label>
                        <Input
                            id="rntrc"
                            value={config.rntrc}
                            onChange={(e) => handleChange('rntrc', e.target.value)}
                            placeholder="00000000"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Localização</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <Label htmlFor="cuf">Código UF</Label>
                        <Input
                            id="cuf"
                            value={config.cuf}
                            onChange={(e) => handleChange('cuf', e.target.value)}
                            placeholder="11"
                        />
                    </div>
                    <div>
                        <Label htmlFor="cMunEnv">Cód. Município</Label>
                        <Input
                            id="cMunEnv"
                            value={config.cMunEnv}
                            onChange={(e) => handleChange('cMunEnv', e.target.value)}
                            placeholder="1100452"
                        />
                    </div>
                    <div>
                        <Label htmlFor="xMunEnv">Município</Label>
                        <Input
                            id="xMunEnv"
                            value={config.xMunEnv}
                            onChange={(e) => handleChange('xMunEnv', e.target.value.toUpperCase())}
                            placeholder="BURITIS"
                        />
                    </div>
                    <div>
                        <Label htmlFor="ufEnv">UF</Label>
                        <Input
                            id="ufEnv"
                            value={config.ufEnv}
                            onChange={(e) => handleChange('ufEnv', e.target.value.toUpperCase())}
                            placeholder="RO"
                            maxLength={2}
                        />
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <Button onClick={handleSave}>Salvar configurações</Button>
                {saved && <span className="text-sm text-green-600">Salvo com sucesso!</span>}
            </div>
        </div>
    )
}
