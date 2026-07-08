"use client"

import React, { ChangeEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Indice from './indice.json'
import axios from "axios";
import xml2js from "xml2js";

type ModoCarga = 'geral' | 'fracionada'

interface ParsedNfe {
  id: string
  numero: string
  destino: string
  origem: string
  peso: string
  distancia: string
  emit: any
  dest: any
  ide: any
}

interface Resultado {
  base: number
  icms: number
  icmsReduzido: number
  reducao: number
  ccd: number
  cc: number
}

interface NfeResultado {
  id: string
  numero: string
  peso: string
  base: number
  icms: number
  reducao: number
  icmsReduzido: number
}

const SCALE = 10000;

const parseNfeFile = (file: File): Promise<ParsedNfe> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (!content) {
        reject(new Error('Arquivo vazio'));
        return;
      }
      xml2js.parseString(content, { explicitArray: false }, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        try {
          const { NFe } = result.nfeProc
          const { dest, emit, ide, transp } = NFe.infNFe

          let pesoLiquido = 0;
          if (transp?.vol) {
            const volumes = Array.isArray(transp.vol) ? transp.vol : [transp.vol];
            pesoLiquido = volumes.reduce((acc: number, vol: any) => acc + (Number(vol.pesoL) || 0), 0);
          }

          resolve({
            id: `${ide.nNF}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            numero: String(ide.nNF),
            destino: `${dest.enderDest.xMun} - ${dest.enderDest.UF}`,
            origem: `${emit.enderEmit.xMun} - ${emit.enderEmit.UF}`,
            emit,
            dest,
            ide,
            peso: String(pesoLiquido).replace(/\D/g, ''),
            distancia: ''
          })
        } catch (parseError) {
          reject(parseError);
        }
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

const fetchDistanceKm = async (origem: string, destino: string): Promise<string> => {
  try {
    if (!origem || !destino) return '';
    const { data } = await axios.post('/api/', { body: { origem, destino } });
    const distanceValue = data.rows[0].elements[0].distance.value;
    return String(Number(Math.round(distanceValue / 1000)));
  } catch (error) {
    console.log(error);
    return '';
  }
}

const baixarDare = async (payload: Record<string, unknown>, filename: string) => {
  try {
    const response = await fetch('/api/dare', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('Failed to generate PDF');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("An error occurred while generating the PDF:", error);
  }
};

export default function Home() {
  const [modoCarga, setModoCarga] = useState<ModoCarga>('geral')
  const [origem, setOrigem] = useState<string>('')
  const [destino, setDestino] = useState<string>('')
  const [origemTouched, setOrigemTouched] = useState<boolean>(false)
  const [destinoTouched, setDestinoTouched] = useState<boolean>(false)
  const [distancia, setDistancia] = useState<string>('0')
  const [tipoCarga, setTipoCarga] = useState<string>('geral')
  const [tipoViagem, setTipoViagem] = useState<boolean>(false)
  const [composicaoVeicular, setComposicaoVeicular] = useState<boolean>(false)
  const [altoDesempenho, setAltoDesempenho] = useState<boolean>(false)
  const [eixos, setEixos] = useState<string>('4')
  const [peso, setPeso] = useState<string>('')
  const [pesoTotalCarga, setPesoTotalCarga] = useState<string>('');
  const [nfe, setNfe] = useState<ParsedNfe | null>(null)
  const [resultado, setResultado] = useState<Resultado>({ base: 0, icms: 0, icmsReduzido: 0, reducao: 0, ccd: 0, cc: 0 })

  const [nfes, setNfes] = useState<ParsedNfe[]>([])
  const [resultadosNfes, setResultadosNfes] = useState<NfeResultado[]>([])
  const [resultadoTotalFracionado, setResultadoTotalFracionado] = useState<Resultado>({ base: 0, icms: 0, icmsReduzido: 0, reducao: 0, ccd: 0, cc: 0 })

  const readXml = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const newNfe = await parseNfeFile(file);
      setNfe(newNfe)
      setDestino(newNfe.destino)
      setOrigem(newNfe.origem)
      setPeso(newNfe.peso)
    } catch (error) {
      console.error("Erro ao converter XML para JSON:", error);
    }
  }

  const readXmlMultiple = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      const parsed = await Promise.all(Array.from(files).map(parseNfeFile));
      const parsedComDistancia = await Promise.all(parsed.map(async (item) => ({
        ...item,
        distancia: await fetchDistanceKm(item.origem, item.destino)
      })));
      setNfes((prev) => [...prev, ...parsedComDistancia]);
    } catch (error) {
      console.error("Erro ao converter XML para JSON:", error);
    } finally {
      event.target.value = '';
    }
  }

  const updateNfe = (id: string, patch: Partial<ParsedNfe>) => {
    setNfes((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  const removeNfe = (id: string) => {
    setNfes((prev) => prev.filter((item) => item.id !== id));
    setResultadosNfes((prev) => prev.filter((item) => item.id !== id));
  }

  useEffect(() => {
    if (nfes.length === 0) return;
    if (!origemTouched) setOrigem(nfes[0].origem);
    if (!destinoTouched) setDestino(nfes[nfes.length - 1].destino);
  }, [nfes, origemTouched, destinoTouched]);

  useEffect(() => {
    const somaPesos = nfes.reduce((acc, item) => acc + (Number(item.peso) || 0), 0);
    setPesoTotalCarga(somaPesos ? String(somaPesos) : '');
  }, [nfes]);

  useEffect(() => {
    if (modoCarga !== 'fracionada') return;
    const maiorDistancia = nfes.reduce((acc, item) => Math.max(acc, Number(item.distancia) || 0), 0);
    setDistancia(maiorDistancia ? String(maiorDistancia) : '0');
  }, [nfes, modoCarga]);

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
      setOrigemTouched(true)
      setDestino(data.destination_addresses)
      setDestinoTouched(true)
      const distanceValue = data.rows[0].elements[0].distance.value;
      setDistancia(String(Number(Math.round(distanceValue / 1000))));
    } catch (error) {
      console.log(error)
    }
  }

  const calcularBaseTotal = () => {
    const data = Indice.find(item => item.tipo == tipoCarga);
    if (!data) return null;

    const ccd = (data.coeficientes.ccd as any)[eixos];
    const cc = (data.coeficientes.cc as any)[eixos];

    const ccdInt = Math.round(Number(ccd) * SCALE);
    const ccInt = Math.round(Number(cc) * SCALE);

    const distanciaInt = Math.round(Number(distancia));

    const baseCcdInt = ccdInt * distanciaInt; // unidades 1/10000 R$
    const totalInt = baseCcdInt + ccInt;      // soma em mesma unidade

    return { totalInt, ccdInt, ccInt };
  }

  const sumValue = () => {
    const baseTotal = calcularBaseTotal();
    if (!baseTotal) return;

    const { totalInt, ccdInt, ccInt } = baseTotal;
    const totalReais = totalInt / SCALE;

    const baseDeCalculoFinal = Math.round(totalReais * SCALE);
    const icms = Math.round(baseDeCalculoFinal * 0.12);
    const reducao = Math.round(icms * 0.20);
    const icmsReduzido = icms - reducao;

    setResultado({
      base: baseDeCalculoFinal,
      cc: ccInt,
      ccd: ccdInt,
      icms,
      icmsReduzido,
      reducao
    })
  }

  const sumValueFracionado = () => {
    const baseTotal = calcularBaseTotal();
    if (!baseTotal) return;

    const pesoTotal = Math.round(Number(pesoTotalCarga));
    if (!pesoTotal || nfes.length === 0) return;

    const { totalInt, ccdInt, ccInt } = baseTotal;
    const totalReais = totalInt / SCALE;
    const baseProporcionalPeso = totalReais / pesoTotal;

    const resultados: NfeResultado[] = nfes.map((item) => {
      const base = Math.round(Number(item.peso) * baseProporcionalPeso * SCALE);
      const icms = Math.round(base * 0.12);
      const reducao = Math.round(icms * 0.20);
      const icmsReduzido = icms - reducao;
      return { id: item.id, numero: item.numero, peso: item.peso, base, icms, reducao, icmsReduzido }
    });

    setResultadosNfes(resultados);
    setResultadoTotalFracionado({
      base: resultados.reduce((acc, item) => acc + item.base, 0),
      icms: resultados.reduce((acc, item) => acc + item.icms, 0),
      reducao: resultados.reduce((acc, item) => acc + item.reducao, 0),
      icmsReduzido: resultados.reduce((acc, item) => acc + item.icmsReduzido, 0),
      ccd: ccdInt,
      cc: ccInt
    })
  }

  const calcular = () => {
    if (modoCarga === 'geral') {
      sumValue();
    } else {
      sumValueFracionado();
    }
  }

  const gerarDare = async () => {
    if (!nfe?.emit || !nfe?.dest) return;

    await baixarDare({
      invoiceNumber: `${nfe.ide?.nNF}`,
      recipient: nfe.dest?.xNome,
      origin: `${nfe.emit.enderEmit.xMun} - ${nfe.emit.enderEmit.UF}`.toLocaleUpperCase(),
      destination: `${nfe.dest.enderDest.xMun} - ${nfe.dest.enderDest.UF}`.toLocaleUpperCase(),
      product: "ICMS - SERVIÇO TRANSPORTE DE CARGA",
      calculationBase: `BC ${formatReais(resultado.base)} x 12% = ${formatReais(resultado.icms)} - RED. DE 20% = ${formatReais(resultado.icmsReduzido)}`,
      value: formatReais(resultado.icmsReduzido),
      receiptCode: '1414'
    }, 'document.pdf');
  };

  const gerarDareNfe = async (item: ParsedNfe, resultadoNfe: NfeResultado) => {
    if (!item.emit || !item.dest) return;

    await baixarDare({
      invoiceNumber: `${item.numero}`,
      recipient: item.dest?.xNome,
      origin: `${item.emit.enderEmit.xMun} - ${item.emit.enderEmit.UF}`.toLocaleUpperCase(),
      destination: `${item.dest.enderDest.xMun} - ${item.dest.enderDest.UF}`.toLocaleUpperCase(),
      product: "ICMS - SERVIÇO TRANSPORTE DE CARGA",
      calculationBase: `BC ${formatReais(resultadoNfe.base)} x 12% = ${formatReais(resultadoNfe.icms)} - RED. DE 20% = ${formatReais(resultadoNfe.icmsReduzido)}`,
      value: formatReais(resultadoNfe.icmsReduzido),
      receiptCode: '1414'
    }, `dare-nfe-${item.numero}.pdf`);
  };

  const gerarTodosDares = async () => {
    for (const resultadoNfe of resultadosNfes) {
      const item = nfes.find((n) => n.id === resultadoNfe.id);
      if (!item) continue;
      await gerarDareNfe(item, resultadoNfe);
      await new Promise((resolve) => setTimeout(resolve, 400));
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
                <Tabs value={modoCarga} onValueChange={(value) => setModoCarga(value as ModoCarga)}>
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="geral">Carga Geral</TabsTrigger>
                    <TabsTrigger value="fracionada">Carga Fracionada</TabsTrigger>
                  </TabsList>
                </Tabs>

                {modoCarga === 'geral' ? (
                  <div className="grid grid-cols-1 md:grid-cols-1 gap-3 items-end">
                    <div className="flex flex-col">
                      <Label className="font-bold" htmlFor="xml-geral">Carregar XML</Label>
                      <Input type="file" id="xml-geral" onChange={readXml} name='xml'></Input>
                    </div>
                    <div>
                      <Label htmlFor="peso">Peso Líquido (KG)</Label>
                      <Input value={peso} id="peso" disabled placeholder="Ex: 3500" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-col">
                      <Label className="font-bold" htmlFor="xml-fracionada">Carregar XMLs (selecione vários ou adicione aos poucos)</Label>
                      <Input type="file" id="xml-fracionada" multiple onChange={readXmlMultiple} name='xmls'></Input>
                    </div>

                    {nfes.length > 0 && (
                      <div className="border rounded-lg divide-y">
                        {nfes.map((item) => (
                          <div key={item.id} className="px-3 py-3 text-sm space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">NFe {item.numero}</div>
                                <div className="text-slate-500">{item.origem} → {item.destino}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeNfe(item.id)}
                                className="text-red-500 hover:text-red-700 text-xs font-medium"
                              >
                                Remover
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs" htmlFor={`peso-${item.id}`}>Peso (KG)</Label>
                                <Input
                                  id={`peso-${item.id}`}
                                  value={item.peso}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (/^\d*$/.test(value)) updateNfe(item.id, { peso: value });
                                  }}
                                />
                              </div>
                              <div>
                                <Label className="text-xs" htmlFor={`distancia-${item.id}`}>Distância (km)</Label>
                                <Input
                                  id={`distancia-${item.id}`}
                                  value={item.distancia}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (/^\d*$/.test(value)) updateNfe(item.id, { distancia: value });
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div>
                      <Label htmlFor="pesoTotalCarga">Peso Total da Carga (KG)</Label>
                      <Input value={pesoTotalCarga} id="pesoTotalCarga" disabled placeholder="Ex: 3500" />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">

                  <div>
                    <Label htmlFor="origem">Origem (Cidade)</Label>
                    <Input
                      onChange={(e) => { setOrigem(e.target.value); setOrigemTouched(true); }}
                      value={origem}
                      id="origem"
                      placeholder="Ex: Candeias do Jamari - RO"
                    />
                    {modoCarga === 'fracionada' && (
                      <p className="text-xs text-slate-400 mt-1">Cidade do 1º carregamento</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="destino">Destino (Cidade)</Label>
                    <Input
                      onChange={(e) => { setDestino(e.target.value); setDestinoTouched(true); }}
                      value={destino}
                      id="destino"
                      placeholder="Ex: Itajaí - SC"
                    />
                    {modoCarga === 'fracionada' && (
                      <p className="text-xs text-slate-400 mt-1">Cidade do último descarregamento</p>
                    )}
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
                    {modoCarga === 'fracionada' && (
                      <p className="text-xs text-slate-400 mt-1">Maior distância entre as NFes</p>
                    )}
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
                  <Button onClick={calcular}>Calcular</Button>
                  <Button variant="ghost">Limpar</Button>
                </div>
              </div>
            </div>
            {/* Painel de resultado (ocupando 1 coluna) */}
            <aside className="col-span-1 bg-white rounded-2xl p-6 shadow-sm border flex flex-col gap-4">
              {modoCarga === 'geral' ? (
                <>
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
                      <li>BC: {formatReais(resultado.base)} x 12% = {formatReais(resultado.icms)} - RED DE 20% = {formatReais(resultado.icmsReduzido)} </li>
                    </ul>
                  </div>
                  <div className="space-y-2  flex flex-col">
                    <Button onClick={gerarDare} className="w-full">Gerar Dare</Button>
                    <Button className="w-full">Copiar resultado</Button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm text-slate-500">Resultado</h3>
                    <div className="mt-3">
                      <div className="text-xs text-slate-400">Frete mínimo (total da carga)</div>
                      <div className="text-3xl font-semibold">{formatReais(resultadoTotalFracionado.base)}</div>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-xs text-slate-400">Detalhes</div>
                    <ul className="mt-2 text-sm text-slate-700 space-y-1">
                      <li>Distância: {distancia} km</li>
                      <li>Eixos: {eixos}</li>
                      <li>NFes: {nfes.length}</li>
                      <li>ICMS 12% {formatReais(resultadoTotalFracionado.icms)}</li>
                      <li>Red. 20% {formatReais(resultadoTotalFracionado.reducao)}</li>
                      <li>ICMS Reduzido {formatReais(resultadoTotalFracionado.icmsReduzido)}</li>
                    </ul>
                  </div>
                  <div className="space-y-2 flex flex-col">
                    <Button onClick={gerarTodosDares} disabled={resultadosNfes.length === 0} className="w-full">Gerar Todos os Dares</Button>
                  </div>
                </>
              )}
            </aside>

            {modoCarga === 'fracionada' && resultadosNfes.length > 0 && (
              <div className="col-span-2 lg:col-span-3 bg-white rounded-2xl p-6 shadow-sm border overflow-x-auto">
                <h2 className="text-lg font-medium mb-4">Base de Cálculo por NFe</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b">
                      <th className="py-2 pr-3">NFe</th>
                      <th className="py-2 pr-3">Peso (kg)</th>
                      <th className="py-2 pr-3">Base de Cálculo</th>
                      <th className="py-2 pr-3">ICMS 12%</th>
                      <th className="py-2 pr-3">Red. 20%</th>
                      <th className="py-2 pr-3">ICMS Reduzido</th>
                      <th className="py-2 pr-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultadosNfes.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-medium">{item.numero}</td>
                        <td className="py-2 pr-3">{Number(item.peso || 0).toLocaleString('pt-BR')}</td>
                        <td className="py-2 pr-3">{formatReais(item.base)}</td>
                        <td className="py-2 pr-3">{formatReais(item.icms)}</td>
                        <td className="py-2 pr-3">{formatReais(item.reducao)}</td>
                        <td className="py-2 pr-3">{formatReais(item.icmsReduzido)}</td>
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            className="text-sky-600 hover:text-sky-800 text-xs font-medium"
                            onClick={() => {
                              const parsedNfe = nfes.find((n) => n.id === item.id);
                              if (parsedNfe) gerarDareNfe(parsedNfe, item);
                            }}
                          >
                            Gerar Dare
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold border-t">
                      <td className="py-2 pr-3">Total</td>
                      <td className="py-2 pr-3">{resultadosNfes.reduce((acc, item) => acc + Number(item.peso || 0), 0).toLocaleString('pt-BR')}</td>
                      <td className="py-2 pr-3">{formatReais(resultadoTotalFracionado.base)}</td>
                      <td className="py-2 pr-3">{formatReais(resultadoTotalFracionado.icms)}</td>
                      <td className="py-2 pr-3">{formatReais(resultadoTotalFracionado.reducao)}</td>
                      <td className="py-2 pr-3">{formatReais(resultadoTotalFracionado.icmsReduzido)}</td>
                      <td className="py-2 pr-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </div>

      </div>
    </main>
  );
}

const formatReais = (value: number) => {
  return (value / 10000).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
