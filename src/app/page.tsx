"use client"

import React, { ChangeEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Indice from './indice.json'
import axios from "axios";
import xml2js from "xml2js";

export default function Home() {
  const [origem, setOrigem] = useState<string>('')
  const [destino, setDestino] = useState<string>('')
  const [distancia, setDistancia] = useState<string>('0')
  const [tipoCarga, setTipoCarga] = useState<string>('geral')
  const [tipoViagem, setTipoViagem] = useState<boolean>(false)
  const [composicaoVeicular, setComposicaoVeicular] = useState<boolean>(false)
  const [altoDesempenho, setAltoDesempenho] = useState<boolean>(false)
  const [multiplasNfe, setMultiplasNfe] = useState<boolean>(false);
  const [eixos, setEixos] = useState<string>('4')
  const [peso, setPeso] = useState<string>('')
  const [pesoTotalCarga, setPesoTotalCarga] = useState<string>('');
  const [jsonData, setJsonData] = useState(null);
  const [nfe, setNfe] = useState<any>(null)
  const [resultado, setResultado] = useState({ base: 0, icms: 0, icmsReduzido: 0, reducao: 0, ccd: 0, cc: 0 })

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
            const { dest, emit, ide, transp } = NFe.infNFe

            let pesoLiquido = 0;

            if (transp?.vol) {

              const volumes = Array.isArray(transp.vol) ? transp.vol : [transp.vol];
              pesoLiquido = volumes.reduce((acc: any, vol: any) => acc + (Number(vol.pesoL) || 0), 0);
            }

            const newNfe = {
              destino: `${dest.enderDest.xMun} - ${dest.enderDest.UF}`,
              origem: `${emit.enderEmit.xMun} - ${emit.enderEmit.UF}`,
              emit,
              dest,
              ide,
              peso: String(pesoLiquido).replace(/\D/g, '')
            }
            setNfe(newNfe)
            setDestino(newNfe.destino)
            setOrigem(newNfe.origem)
            setPeso(newNfe.peso)
            setJsonData(result);
          }
        });
      };

      reader.readAsText(file);
    }
  }


  const fetchDistance = async () => {
    try {
      if (!origem || !destino) return
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
      setDistancia(String(Number(Math.round(distanceValue / 1000))));
    } catch (error) {
      console.log(error)
    }
  }
  const SCALE = 10000;
  const sumValue = () => {
    const data = Indice.find(item => item.tipo == tipoCarga);

    if (!data) return;


    const ccd = (data.coeficientes.ccd as any)[eixos];
    const cc = (data.coeficientes.cc as any)[eixos];


    const ccdInt = Math.round(Number(ccd) * SCALE);
    const ccInt = Math.round(Number(cc) * SCALE);


    const distanciaInt = Math.round(Number(distancia));


    const baseCcdInt = ccdInt * distanciaInt; // unidades 1/10000 R$
    const totalInt = baseCcdInt + ccInt;      // soma em mesma unidade


    const totalReais = totalInt / SCALE;

    let baseDeCalculoFinal = 0;

    if (multiplasNfe) {
      const formatedPesoTotal = Math.round(Number(pesoTotalCarga))
      const baseProporcionalPeso = Number(totalReais / formatedPesoTotal)
      baseDeCalculoFinal = Math.round((Number(peso) * baseProporcionalPeso) * SCALE)
    } else {
      baseDeCalculoFinal = Math.round((Number(totalReais) * SCALE))
    }
    let icms = Math.round(baseDeCalculoFinal * 0.12);
    let reducao = Math.round(icms * 0.20);
    let icmsReduzido = icms - reducao;
    setResultado({
      base: baseDeCalculoFinal,
      cc: ccInt,
      ccd: ccdInt,
      icms: icms,
      icmsReduzido,
      reducao
    })

  }
  const gerarDare = async () => {
    if (!nfe.emit || !nfe.dest) return;

    try {
      const response = await fetch('/api/dare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceNumber: nfe.ide?.nNF,
          recipient: nfe.dest?.xNome,
          origin: `${nfe.emit.enderEmit.xMun} - ${nfe.emit.enderEmit.UF}`,
          destination: `${nfe.dest.enderDest.xMun} - ${nfe.dest.enderDest.UF}`,
          product: "ICMS - SERVIÇO TRANSPORTE DE CARGA",
          calculationBase: `BC ${formatReais(resultado.base)} x 12% = ${formatReais(resultado.icms)} - RED. 20% ${formatReais(resultado.reducao)} = ${formatReais(resultado.icmsReduzido)}`,
          value: formatReais(resultado.icmsReduzido),
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
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Top bar */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold">F</div>
            <div>
              <h1 className="text-2xl font-semibold">Calculadora de Frete</h1>
              <p className="text-sm text-slate-500">Rápido — simples — conforme ANTT</p>
            </div>
          </div>
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <section className="lg:col-span-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="col-span-2 bg-white rounded-2xl p-6 shadow-sm border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium">Parâmetros da Viagem</h2>
                <div className="text-sm text-slate-400">Campos mínimos para cálculo</div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-1 gap-3 items-end">
                  <div className="flex flex-col">
                    <Label className="font-bold" htmlFor="cidade-origem">Carregar XML</Label>
                    <Input type="file" onChange={readXml} name='xml'></Input>
                  </div>


                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">

                  <div>
                    <Label htmlFor="origem">Origem (Cidade)</Label>
                    <Input onChange={(e) => setOrigem(e.target.value)} value={origem} id="origem" placeholder="Ex: Candeias do Jamari - RO" />
                  </div>

                  <div>
                    <Label htmlFor="destino">Destino (Cidade)</Label>
                    <Input onChange={(e) => setDestino(e.target.value)} value={destino} id="destino" placeholder="Ex: Itajaí - SC" />
                  </div>

                  <div className="flex justify-center md:justify-start">
                    <Button onClick={fetchDistance} value={distancia} className="w-full md:w-auto self-end">Buscar Distância</Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="distancia">Distância (km)</Label>
                    <Input
                      value={distancia}
                      id="distancia"
                      placeholder="Ex: 3500"
                      onChange={(e) => {
                        const value = e.target.value;
                        // Permite apenas números
                        if (/^\d*$/.test(value)) {
                          setDistancia(value);
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="eixos">Eixos carregados</Label>
                    <Select onValueChange={(e) => setEixos(e)} value={eixos}>
                      <SelectTrigger id="eixos" className="w-full">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 eixos</SelectItem>
                        <SelectItem value="3">3 eixos</SelectItem>
                        <SelectItem value="4">4 eixos</SelectItem>
                        <SelectItem value="5">5 eixos</SelectItem>
                        <SelectItem value="6">6 eixos</SelectItem>
                        <SelectItem value="7">7 eixos</SelectItem>
                        <SelectItem value="8">8 eixos</SelectItem>
                        <SelectItem value="9">9 eixos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
                  <div>
                    <label className="flex items-center cursor-pointer w-full">
                      <span className="text-slate-700 select-none">Carga Parcial</span>
                      <input
                        type="checkbox"
                        checked={multiplasNfe}
                        onChange={() => setMultiplasNfe((state) => !state)}
                        className="sr-only"
                      />
                      <div className={`w-6 h-6 flex-shrink-0 rounded-lg border border-slate-300 flex items-center justify-center
                     transition-colors duration-200
                     ${multiplasNfe ? 'bg-sky-600 border-sky-600' : 'bg-white'}`}>
                        {multiplasNfe && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </label>
                  </div>
                  <div>
                    <div>
                      <Label htmlFor="pesoTotalCarga">Peso Total Carga (KG)</Label>
                      <Input
                        value={pesoTotalCarga}
                        id="pesoTotalCarga"
                        disabled={!multiplasNfe}
                        placeholder="Ex: 3500"
                        onChange={(e) => {
                          const value = e.target.value;
                          // Permite apenas números
                          if (/^\d*$/.test(value)) {
                            setPesoTotalCarga(value);
                          }
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="distancia">Peso Liquido (KG)</Label>
                      <Input
                        value={peso}
                        id="peso"
                        disabled={!multiplasNfe}
                        placeholder="Ex: 3500"
                        onChange={(e) => {
                          const value = e.target.value;
                          // Permite apenas números
                          if (/^\d*$/.test(value)) {
                            setPeso(value);
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="tipo">Tipo de carga</Label>
                    <Select value={tipoCarga} onValueChange={(e) => setTipoCarga(e)}>
                      <SelectTrigger id="tipo" className="w-full">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="geral">Geral</SelectItem>
                        <SelectItem value="granel_solido">Granel Solido</SelectItem>
                        <SelectItem value="granel_liquido">Granel Liquido</SelectItem>
                        <SelectItem value="frigorificada_aquecida">Frigorificada ou Aquecida</SelectItem>
                        <SelectItem value="conteinerizada">Conteinerizada</SelectItem>
                        <SelectItem value="neogranel">Neogranel</SelectItem>
                        <SelectItem value="perigosa_granel_solido">Perigosa Granel Solido</SelectItem>
                        <SelectItem value="perigosa_granel_liquido">Perigosa Granel Liquido</SelectItem>
                        <SelectItem value="perigosa_frigorificada_aquecida">Perigosa Frigorificada ou Aquecida</SelectItem>
                        <SelectItem value="perigosa_conteinerizada">Perigosa Conteinerizada</SelectItem>
                        <SelectItem value="perigosa_carga_geral">Perigosa Carga Geral</SelectItem>
                        <SelectItem value="carga_granel_pressurizada">Carga Granel Pressurizada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1">
                  <label className="flex items-center justify-between cursor-pointer w-full">
                    {/* Texto */}
                    <span className="text-slate-700 select-none">Retorno vazio</span>

                    {/* Checkbox customizado */}
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={tipoViagem}
                        onChange={() => setTipoViagem((state) => !state)}
                        className="sr-only"
                      />
                      <div
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-colors duration-200
                        ${tipoViagem ? 'bg-sky-600 border-sky-600' : 'bg-white border-slate-300'}`}
                      >
                        {tipoViagem && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer w-full">
                    <span className="text-slate-700 select-none">Composição veicular</span>
                    <input
                      type="checkbox"
                      checked={composicaoVeicular}
                      onChange={() => setComposicaoVeicular((state) => !state)}
                      className="sr-only"
                    />
                    <div className={`w-6 h-6 flex-shrink-0 rounded-lg border border-slate-300 flex items-center justify-center
                     transition-colors duration-200
                     ${composicaoVeicular ? 'bg-sky-600 border-sky-600' : 'bg-white'}`}>
                      {composicaoVeicular && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                  </label>
                  <label className="flex items-center justify-between cursor-pointer w-full">
                    <span className="text-slate-700 select-none">Alto desempenho</span>
                    <input
                      type="checkbox"
                      checked={altoDesempenho}
                      onChange={() => setAltoDesempenho((state) => !state)}
                      className="sr-only"
                    />
                    <div className={`w-6 h-6 flex-shrink-0 rounded-lg border border-slate-300 flex items-center justify-center
                     transition-colors duration-200
                     ${altoDesempenho ? 'bg-sky-600 border-sky-600' : 'bg-white'}`}>
                      {altoDesempenho && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </label>

                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={sumValue}>Calcular</Button>
                  <Button variant="ghost">Limpar</Button>
                </div>
              </div>
            </div>
            {/* Painel de resultado (ocupando 1 coluna) */}
            <aside className="col-span-1 bg-white rounded-2xl p-6 shadow-sm border flex flex-col gap-4">
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
                  <li>Base de Calculo {formatReais(resultado.base)}</li>
                  <li>ICMS 12% {formatReais(resultado.icms)}</li>
                  <li>Red. 20%{formatReais(resultado.reducao)}</li>
                  <li>ICMS Reduzido 20% {formatReais(resultado.icmsReduzido)}</li>
                  <li>Coeficiente CCD: {formatReais(resultado.ccd)} R$/km</li>
                  <li>Coeficiente CC: {formatReais(resultado.cc)} </li>
                  <li>BC: {formatReais(resultado.base)} x 12 = {formatReais(resultado.icms)} - RED 20% = {formatReais(resultado.icmsReduzido)} </li>
                </ul>
              </div>
              <div className="space-y-2  flex flex-col">
                <Button onClick={gerarDare} className="w-full">Gerar Dare</Button>
                <Button className="w-full">Copiar resultado</Button>
              </div>
            </aside>
          </section>
        </div>

      </div>
    </main>
  );
}

const formatReais = (value: number) => {
  return (value / 10000).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

