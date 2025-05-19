import { useEffect, useState } from 'react'
import dataIcms from '../app/indice-am.json'
import { Select, SelectItem, SelectLabel, SelectTrigger, SelectContent, SelectGroup, SelectValue } from './ui/select'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Label } from './ui/label'
import { Input } from './ui/input'
import { moneyMask, pesoMask, unMaskPeso } from '@/lib/utils'

interface ICities {
    cidade: string;
    valor: number;
}

export const Icmsam = () => {
    const [state, setState] = useState<string>('')
    const [cities, setCities] = useState<ICities[]>([])
    const [indice, setIndice] = useState<number>(0)
    const [citieSelected, setCitieSelected] = useState<string>('')
    const [peso, setPeso] = useState<number>(0)
    const [baseDeCalculo, setBaseDeCalculo] = useState<number>(0)
    const [icms, setIcms] = useState<number>(0)
    useEffect(() => {
        const value = Object.entries(dataIcms).find(([key]) => key.toLowerCase() == state.toLowerCase())
        if (value) {
            setCities(value[1] as ICities[])
            setCitieSelected('')
            setIndice(0)
            setBaseDeCalculo(0)
            setIcms(0)
        }
    }, [state])

    const onSelectCitie = (value: string) => {
        setCitieSelected(value)
        const citieIndice = cities.find((citie) => citie.cidade == value)?.valor
        if (citieIndice) {
            setIndice(citieIndice)
        }
    }
    const calcularImposto = (peso: number, indice: number) => {
        const pesoConverted = peso / 100
        const baseCalculo = pesoConverted * indice
        const _icms = baseCalculo * 0.12
        setBaseDeCalculo(Math.round(baseCalculo * 10000))
        setIcms(Math.round(_icms * 10000))
    }
    useEffect(() => {
        if (peso && indice) {
            calcularImposto(peso, indice)
        }
    }, [peso, indice])
    return (
        <div className='flex min-h-screen flex-col items-center p-2  lg:p-2 md:p-4'>
            <Card className='flex flex-col w-full'>
                <CardHeader className="flex  items-center">
                    <CardTitle>ICMS DE FRETE AMAZONAS</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col w-full space-y-2 p-4">
                    <div className='grid gap-2 grid-cols-3 lg:gri2d-cols-3 w-full'>
                        <div className='flex flex-col  space-y-1.5 justify-start'>
                            <Label className="font-bold" htmlFor="estado-destino">Estado destino</Label>
                            <Select name='estado-destino' value={state} onValueChange={(value) => setState(value)}   >
                                <SelectTrigger className='w-full'>
                                    <SelectValue placeholder="Selecione o estado"></SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>Estado</SelectLabel>
                                        {Object.keys(dataIcms).map((item, idx) => (
                                            <SelectItem key={idx} value={item}>{item}</SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className='flex flex-col  space-y-1.5 justify-start'>
                            <Label className="font-bold" htmlFor="estado-destino">Cidade Destino</Label>
                            <Select name='estado-destino' value={citieSelected} onValueChange={onSelectCitie}  >
                                <SelectTrigger className='w-full'>
                                    <SelectValue placeholder="Selecione a Cidade"></SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>Cidades</SelectLabel>
                                        {cities.length > 0 && cities.map((item, idx) => (
                                            <SelectItem key={idx} value={item.cidade}>{item.cidade}</SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className='flex flex-col  space-y-1.5 justify-start'>
                            <Label className="font-bold" htmlFor="indice">Indice</Label>
                            <Input name='indice' readOnly disabled value={moneyMask(indice * 10000)}></Input>
                        </div>
                        <div className='flex flex-col  space-y-1.5 justify-start'>
                            <Label className="font-bold" htmlFor="peso">Peso</Label>
                            <Input name='peso' value={pesoMask(peso)} onChange={(e) => {
                                const unMakedPeso = unMaskPeso(e.target.value)
                                setPeso(unMakedPeso)
                            }}></Input>
                        </div>
                    </div>
                    <div className="flex flex-col w-full  gap-4">
                        <div className="grid grid-cols-4 gap-2 justify-between  w-full">
                            <div className="flex flex-col ">
                                <Label className="font-bold" htmlFor="cidade-origem">BASE DE CALCULO</Label>
                                <Label className="text-gray-400">{moneyMask(baseDeCalculo)}</Label>
                            </div>
                            <div className="flex flex-col ">
                                <Label className="font-bold" htmlFor="cidade-origem">ICMS. 12%</Label>
                                <Label className="text-gray-400">{moneyMask(icms)}</Label>
                            </div>

                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}