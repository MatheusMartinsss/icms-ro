'use client'

import { ChangeEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Navbar } from '@/components/navbar'
import Indice from '../indice.json'
import axios from 'axios'
import xml2js from 'xml2js'

const formatReais = (value: number) =>
    (value / 10000).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <div onClick={onChange}
            className={`w-6 h-6 flex-shrink-0 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${checked ? 'bg-sky-600 border-sky-600' : 'bg-white border-slate-300'}`}>
            {checked && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            )}
        </div>
    )
}

export default function CalculadoraPage() {
    const [origem, setOrigem]                     = useState('')
    const [destino, setDestino]                   = useState('')
    const [distancia, setDistancia]               = useState('0')
    const [tipoCarga, setTipoCarga]               = useState('geral')
    const [tipoViagem, setTipoViagem]             = useState(false)
    const [composicaoVeicular, setComposicaoVeicular] = useState(false)
    const [altoDesempenho, setAltoDesempenho]     = useState(false)
    const [multiplasNfe, setMultiplasNfe]         = useState(false)
    const [eixos, setEixos]                       = useState('4')
    const [peso, setPeso]                         = useState('')
    const [pesoTotalCarga, setPesoTotalCarga]     = useState('')
    const [nfe, setNfe]                           = useState<any>(null)
    const [resultado, setResultado]               = useState({ base: 0, icms: 0, icmsReduzido: 0, reducao: 0, ccd: 0, cc: 0 })

    const readXml = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (e) => {
            const content = e.target?.result
            if (!content) return
            xml2js.parseString(content, { explicitArray: false }, (err, result) => {
                if (err) return
                const { NFe } = result.nfeProc
                const { dest, emit, ide, transp } = NFe.infNFe
                let pesoLiquido = 0
                if (transp?.vol) {
                    const volumes = Array.isArray(transp.vol) ? transp.vol : [transp.vol]
                    pesoLiquido = volumes.reduce((acc: any, vol: any) => acc + (Number(vol.pesoL) || 0), 0)
                }
                const newNfe = {
                    destino: `${dest.enderDest.xMun} - ${dest.enderDest.UF}`.toLocaleUpperCase(),
                    origem:  `${emit.enderEmit.xMun} - ${emit.enderEmit.UF}`.toLocaleUpperCase(),
                    emit, dest, ide,
                    peso: String(pesoLiquido).replace(/\D/g, ''),
                    raw: result,
                }
                setNfe(newNfe)
                setDestino(newNfe.destino)
                setOrigem(newNfe.origem)
                setPeso(newNfe.peso)
            })
        }
        reader.readAsText(file)
    }

    const fetchDistance = async () => {
        if (!origem || !destino) return
        try {
            const { data } = await axios.post('/api/', { body: { origem, destino, distancia } })
            setOrigem(data.origin_addresses)
            setDestino(data.destination_addresses)
            setDistancia(String(Math.round(data.rows[0].elements[0].distance.value / 1000)))
        } catch (error) { console.log(error) }
    }

    const SCALE = 10000
    const sumValue = () => {
        const data = Indice.find(item => item.tipo === tipoCarga)
        if (!data) return
        const ccd = (data.coeficientes.ccd as any)[eixos]
        const cc  = (data.coeficientes.cc  as any)[eixos]
        const ccdInt = Math.round(Number(ccd) * SCALE)
        const ccInt  = Math.round(Number(cc)  * SCALE)
        const distInt = Number(distancia)
        let baseInt = Math.round(ccdInt * distInt + ccInt)
        if (tipoViagem)        baseInt = Math.round(baseInt * 1.3)
        if (composicaoVeicular) baseInt = Math.round(baseInt * 1.1)
        if (altoDesempenho)    baseInt = Math.round(baseInt * 1.05)
        if (multiplasNfe && pesoTotalCarga && peso) {
            const frac = Number(peso) / Number(pesoTotalCarga)
            baseInt = Math.round(baseInt * frac)
        }
        const icmsInt     = Math.round(baseInt * 0.12)
        const reducaoInt  = Math.round(icmsInt * 0.2)
        const icmsReduzido = icmsInt - reducaoInt
        setResultado({ base: baseInt, icms: icmsInt, icmsReduzido, reducao: reducaoInt, ccd: ccdInt, cc: ccInt })
    }

    const gerarDare = async () => {
        if (!nfe) return
        try {
            const response = await fetch('/api/dare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    origin:           nfe.origem,
                    destination:      `${nfe.dest.enderDest.xMun} - ${nfe.dest.enderDest.UF}`.toLocaleUpperCase(),
                    product:          'ICMS - SERVIÇO TRANSPORTE DE CARGA',
                    calculationBase:  `BC ${formatReais(resultado.base)} x 12% = ${formatReais(resultado.icms)} - RED. DE 20% = ${formatReais(resultado.icmsReduzido)}`,
                    value:            formatReais(resultado.icmsReduzido),
                    receiptCode:      '1414',
                }),
            })
            if (!response.ok) throw new Error('Failed to generate PDF')
            const blob = await response.blob()
            const url  = window.URL.createObjectURL(blob)
            const a    = document.createElement('a')
            a.href = url; a.download = 'document.pdf'
            document.body.appendChild(a); a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)
        } catch (error) { console.error(error) }
    }

    return (
        <main className="min-h-screen bg-slate-50 text-slate-900">
            <Navbar />
            <div className="max-w-6xl mx-auto px-6 py-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold">Calculadora de ICMS</h1>
                    <p className="text-sm text-slate-500 mt-1">Cálculo do ICMS para transporte de cargas em Rondônia</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Formulário */}
                    <div className="col-span-2 bg-white rounded-2xl p-6 shadow-sm border">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-medium">Parâmetros da Viagem</h2>
                            <span className="text-sm text-slate-400">Campos mínimos para cálculo</span>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <Label className="font-bold" htmlFor="xml">Carregar XML</Label>
                                <Input type="file" onChange={readXml} name="xml" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                                <div>
                                    <Label htmlFor="origem">Origem (Cidade)</Label>
                                    <Input onChange={e => setOrigem(e.target.value)} value={origem} id="origem" placeholder="Ex: Candeias do Jamari - RO" />
                                </div>
                                <div>
                                    <Label htmlFor="destino">Destino (Cidade)</Label>
                                    <Input onChange={e => setDestino(e.target.value)} value={destino} id="destino" placeholder="Ex: Itajaí - SC" />
                                </div>
                                <Button onClick={fetchDistance} className="self-end">Buscar Distância</Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <Label htmlFor="distancia">Distância (km)</Label>
                                    <Input value={distancia} id="distancia" placeholder="Ex: 3500"
                                        onChange={e => { if (/^\d*$/.test(e.target.value)) setDistancia(e.target.value) }} />
                                </div>
                                <div>
                                    <Label htmlFor="eixos">Eixos carregados</Label>
                                    <Select onValueChange={setEixos} value={eixos}>
                                        <SelectTrigger id="eixos" className="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {['2','3','4','5','6','7','8','9'].map(n => (
                                                <SelectItem key={n} value={n}>{n} eixos</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <Checkbox checked={multiplasNfe} onChange={() => setMultiplasNfe(s => !s)} />
                                    <span className="text-slate-700 select-none">Carga Parcial</span>
                                </label>
                                {multiplasNfe && (
                                    <div className="grid grid-cols-2 gap-3 pl-7">
                                        <div>
                                            <Label htmlFor="pesoTotalCarga">Peso Total Carga (KG)</Label>
                                            <Input value={pesoTotalCarga} id="pesoTotalCarga" placeholder="Ex: 3500"
                                                onChange={e => { if (/^\d*$/.test(e.target.value)) setPesoTotalCarga(e.target.value) }} />
                                        </div>
                                        <div>
                                            <Label htmlFor="peso">Peso Líquido (KG)</Label>
                                            <Input value={peso} id="peso" placeholder="Ex: 3500"
                                                onChange={e => { if (/^\d*$/.test(e.target.value)) setPeso(e.target.value) }} />
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <Label htmlFor="tipo">Tipo de carga</Label>
                                    <Select value={tipoCarga} onValueChange={setTipoCarga}>
                                        <SelectTrigger id="tipo" className="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="geral">Geral</SelectItem>
                                            <SelectItem value="granel_solido">Granel Sólido</SelectItem>
                                            <SelectItem value="granel_liquido">Granel Líquido</SelectItem>
                                            <SelectItem value="frigorificada_aquecida">Frigorificada ou Aquecida</SelectItem>
                                            <SelectItem value="conteinerizada">Conteinerizada</SelectItem>
                                            <SelectItem value="neogranel">Neogranel</SelectItem>
                                            <SelectItem value="perigosa_granel_solido">Perigosa Granel Sólido</SelectItem>
                                            <SelectItem value="perigosa_granel_liquido">Perigosa Granel Líquido</SelectItem>
                                            <SelectItem value="perigosa_frigorificada_aquecida">Perigosa Frigorificada ou Aquecida</SelectItem>
                                            <SelectItem value="perigosa_conteinerizada">Perigosa Conteinerizada</SelectItem>
                                            <SelectItem value="perigosa_carga_geral">Perigosa Carga Geral</SelectItem>
                                            <SelectItem value="carga_granel_pressurizada">Carga Granel Pressurizada</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-slate-700 select-none">Retorno vazio</span>
                                    <Checkbox checked={tipoViagem} onChange={() => setTipoViagem(s => !s)} />
                                </label>
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-slate-700 select-none">Composição veicular</span>
                                    <Checkbox checked={composicaoVeicular} onChange={() => setComposicaoVeicular(s => !s)} />
                                </label>
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-slate-700 select-none">Alto desempenho</span>
                                    <Checkbox checked={altoDesempenho} onChange={() => setAltoDesempenho(s => !s)} />
                                </label>
                            </div>
                            <div className="flex items-center gap-3 pt-2">
                                <Button onClick={sumValue}>Calcular</Button>
                                <Button variant="ghost" onClick={() => setResultado({ base: 0, icms: 0, icmsReduzido: 0, reducao: 0, ccd: 0, cc: 0 })}>
                                    Limpar
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Resultado */}
                    <aside className="bg-white rounded-2xl p-6 shadow-sm border flex flex-col gap-4">
                        <div>
                            <h3 className="text-sm text-slate-500">Resultado</h3>
                            <div className="mt-3">
                                <div className="text-xs text-slate-400">Frete mínimo</div>
                                <div className="text-3xl font-semibold">{formatReais(resultado.base)}</div>
                            </div>
                        </div>
                        <div className="pt-2 border-t">
                            <div className="text-xs text-slate-400">Detalhes</div>
                            <ul className="mt-2 text-sm text-slate-700 space-y-1">
                                <li>Distância: {distancia} km</li>
                                <li>Eixos: {eixos}</li>
                                <li>Base de Cálculo: {formatReais(resultado.base)}</li>
                                <li>ICMS 12%: {formatReais(resultado.icms)}</li>
                                <li>Red. 20%: {formatReais(resultado.reducao)}</li>
                                <li>ICMS Reduzido: {formatReais(resultado.icmsReduzido)}</li>
                                <li>CCD: {formatReais(resultado.ccd)} R$/km</li>
                                <li>CC: {formatReais(resultado.cc)}</li>
                                <li className="pt-1 text-xs text-slate-500">
                                    BC {formatReais(resultado.base)} × 12% = {formatReais(resultado.icms)} − Red 20% = {formatReais(resultado.icmsReduzido)}
                                </li>
                            </ul>
                        </div>
                        <Button onClick={gerarDare} className="w-full">Gerar DARE</Button>
                    </aside>
                </div>
            </div>
        </main>
    )
}
