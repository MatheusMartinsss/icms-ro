"use client"
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChangeEvent, useEffect, useState } from "react";
import axios from "axios";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import tabelaIndice from './indice.json'
import xml2js from "xml2js";  // Importando a biblioteca xml2js

export default function Home() {
  const [origem, setOrigem] = useState('')
  const [destino, setDestino] = useState('')
  const [distancia, setDistancia] = useState(0)
  const [indice, setIndice] = useState(0)
  const [diesel, setDiesel] = useState(0)
  const [peso, setPeso] = useState(0)
  const [tipo, setTipo] = useState('b')
  const [requested, setRequested] = useState(false)
  const [jsonData, setJsonData] = useState(null);
  const [dest, setDest] = useState<any>(null)
  const [emit, setEmit] = useState<any>(null)
  const [ide, setIde] = useState<any>(null)
  const [icms, setIcms] = useState({
    baseCalculo: 0,
    icms: 0,
    red: 0,
    total: 0,
    total_red: 0
  })
  const SEFIN_URL = 'https://sidiec.sefin.ro.gov.br/ords/f?p=157:130::::::'

  useEffect(() => {
    if (distancia) {
      getIndice()
    }
  }, [distancia, tipo])

  useEffect(() => setRequested(false), [origem, destino])

  const getIndice = () => {
    const dist = distancia / 100
    const indice = tabelaIndice.tabela.filter((tab) => tab.range_min <= dist && tab.range_max >= dist).map((x) => x[tipo as keyof Object])
    setIndice(Number(indice) * 1000)
  }

  const calcularIcms = () => {
    if (!indice || !diesel || !peso) return


    const baseCalculo = parseFloat((((peso * diesel * indice) / 1000000000).toFixed(2)))
    const icms = parseFloat(((baseCalculo * 0.12)).toFixed(2))
    const red = parseFloat((icms * 0.20).toFixed(2))
    const total_red = parseFloat(((icms - red)).toFixed(2))
    setIcms((prevState) => ({
      ...prevState,
      baseCalculo: (parseFloat((baseCalculo * 1000).toFixed(2))),
      icms: (parseFloat((icms * 1000).toFixed(2))),
      red: parseFloat((red * 1000).toFixed(2)),
      total: parseFloat((icms * 1000).toFixed(2)),
      total_red: parseFloat((total_red * 1000).toFixed(2))
    }))
  }

  const fetchDistance = async () => {
    try {
      if (!origem || !destino || requested) return
      const { data, status } = await axios.post('/api/', {
        body: {
          origem,
          destino,
          distancia
        }
      })
      setOrigem(data.origin_addresses)
      setDestino(data.destination_addresses)
      const distanceValue = data.rows[0].elements[0].distance.value;
      const limitedDistanceValue = parseInt(distanceValue.toString().substring(0, 4));
      setDistancia(limitedDistanceValue * 100);
      setRequested(true)
    } catch (error) {
      console.log(error)
    }
  }
  const readXml = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();

      reader.onload = (e) => {
        const content = e.target?.result;

        if (!content) return
        // Usando xml2js para converter o XML para JSON
        xml2js.parseString(content, { explicitArray: false }, (err, result) => {
          if (err) {
            console.error("Erro ao converter XML para JSON:", err);
          } else {
            const { NFe } = result.nfeProc
            const { dest, emit, ide, transp: {

            } } = NFe.infNFe
            setOrigem(`${emit.enderEmit.xMun} - ${emit.enderEmit.UF}`)
            setDestino(`${dest.enderDest.xMun} - ${dest.enderDest.UF}`)
            setDest(dest)
            setEmit(emit)
            setIde(ide)
            setJsonData(result);  // Definindo o JSON resultante no estado
          }
        });
      };

      reader.readAsText(file);
    }
  }
  const gerarDare = async () => {
    if (!emit || !dest) return;

    try {
      const response = await fetch('/api/dare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceNumber: ide?.nNF,
          recipient: dest?.xNome,
          origin: `${emit.enderEmit.xMun} - ${emit.enderEmit.UF}`,
          destination: `${dest.enderDest.xMun} - ${dest.enderDest.UF}`,
          product: "ICMS - SERVIÇO TRANSPORTE DE CARGA",
          calculationBase: `BC ${moneyMask(icms.baseCalculo)} x 12% = ${moneyMask(icms.icms)} - RED. 20% ${moneyMask(icms.red)} = ${moneyMask(icms.total_red)}`,
          value: moneyMask(icms.total_red),
          receiptCode: '1414'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      // Get the PDF blob
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error("An error occurred while generating the PDF:", error);
      // Handle error (e.g., show error message to user)
    }
  };
  console.log(jsonData)
  console.log(icms)
  return (
    <main className="flex min-h-screen flex-col items-center p-2  lg:p-24 md:p-16">
      <Card className="flex flex-col w-full lg:w-[800px] md:w-[650px]">
        <CardHeader className="flex  items-center">
          <CardTitle>ICMS DE FRETE RO</CardTitle>
        </CardHeader>
        <CardContent className="flex w-full">
          <div className="flex flex-col w-full  gap-2">
            <div className="flex flex-col">
              <Label className="font-bold" htmlFor="cidade-origem">Carregar XML</Label>
              <Input type="file" onChange={readXml} name='xml'></Input>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4 w-full">
              <div className="flex flex-col justify-end">
                <Label className="font-bold" htmlFor="cidade-origem">Cidade - UF Origem</Label>
                <Label className="text-gray-400">(ex: Candeias do Jamari - RO) </Label>
                <Input value={origem} onChange={(e) => setOrigem(e.target.value)} name='cidade-origem'></Input>
              </div>
              <div className="flex flex-col justify-end">
                <Label className="font-bold" htmlFor="cidade-destino">Cidade - UF Destino</Label>
                <Label className="text-gray-400">(ex: Itajai - SC) </Label>
                <Input value={destino} onChange={(e) => setDestino(e.target.value)} name='cidade-destino'></Input>
              </div>
              <div className="flex flex-col justify-end lg:w-full">
                <Button className="lg:w-full" disabled={requested} onClick={fetchDistance}>Calcular distancia</Button>
              </div>
            </div>
            <div className="flex flex-col space-y-1.5 justify-start">
              <Label className="font-bold" htmlFor="km">Distancia(KM)</Label>
              <Input value={killometersMask(distancia)} name="km" disabled></Input>
            </div>
            <div className="grid grid-cols-2 gap-4 justify-between  w-full" >
              <div className="flex flex-col space-y-1.5 justify-start">
                <Label className="font-bold" htmlFor="km">Tipo de Carga</Label>
                <Select onValueChange={(value) => setTipo(value)} defaultValue={tipo}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione tipo de carga" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Carga</SelectLabel>
                      <SelectItem value="a">Refrigerada</SelectItem>
                      <SelectItem value="b">Carga Seca</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col space-y-1.5 justify-start">
                <Label className="font-bold" htmlFor="indice">Indice (R$)</Label>
                <Input value={moneyMask(indice)} name="indice" disabled></Input>
              </div>
            </div>
            <div className="flex flex-col space-y-1.5 justify-start">
              <Label className="font-bold" htmlFor="diesel">Preço Diesel(R$)</Label>
              <Label className="text-gray-400">
                Valor do diesel disponível em{" "}
                <a className="text-blue-600 underline" href={SEFIN_URL} target="_blank" rel="noopener noreferrer">
                  SEFIN
                </a>
              </Label>
              <Input
                value={moneyMask(diesel)}
                onChange={(e) => {
                  const value = unMaskReais(e.target.value)
                  setDiesel(parseFloat((value * 1000).toFixed(2)))
                }}
                name="diesel"></Input>
            </div>
            <div className="flex flex-col space-y-1.5 justify-start">
              <Label className="font-bold" htmlFor="peso">Peso Liquido (KG)</Label>
              <Input
                value={pesoMask(peso)}
                onChange={(e) => {
                  setPeso(unMaskPeso(e.target.value))
                }}
                name="peso"></Input>
            </div>
            <div className="flex flex-col w-full  gap-4">
              <div className="grid grid-cols-3 gap-4 justify-between  w-full">
                <div className="flex flex-col ">
                  <Label className="font-bold" htmlFor="cidade-origem">VALOR TRANSPORTE</Label>
                  <Label className="text-gray-400">{moneyMask(icms.baseCalculo)}</Label>
                </div>

              </div>
              <div className="grid grid-cols-3 gap-4 justify-between  w-full">
                <div className="flex flex-col ">
                  <Label className="font-bold" htmlFor="cidade-origem">ICMS SEM REDUÇÃO</Label>
                  <Label className="text-gray-400">{moneyMask(icms.total)}</Label>
                </div>
                <div className="flex flex-col ">
                  <Label className="font-bold" htmlFor="cidade-origem">RED. 20% </Label>
                  <Label className="text-gray-400">{moneyMask(icms.red)}</Label>
                </div>
                <div className="flex flex-col ">
                  <Label className="font-bold" htmlFor="cidade-origem">ICMS REDUZIDO</Label>
                  <Label className="text-gray-400">{moneyMask(icms.total_red)}</Label>
                </div>
              </div>
              <div className="flex flex-col ">
                <Label className="font-bold" htmlFor="cidade-origem">BASE DE CALCULO</Label>
                <Label className="text-gray-400">{`BC ${moneyMask(icms.baseCalculo)} x 12% = ${moneyMask(icms.icms)} - RED. 20% ${moneyMask(icms.red)} = ${moneyMask(icms.total_red)}`}</Label>
              </div>
            </div>
            <div className="flex flex-col w-full  space-y-1.5">
              <Button onClick={calcularIcms} className="w-full">Calcular</Button>
            </div>
            <div className="flex flex-col w-full  space-y-1.5">
              <Button onClick={gerarDare} className="w-full">Gerar Dare</Button>
            </div>

          </div>
        </CardContent>
      </Card>

    </main>
  );
}

const killometersMask = (value: number): string => {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: 'unit',
      unit: 'kilometer',
      unitDisplay: 'short',
      maximumSignificantDigits: 5,
      maximumFractionDigits: 0
    }
  ).format(value / 100)
}

const pesoMask = (value: number): string => {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: 'unit',
      unit: 'kilogram',
      unitDisplay: 'short',
      maximumSignificantDigits: 5,
      maximumFractionDigits: 0
    }
  ).format(value)
}
const unMaskPeso = (value: string | undefined): number => {
  return typeof value === "number"
    ? value
    : Number(value?.replace(/\D/g, ""));
};

const moneyMask = (value: number): string => {
  return (Number(value.toString().replace(/\D/g, "")) / 1000).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  );
};

const unMaskReais = (value: string | undefined): number => {
  return typeof value === "number"
    ? value
    : Number(value?.replace(/\D/g, "")) / 100;
};