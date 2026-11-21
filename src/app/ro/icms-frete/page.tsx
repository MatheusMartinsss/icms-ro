"use client"

import React, { ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { registrarEvento } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DareDialog, { DareInicial } from "@/components/dare-dialog";
import { useTransportadoras } from "@/components/transportadora-context";
import {
  PARAMETROS_PADRAO,
  SCALE,
  TIPOS_CARGA,
  calcularBaseTotal as calcularBaseTabela,
  calcularIcms,
  eixosDisponiveis,
  formatPercent,
  formatReais,
  paraReais,
  textoBaseCalculo,
} from "@/lib/calculo";
import { currentMonthYear, defaultDueDate } from "@/lib/datas";
import TransportadoraDialog from "@/components/transportadora-dialog";
import type { Transportadora } from "@/lib/types";
import axios from "axios";
import xml2js from "xml2js";

type ModoCarga = 'geral' | 'fracionada'

interface ParsedNfe {
  id: string
  numero: string
  destinatario: string
  destino: string
  origem: string
  peso: string
  distancia: string
  emit?: any
  dest?: any
  ide?: any
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
            destinatario: dest?.xNome || '',
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

export default function IcmsFretePage() {
  const { ativa, setAtivaId, emitir } = useTransportadoras()
  // Alíquota e redução vêm da transportadora selecionada. Sem nenhuma
  // cadastrada, usa o padrão antigo (12% com redução de 20%).
  const parametros = useMemo(
    () => ativa ? { aliquotaIcms: ativa.aliquotaIcms, percentualReducao: ativa.percentualReducao } : PARAMETROS_PADRAO,
    [ativa]
  )
  const [dareInicial, setDareInicial] = useState<DareInicial | null>(null)
  const [emitindoTodos, setEmitindoTodos] = useState(false)
  // Aberto quando a pessoa pede todos os DAREs sem ter transportadora.
  const [pedirTransportadora, setPedirTransportadora] = useState(false)

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
  const [rateioPorPeso, setRateioPorPeso] = useState<boolean>(false)
  const [pesoTotalCargaGeral, setPesoTotalCargaGeral] = useState<string>('');
  const [baseManual, setBaseManual] = useState<string>('');
  const [nfe, setNfe] = useState<ParsedNfe | null>(null)
  const [resultado, setResultado] = useState<Resultado>({ base: 0, icms: 0, icmsReduzido: 0, reducao: 0, ccd: 0, cc: 0 })

  const [nfes, setNfes] = useState<ParsedNfe[]>([])
  const [resultadosNfes, setResultadosNfes] = useState<NfeResultado[]>([])
  const [resultadoTotalFracionado, setResultadoTotalFracionado] = useState<Resultado>({ base: 0, icms: 0, icmsReduzido: 0, reducao: 0, ccd: 0, cc: 0 })

  const nfeManualVazia = { numero: '', destinatario: '', peso: '', origem: '', destino: '' }
  const [nfeManual, setNfeManual] = useState(nfeManualVazia)

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
      toast.error("Não foi possível ler o XML", { description: "Confira se é o XML autorizado da NFe (nfeProc)." });
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
      toast.error("Não foi possível ler um dos XMLs", { description: "Confira se são XMLs autorizados de NFe (nfeProc)." });
    } finally {
      event.target.value = '';
    }
  }

  const addNfeManual = async () => {
    if (!nfeManual.numero || !nfeManual.peso) return;

    const distancia = await fetchDistanceKm(nfeManual.origem, nfeManual.destino);
    const novaNfe: ParsedNfe = {
      id: `manual-${nfeManual.numero}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      numero: nfeManual.numero,
      destinatario: nfeManual.destinatario,
      origem: nfeManual.origem,
      destino: nfeManual.destino,
      peso: nfeManual.peso.replace(/\D/g, ''),
      distancia,
    };

    setNfes((prev) => [...prev, novaNfe]);
    setNfeManual(nfeManualVazia);
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
      toast.error("Não foi possível calcular a distância", { description: "Confira as cidades ou digite a distância." });
    }
  }

  const eixosOpcoes = useMemo(() => eixosDisponiveis(tipoCarga), [tipoCarga])

  // Se o tipo de carga não tem a quantidade de eixos escolhida, troca para a
  // mais próxima disponível em vez de calcular com coeficiente inexistente.
  useEffect(() => {
    if (eixosOpcoes.length && !eixosOpcoes.includes(eixos)) {
      const proxima = eixosOpcoes.find((e) => Number(e) >= Number(eixos)) ?? eixosOpcoes[eixosOpcoes.length - 1]
      setEixos(proxima)
    }
  }, [eixosOpcoes, eixos])

  // Trocar de transportadora recalcula o ICMS com a alíquota e redução dela.
  useEffect(() => {
    setResultado((prev) => ({ ...prev, ...calcularIcms(prev.base, parametros) }))
    setResultadosNfes((prev) => prev.map((item) => ({ ...item, ...calcularIcms(item.base, parametros) })))
  }, [parametros])

  useEffect(() => {
    setResultadoTotalFracionado((prev) => ({
      ...prev,
      base: resultadosNfes.reduce((acc, item) => acc + item.base, 0),
      icms: resultadosNfes.reduce((acc, item) => acc + item.icms, 0),
      reducao: resultadosNfes.reduce((acc, item) => acc + item.reducao, 0),
      icmsReduzido: resultadosNfes.reduce((acc, item) => acc + item.icmsReduzido, 0),
    }))
  }, [resultadosNfes])

  const calcularBaseTotal = () => {
    const baseTotal = calcularBaseTabela(tipoCarga, eixos, distancia);
    if (!baseTotal) toast.error(`A tabela não tem coeficiente para ${eixos} eixos neste tipo de carga`);
    return baseTotal;
  }

  const sumValue = () => {
    const baseTotal = calcularBaseTotal();
    if (!baseTotal) return;

    const { totalInt, ccdInt, ccInt } = baseTotal;
    const totalReais = totalInt / SCALE;

    let baseDeCalculoFinal: number;
    if (rateioPorPeso) {
      const pesoTotalInt = Math.round(Number(pesoTotalCargaGeral));
      if (!pesoTotalInt) {
        toast.error("Informe o peso total da carga para ratear");
        return;
      }
      const baseProporcionalPeso = totalReais / pesoTotalInt;
      baseDeCalculoFinal = Math.round(Number(peso) * baseProporcionalPeso * SCALE);
    } else {
      baseDeCalculoFinal = Math.round(totalReais * SCALE);
    }
    const { icms, reducao, icmsReduzido } = calcularIcms(baseDeCalculoFinal, parametros);

    setResultado({
      base: baseDeCalculoFinal,
      cc: ccInt,
      ccd: ccdInt,
      icms,
      icmsReduzido,
      reducao
    })
    setBaseManual((baseDeCalculoFinal / SCALE).toFixed(2))
  }

  const ajustarBaseManual = (value: string) => {
    if (!/^\d*[.,]?\d{0,2}$/.test(value)) return;
    setBaseManual(value);

    const baseReais = Number(value.replace(',', '.'));
    if (!value || Number.isNaN(baseReais)) return;

    const baseDeCalculoFinal = Math.round(baseReais * SCALE);
    const { icms, reducao, icmsReduzido } = calcularIcms(baseDeCalculoFinal, parametros);

    setResultado((prev) => ({ ...prev, base: baseDeCalculoFinal, icms, reducao, icmsReduzido }));
  }

  const sumValueFracionado = () => {
    const baseTotal = calcularBaseTotal();
    if (!baseTotal) return;

    const pesoTotal = Math.round(Number(pesoTotalCarga));
    if (!pesoTotal || nfes.length === 0) {
      toast.error(nfes.length === 0 ? "Adicione as NFes da carga" : "Informe o peso total da carga");
      return;
    }

    const { totalInt, ccdInt, ccInt } = baseTotal;
    const totalReais = totalInt / SCALE;
    const baseProporcionalPeso = totalReais / pesoTotal;

    const resultados: NfeResultado[] = nfes.map((item) => {
      const base = Math.round(Number(item.peso) * baseProporcionalPeso * SCALE);
      return { id: item.id, numero: item.numero, peso: item.peso, base, ...calcularIcms(base, parametros) }
    });

    // Os totais são somados pelo efeito que observa resultadosNfes.
    setResultadosNfes(resultados);
    setResultadoTotalFracionado((prev) => ({ ...prev, ccd: ccdInt, cc: ccInt }))
  }

  const calcular = () => {
    if (modoCarga === 'geral') {
      sumValue();
    } else {
      sumValueFracionado();
    }
  }

  // Abre o formulário do DARE já preenchido. Sem XML, os campos podem ser
  // digitados à mão no próprio formulário.
  const gerarDare = () => {
    if (resultado.icmsReduzido <= 0) {
      toast.error("Calcule o ICMS antes de gerar o DARE");
      return;
    }
    setDareInicial({
      notaFiscal: nfe?.numero ?? '',
      destinatario: nfe?.destinatario ?? '',
      origem: nfe?.origem ?? origem,
      destino: nfe?.destino ?? destino,
      baseCalculoTexto: textoBaseCalculo(resultado, parametros),
      valorBase: paraReais(resultado.base),
      valorIcms: paraReais(resultado.icmsReduzido),
    });
  };

  const dadosDareNfe = (item: ParsedNfe, resultadoNfe: NfeResultado) => ({
    notaFiscal: item.numero,
    destinatario: item.destinatario,
    origem: item.origem.toLocaleUpperCase('pt-BR'),
    destino: item.destino.toLocaleUpperCase('pt-BR'),
    baseCalculoTexto: textoBaseCalculo(resultadoNfe, parametros),
    valorBase: paraReais(resultadoNfe.base),
    valorIcms: paraReais(resultadoNfe.icmsReduzido),
  });

  const gerarDareNfe = (item: ParsedNfe, resultadoNfe: NfeResultado) => {
    setDareInicial(dadosDareNfe(item, resultadoNfe));
  };

  // Emite um DARE por NFe, em sequência, e mostra no fim quais falharam.
  // Recebe a transportadora recém-cadastrada quando vem do pedido de dados.
  const gerarTodosDares = async (transportadora: Transportadora | null = ativa) => {
    if (!transportadora) {
      setPedirTransportadora(true);
      return;
    }
    const t = transportadora;
    const nome = t.nomeFantasia || t.razaoSocial;
    if (!window.confirm(`Emitir ${resultadosNfes.length} DARE(s) na SEFIN em nome de ${nome}?`)) return;

    setEmitindoTodos(true);
    const falhas: string[] = [];
    const dataVencimento = defaultDueDate();
    const mesReferencia = currentMonthYear();
    try {
      for (const resultadoNfe of resultadosNfes) {
        const item = nfes.find((n) => n.id === resultadoNfe.id);
        if (!item) continue;
        const toastId = toast.loading(`Emitindo DARE da NF ${item.numero}…`);
        const result = await emitir(t, {
          ...dadosDareNfe(item, resultadoNfe),
          produto: t.produtoDare,
          codigoReceita: t.codigoReceita,
          dataVencimento,
          mesReferencia,
        });
        if (result.ok) {
          toast.success(`DARE da NF ${item.numero} emitido`, { id: toastId });
          registrarEvento("dare-ro-emitido", { origem: "nfe" });
        } else {
          falhas.push(item.numero);
          registrarEvento("dare-ro-erro", { origem: "nfe" });
          toast.error(`NF ${item.numero}: ${result.error}`, { id: toastId, duration: 15000 });
        }
      }
    } finally {
      setEmitindoTodos(false);
    }
    if (falhas.length) {
      toast.warning(`${falhas.length} DARE(s) não foram emitidos: NF ${falhas.join(', ')}`, {
        description: 'Tente de novo pelo Histórico.',
        duration: 20000,
      });
    }
  };

  const copiarResultado = async () => {
    if (resultado.base <= 0) {
      toast.error("Calcule o ICMS primeiro");
      return;
    }
    try {
      await navigator.clipboard.writeText(textoBaseCalculo(resultado, parametros));
      toast.success("Resultado copiado");
      registrarEvento("icms-ro-copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const aliquotaLabel = `${formatPercent(parametros.aliquotaIcms)}%`;
  const reducaoLabel = `${formatPercent(parametros.percentualReducao)}%`;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Top bar */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rondônia · DARE SEFIN-RO</p>
              <h1 className="text-2xl font-semibold">ICMS Frete</h1>
              <p className="text-sm text-slate-500">
                ICMS {aliquotaLabel} com redução de {reducaoLabel}
                {ativa ? ` · ${ativa.nomeFantasia || ativa.razaoSocial}` : ' · padrão (nenhuma empresa selecionada)'}
              </p>
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
                      <Input
                        value={peso}
                        id="peso"
                        placeholder="Ex: 3500"
                        onChange={(e) => {
                          const value = e.target.value;
                          if (/^\d*$/.test(value)) {
                            setPeso(value);
                          }
                        }}
                      />
                    </div>

                    <label className="flex items-center justify-between cursor-pointer w-full">
                      <span className="text-slate-700 select-none">Esta NFe faz parte de uma carga com outras notas (ratear proporcional ao peso)</span>
                      <input
                        type="checkbox"
                        checked={rateioPorPeso}
                        onChange={() => setRateioPorPeso((state) => !state)}
                        className="sr-only"
                      />
                      <div
                        className={`w-6 h-6 flex-shrink-0 rounded-lg border flex items-center justify-center transition-colors duration-200
                        ${rateioPorPeso ? 'bg-sky-600 border-sky-600' : 'bg-white border-slate-300'}`}
                      >
                        {rateioPorPeso && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </label>

                    {rateioPorPeso && (
                      <div>
                        <Label htmlFor="pesoTotalCargaGeral">Peso Total da Carga (KG)</Label>
                        <Input
                          value={pesoTotalCargaGeral}
                          id="pesoTotalCargaGeral"
                          placeholder="Ex: 10000"
                          onChange={(e) => {
                            const value = e.target.value;
                            if (/^\d*$/.test(value)) {
                              setPesoTotalCargaGeral(value);
                            }
                          }}
                        />
                        <p className="text-xs text-slate-400 mt-1">Peso total de todas as NFes da carga (o imposto será calculado proporcional ao peso desta NFe)</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-col">
                      <Label className="font-bold" htmlFor="xml-fracionada">Carregar XMLs (selecione vários ou adicione aos poucos)</Label>
                      <Input type="file" id="xml-fracionada" multiple onChange={readXmlMultiple} name='xmls'></Input>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-xs text-slate-400">ou adicione manualmente</span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>

                    <div className="border rounded-lg p-3 space-y-3 bg-slate-50">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs" htmlFor="manual-numero">Número da NFe</Label>
                          <Input
                            id="manual-numero"
                            value={nfeManual.numero}
                            placeholder="Ex: 12345"
                            onChange={(e) => {
                              const value = e.target.value;
                              if (/^\d*$/.test(value)) setNfeManual((s) => ({ ...s, numero: value }));
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs" htmlFor="manual-peso">Peso (KG)</Label>
                          <Input
                            id="manual-peso"
                            value={nfeManual.peso}
                            placeholder="Ex: 3500"
                            onChange={(e) => {
                              const value = e.target.value;
                              if (/^\d*$/.test(value)) setNfeManual((s) => ({ ...s, peso: value }));
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs" htmlFor="manual-destinatario">Destinatário</Label>
                        <Input
                          id="manual-destinatario"
                          value={nfeManual.destinatario}
                          placeholder="Nome do destinatário"
                          onChange={(e) => setNfeManual((s) => ({ ...s, destinatario: e.target.value }))}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs" htmlFor="manual-origem">Cidade de Origem</Label>
                          <Input
                            id="manual-origem"
                            value={nfeManual.origem}
                            placeholder="Ex: Candeias do Jamari - RO"
                            onChange={(e) => setNfeManual((s) => ({ ...s, origem: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label className="text-xs" htmlFor="manual-destino">Cidade de Destino</Label>
                          <Input
                            id="manual-destino"
                            value={nfeManual.destino}
                            placeholder="Ex: Itajaí - SC"
                            onChange={(e) => setNfeManual((s) => ({ ...s, destino: e.target.value }))}
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={addNfeManual}
                        disabled={!nfeManual.numero || !nfeManual.peso}
                        className="w-full"
                      >
                        Adicionar NFe
                      </Button>
                    </div>

                    {nfes.length > 0 && (
                      <div className="border rounded-lg divide-y">
                        {nfes.map((item) => (
                          <div key={item.id} className="px-3 py-3 text-sm space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">NFe {item.numero}</div>
                                {item.destinatario && <div className="text-slate-500">{item.destinatario}</div>}
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
                      <Input
                        value={pesoTotalCarga}
                        id="pesoTotalCarga"
                        placeholder="Ex: 3500"
                        onChange={(e) => {
                          const value = e.target.value;
                          if (/^\d*$/.test(value)) {
                            setPesoTotalCarga(value);
                          }
                        }}
                      />
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
                        {eixosOpcoes.map((eixo) => (
                          <SelectItem key={eixo} value={eixo}>{eixo} eixos</SelectItem>
                        ))}
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
                        {TIPOS_CARGA.map((tipo) => (
                          <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
                        ))}
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
                      <Label htmlFor="baseManual" className="text-xs text-slate-400">Base de Cálculo (R$) — ajustável</Label>
                      <Input
                        id="baseManual"
                        className="text-3xl font-semibold h-auto py-1 px-2"
                        value={baseManual}
                        onChange={(e) => ajustarBaseManual(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-xs text-slate-400">Detalhes</div>
                    <ul className="mt-2 text-sm text-slate-700 space-y-1">
                      <li>Distância: {distancia} km</li>
                      <li>Eixos: {eixos}</li>
                      <li>Base de Calculo {formatReais(resultado.base)}</li>
                      <li>ICMS {aliquotaLabel} {formatReais(resultado.icms)}</li>
                      <li>Red. {reducaoLabel} {formatReais(resultado.reducao)}</li>
                      <li>ICMS Reduzido {formatReais(resultado.icmsReduzido)}</li>
                      <li>Coeficiente CCD: {formatReais(resultado.ccd)} R$/km</li>
                      <li>Coeficiente CC: {formatReais(resultado.cc)} </li>
                      <li>{textoBaseCalculo(resultado, parametros)}</li>
                    </ul>
                  </div>
                  <div className="space-y-2  flex flex-col">
                    <Button onClick={gerarDare} className="w-full">Gerar Dare</Button>
                    <Button variant="outline" onClick={copiarResultado} className="w-full">Copiar resultado</Button>
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
                      <li>ICMS {aliquotaLabel} {formatReais(resultadoTotalFracionado.icms)}</li>
                      <li>Red. {reducaoLabel} {formatReais(resultadoTotalFracionado.reducao)}</li>
                      <li>ICMS Reduzido {formatReais(resultadoTotalFracionado.icmsReduzido)}</li>
                    </ul>
                  </div>
                  <div className="space-y-2 flex flex-col">
                    <Button onClick={() => gerarTodosDares()}disabled={resultadosNfes.length === 0 || emitindoTodos} className="w-full">
                      {emitindoTodos ? 'Emitindo…' : 'Gerar Todos os Dares'}
                    </Button>
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
                      <th className="py-2 pr-3">ICMS {aliquotaLabel}</th>
                      <th className="py-2 pr-3">Red. {reducaoLabel}</th>
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
      <DareDialog
        open={!!dareInicial}
        onOpenChange={(open) => !open && setDareInicial(null)}
        inicial={dareInicial}
      />
      <TransportadoraDialog
        open={pedirTransportadora}
        onOpenChange={setPedirTransportadora}
        onSaved={(t) => {
          setAtivaId(t.id);
          gerarTodosDares(t);
        }}
      />
    </main>
  );
}
