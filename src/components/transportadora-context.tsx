'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CHAVES, gravarJson, gravarTexto, lerJson, lerTexto, novoId } from '@/lib/armazenamento'
import { emitirDare, ResultadoEmissao } from '@/lib/dare-client'
import type { TransportadoraDados } from '@/lib/transportadora-schema'
import type { DareForm, DareRegistro, Transportadora } from '@/lib/types'

// Quantos DAREs o histórico guarda. Os mais antigos saem primeiro.
const LIMITE_HISTORICO = 300

type Salvamento = { ok: true; transportadora: Transportadora } | { ok: false; error: string }

interface DadosLocais {
  carregando: boolean
  transportadoras: Transportadora[]
  ativas: Transportadora[]
  ativa: Transportadora | null
  setAtivaId: (id: string) => void
  salvarTransportadora: (dados: TransportadoraDados, id?: string) => Salvamento
  alternarAtiva: (id: string) => void
  removerTransportadora: (id: string) => void
  dares: DareRegistro[]
  emitir: (transportadora: Transportadora, form: DareForm) => Promise<ResultadoEmissao>
  // Para guias que não passam pelo emitir (ex.: DAR do FETHAB).
  registrarGuia: (registro: Omit<DareRegistro, 'id' | 'createdAt'>) => void
  limparHistorico: () => void
}

const Contexto = createContext<DadosLocais | null>(null)

export function TransportadoraProvider({ children }: { children: React.ReactNode }) {
  const [carregando, setCarregando] = useState(true)
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([])
  const [dares, setDares] = useState<DareRegistro[]>([])
  const [ativaId, setAtivaIdState] = useState<string | null>(null)
  const listaRef = useRef<Transportadora[]>([])
  listaRef.current = transportadoras

  // O local storage só existe no navegador, então carrega depois de montar.
  // O evento "storage" mantém outras abas abertas em sincronia.
  useEffect(() => {
    const carregar = () => {
      setTransportadoras(lerJson<Transportadora[]>(CHAVES.transportadoras, []))
      setDares(lerJson<DareRegistro[]>(CHAVES.historico, []))
      setAtivaIdState(lerTexto(CHAVES.ativa))
      setCarregando(false)
    }
    carregar()
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith('icms-ro:')) carregar()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const gravarLista = useCallback((lista: Transportadora[]) => {
    listaRef.current = lista
    setTransportadoras(lista)
    gravarJson(CHAVES.transportadoras, lista)
  }, [])

  const ativas = useMemo(() => transportadoras.filter(t => t.ativa), [transportadoras])
  // Usa a escolhida se ela ainda estiver ativa. Senão, a primeira ativa.
  const ativa = ativas.find(t => t.id === ativaId) ?? ativas[0] ?? null

  const setAtivaId = useCallback((id: string) => {
    setAtivaIdState(id)
    gravarTexto(CHAVES.ativa, id)
  }, [])

  const salvarTransportadora = useCallback((dados: TransportadoraDados, id?: string): Salvamento => {
    const lista = listaRef.current
    if (id) {
      const atual = lista.find(t => t.id === id)
      if (!atual) return { ok: false, error: 'Transportadora não encontrada' }
      // O CNPJ não muda na edição.
      const editada: Transportadora = { ...atual, ...dados, cnpj: atual.cnpj }
      gravarLista(lista.map(t => (t.id === id ? editada : t)))
      return { ok: true, transportadora: editada }
    }
    if (lista.some(t => t.cnpj === dados.cnpj)) {
      return { ok: false, error: 'Esta transportadora já está cadastrada' }
    }
    const nova: Transportadora = { ...dados, id: novoId(), ativa: true, criadaEm: new Date().toISOString() }
    gravarLista([...lista, nova])
    return { ok: true, transportadora: nova }
  }, [gravarLista])

  const alternarAtiva = useCallback((id: string) => {
    gravarLista(listaRef.current.map(t => (t.id === id ? { ...t, ativa: !t.ativa } : t)))
  }, [gravarLista])

  // O histórico guarda uma cópia do nome e do CNPJ, então continua legível.
  const removerTransportadora = useCallback((id: string) => {
    gravarLista(listaRef.current.filter(t => t.id !== id))
  }, [gravarLista])

  const registrar = useCallback((registro: DareRegistro) => {
    setDares(atual => {
      const proximo = [registro, ...atual].slice(0, LIMITE_HISTORICO)
      gravarJson(CHAVES.historico, proximo)
      return proximo
    })
  }, [])

  const emitir = useCallback(async (t: Transportadora, form: DareForm) => {
    const resultado = await emitirDare(t, form)
    registrar({
      id: novoId(),
      createdAt: new Date().toISOString(),
      ferramenta: 'icms-frete-ro',
      status: resultado.ok ? 'EMITIDO' : 'ERRO',
      transportadoraId: t.id,
      transportadora: { cnpj: t.cnpj, razaoSocial: t.razaoSocial, nomeFantasia: t.nomeFantasia },
      notaFiscal: form.notaFiscal,
      destinatario: form.destinatario || null,
      origem: form.origem || null,
      destino: form.destino || null,
      produto: form.produto || null,
      baseCalculoTexto: form.baseCalculoTexto || null,
      valorBase: form.valorBase,
      valorIcms: form.valorIcms,
      codigoReceita: form.codigoReceita,
      dataVencimento: (resultado.ok && resultado.dataVencimento) || form.dataVencimento || null,
      mesReferencia: (resultado.ok && resultado.mesReferencia) || form.mesReferencia || null,
      linhaDigitavel: resultado.ok ? resultado.linhaDigitavel : null,
      erro: resultado.ok ? null : resultado.error,
    })
    return resultado
  }, [registrar])

  const registrarGuia = useCallback((registro: Omit<DareRegistro, 'id' | 'createdAt'>) => {
    registrar({ ...registro, id: novoId(), createdAt: new Date().toISOString() })
  }, [registrar])

  const limparHistorico = useCallback(() => {
    setDares([])
    gravarJson(CHAVES.historico, [])
  }, [])

  return (
    <Contexto.Provider
      value={{
        carregando, transportadoras, ativas, ativa, setAtivaId,
        salvarTransportadora, alternarAtiva, removerTransportadora,
        dares, emitir, registrarGuia, limparHistorico,
      }}
    >
      {children}
    </Contexto.Provider>
  )
}

export function useTransportadoras() {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useTransportadoras precisa estar dentro de TransportadoraProvider')
  return ctx
}
