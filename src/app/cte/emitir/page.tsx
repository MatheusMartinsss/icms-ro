'use client'

import { ChangeEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import xml2js from 'xml2js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import axios from 'axios'
import { toast } from 'sonner'
import { emitirCte, imprimirCte } from '@/services/cte'
import { CtePartesBuilder } from '@/lib/cte/cte'
import Indice from '../../indice.json'
import { useEmpresaConfig } from '@/components/configuracoes-empresa'

// ─── Schema ──────────────────────────────────────────────────────────────────

const parteSchema = z.object({
    xNome:   z.string().min(1, 'Obrigatório'),
    cnpj:    z.string(),
    cpf:     z.string(),
    ie:      z.string(),
    fone:    z.string(),
    email:   z.string(),
    xLgr:    z.string(),
    nro:     z.string(),
    xBairro: z.string(),
    cMun:    z.string(),
    xMun:    z.string(),
    uf:      z.string(),
    cep:     z.string(),
}).refine(d => d.cnpj.length >= 11 || d.cpf.length >= 11, {
    message: 'Informe o CNPJ ou CPF',
    path: ['cnpj'],
})

const schema = z.object({
    rem:  parteSchema,
    dest: parteSchema,
    toma: z.string(),
    carga: z.object({
        proPred: z.string().min(1, 'Obrigatório'),
        peso:    z.string(),
        vCarga:  z.string(),
        rntrc:   z.string()
            .min(1, 'Obrigatório')
            .regex(/^([0-9]{8}|ISENTO)$/, 'Deve ter 8 dígitos ou "ISENTO"'),
    }),
    trib: z.object({
        vTPrest: z.string().refine(v => Number(v) > 0, 'Obrigatório'),
        pICMS:   z.string(),
        cst:     z.string(),
    }),
    obs: z.string(),
})

type FormValues = z.infer<typeof schema>

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Status = 'idle' | 'loading' | 'success' | 'error'

const DEFAULT_OBS = 'TRANSPORTE SUBCONTRATADO NOS TERMOS DO ANEXO XIII - PARTE 01 - CAPÍTULO 01 - SUBSEÇÃO 01 - ARTIGO 40 - DECRETO22.721/2018.CRÉDITO PRESUMIDO EM 20%,CONFORME ANEXO IV - PARTE 02 - ITEM 03 - SEÇÃO VI - ARTIGO 10 - DECRETO 22.721/2018.'

const emptyParte = () => ({
    xNome: '', cnpj: '', cpf: '', ie: '', fone: '', email: '',
    xLgr: '', nro: '', xBairro: '', cMun: '', xMun: '', uf: '', cep: '',
})

function defaultValues(): FormValues {
    return {
        rem:  emptyParte(),
        dest: emptyParte(),
        toma: '3',
        carga: { proPred: 'MADEIRA', peso: '', vCarga: '', rntrc: '' },
        trib:  { vTPrest: '', pICMS: '12', cst: '00' },
        obs:   DEFAULT_OBS,
    }
}

function parteFromEmit(emit: any) {
    const e = emit?.enderEmit ?? {}
    return {
        xNome:   emit?.xNome ?? '',
        cnpj:    String(emit?.CNPJ ?? '').replace(/\D/g, ''),
        cpf:     String(emit?.CPF  ?? '').replace(/\D/g, ''),
        ie:      emit?.IE ?? '',
        fone:    e.fone ?? emit?.fone ?? '',
        email:   emit?.email ?? '',
        xLgr:    e.xLgr ?? '',
        nro:     e.nro  ?? '',
        xBairro: e.xBairro ?? '',
        cMun:    e.cMun ?? '',
        xMun:    e.xMun ?? '',
        uf:      e.UF   ?? '',
        cep:     String(e.CEP ?? '').replace(/\D/g, ''),
    }
}

function parteFromDest(dest: any) {
    const e = dest?.enderDest ?? {}
    return {
        xNome:   dest?.xNome ?? '',
        cnpj:    String(dest?.CNPJ ?? '').replace(/\D/g, ''),
        cpf:     String(dest?.CPF  ?? '').replace(/\D/g, ''),
        ie:      dest?.IE ?? '',
        fone:    dest?.fone ?? '',
        email:   dest?.email ?? '',
        xLgr:    e.xLgr ?? '',
        nro:     e.nro  ?? '',
        xBairro: e.xBairro ?? '',
        cMun:    e.cMun ?? '',
        xMun:    e.xMun ?? '',
        uf:      e.UF   ?? '',
        cep:     String(e.CEP ?? '').replace(/\D/g, ''),
    }
}

function parteFromCteRem(rem: any) {
    const e = rem?.enderReme ?? {}
    return {
        xNome:   rem?.xNome ?? '',
        cnpj:    String(rem?.CNPJ ?? '').replace(/\D/g, ''),
        cpf:     String(rem?.CPF  ?? '').replace(/\D/g, ''),
        ie:      rem?.IE ?? '',
        fone:    rem?.fone ?? '',
        email:   rem?.email ?? '',
        xLgr:    e.xLgr ?? '',
        nro:     e.nro  ?? '',
        xBairro: e.xBairro ?? '',
        cMun:    e.cMun ?? '',
        xMun:    e.xMun ?? '',
        uf:      e.UF   ?? '',
        cep:     String(e.CEP ?? '').replace(/\D/g, ''),
    }
}

/* ── Máscaras ── */
function maskCnpj(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 14)
    if (d.length <= 2)  return d
    if (d.length <= 5)  return `${d.slice(0,2)}.${d.slice(2)}`
    if (d.length <= 8)  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
    if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}
function maskCpf(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 3) return d
    if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
    if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}
function maskCep(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 8)
    if (d.length <= 5) return d
    return `${d.slice(0,5)}-${d.slice(5)}`
}
function maskFone(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (!d) return ''
    if (d.length <= 2)  return `(${d}`
    if (d.length <= 6)  return `(${d.slice(0,2)}) ${d.slice(2)}`
    if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}
/** RNTRC: 8 digits or "ISENTO" */
function maskRntrc(v: string) {
    const up = v.toUpperCase()
    if (!up || /^[0-9]/.test(up)) return up.replace(/\D/g, '').slice(0, 8)
    return up.replace(/[^A-Z]/g, '').slice(0, 6)
}

// ─── Persistence helpers ─────────────────────────────────────────────────────

const LS_KEY = 'cte_pending_save'

async function postEvento(body: Record<string, unknown>): Promise<void> {
    const res = await fetch('/api/cte-eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Evento HTTP ${res.status}`)
}

async function trySaveCte(
    draftIdArg: string | null,
    infCte: unknown,
    extra: Record<string, unknown>,
    onNewId?: (id: string) => void,
): Promise<void> {
    const hdrs = { 'Content-Type': 'application/json' }
    const body = JSON.stringify({ infCte, ...extra })
    let res: Response
    if (draftIdArg) {
        res = await fetch(`/api/ctes/${draftIdArg}`, { method: 'PUT', headers: hdrs, body })
    } else {
        res = await fetch('/api/ctes', { method: 'POST', headers: hdrs, body })
        if (res.ok) {
            const created = await res.json()
            if (created?.id && onNewId) onNewId(created.id)
            return
        }
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? `HTTP ${res.status}`)
    }
}

async function saveWithRetry(
    draftIdArg: string | null,
    infCte: unknown,
    extra: Record<string, unknown>,
    onNewId?: (id: string) => void,
    attempts = 3,
): Promise<void> {
    for (let i = 0; i < attempts; i++) {
        try {
            await trySaveCte(draftIdArg, infCte, extra, onNewId)
            return
        } catch (err) {
            if (i < attempts - 1) await new Promise(r => setTimeout(r, 1200 * (i + 1)))
            else throw err
        }
    }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EmitirCtePage() {
    const { config: empresa } = useEmpresaConfig()
    const searchParams = useSearchParams()

    const [draftId, setDraftId]               = useState<string | null>(null)
    const [nfe, setNfe]                       = useState<any>(null)
    const [status, setStatus]                 = useState<Status>('idle')
    const [emittedIdNuvem, setEmittedIdNuvem] = useState<string | null>(null)
    const [errMsg, setErrMsg]                 = useState('')
    const [pendingSave, setPendingSave]       = useState<{ draftId: string | null; chave: string | null; idNuvem: string | null; extra: Record<string, unknown>; infCte: unknown } | null>(null)
    const [fetchingDist, setFetchingDist] = useState(false)
    const [calc, setCalc] = useState({
        show: false, origem: '', destino: '', distancia: '0', eixos: '4',
        tipoCarga: 'geral', peso: '', pesoTotalCarga: '', multiplasNfe: false,
    })
    const [calcResultado, setCalcResultado] = useState({ base: 0, icms: 0, icmsReduzido: 0 })
    const setCalcF = <K extends keyof typeof calc>(f: K, v: typeof calc[K]) =>
        setCalc(s => ({ ...s, [f]: v }))

    // ── Form ──────────────────────────────────────────────────────────────────
    const { control, handleSubmit, setValue, getValues, watch, reset,
        formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: defaultValues(),
    })

    const vTPrestWatch = watch('trib.vTPrest')
    const pICMSWatch   = watch('trib.pICMS')
    const vBC   = Number(vTPrestWatch) || 0
    const pICMS = Number(pICMSWatch)   || 12
    const vICMS = Math.round(vBC * (pICMS / 100) * 100) / 100

    // Which tabs have validation errors
    const tabError = {
        remetente:   !!errors.rem,
        destinatario:!!errors.dest,
        carga:       !!errors.carga,
        tributacao:  !!errors.trib,
    }

    // ── Effects ───────────────────────────────────────────────────────────────

    // Sync RNTRC from empresa config
    useEffect(() => {
        if (empresa.rntrc) setValue('carga.rntrc', empresa.rntrc)
    }, [empresa.rntrc])

    // Recover pending save from localStorage (e.g. after page crash/refresh mid-save)
    useEffect(() => {
        const raw = localStorage.getItem(LS_KEY)
        if (!raw) return
        try { setPendingSave(JSON.parse(raw)) } catch { localStorage.removeItem(LS_KEY) }
    }, [])

    // Load draft from ?id=
    useEffect(() => {
        const id = searchParams.get('id')
        if (!id) return
        setDraftId(id)
        fetch(`/api/ctes/${id}`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then((cte: any) => {
                const ic = cte.infCte
                if (!ic) return
                reset({
                    rem:  parteFromCteRem(ic.rem),
                    dest: parteFromDest(ic.dest),
                    toma: String(ic.ide?.toma3?.toma ?? ic.ide?.toma4?.toma ?? '3'),
                    carga: {
                        proPred: ic.infCTeNorm?.infCarga?.proPred ?? 'MADEIRA',
                        peso:    String(ic.infCTeNorm?.infCarga?.infQ?.[0]?.qCarga ?? ''),
                        vCarga:  String(ic.infCTeNorm?.infCarga?.vCarga ?? ''),
                        rntrc:   ic.infCTeNorm?.infModal?.rodo?.RNTRC ?? empresa.rntrc ?? '',
                    },
                    trib: {
                        vTPrest: String(ic.vPrest?.vTPrest ?? ''),
                        pICMS:   String(ic.imp?.ICMS?.ICMS00?.pICMS ?? '12'),
                        cst:     String(ic.imp?.ICMS?.ICMS00?.CST ?? '00'),
                    },
                    obs: ic.compl?.xObs ?? DEFAULT_OBS,
                })
                const chave = ic.infCTeNorm?.infDoc?.infNFe?.[0]?.chave ?? cte.chave ?? ''
                setNfe({
                    emit: {
                        CNPJ: ic.rem?.CNPJ, CPF: ic.rem?.CPF, xNome: ic.rem?.xNome,
                        IE: ic.rem?.IE, email: ic.rem?.email,
                        enderEmit: {
                            xLgr: ic.rem?.enderReme?.xLgr, nro: ic.rem?.enderReme?.nro,
                            xBairro: ic.rem?.enderReme?.xBairro, cMun: ic.rem?.enderReme?.cMun,
                            xMun: ic.rem?.enderReme?.xMun, UF: ic.rem?.enderReme?.UF,
                            CEP: ic.rem?.enderReme?.CEP, fone: ic.rem?.fone,
                        },
                    },
                    dest: {
                        CNPJ: ic.dest?.CNPJ, CPF: ic.dest?.CPF, xNome: ic.dest?.xNome,
                        IE: ic.dest?.IE, email: ic.dest?.email, fone: ic.dest?.fone,
                        enderDest: ic.dest?.enderDest,
                    },
                    peso: String(ic.infCTeNorm?.infCarga?.infQ?.[0]?.qCarga ?? ''),
                    raw: {
                        nfeProc: {
                            protNFe: { infProt: { chNFe: chave } },
                            NFe: { infNFe: { total: { ICMSTot: { vNF: ic.infCTeNorm?.infCarga?.vCarga ?? 0 } } } },
                        },
                    },
                })
            })
            .catch(() => toast.error('Não foi possível carregar o rascunho'))
    }, [])

    // Pre-fill calculator when it opens
    useEffect(() => {
        if (!calc.show) return
        const { rem, dest } = getValues()
        const origem  = rem.xMun  && rem.uf  ? `${rem.xMun} - ${rem.uf}`   : ''
        const destino = dest.xMun && dest.uf ? `${dest.xMun} - ${dest.uf}` : ''
        setCalc(s => ({ ...s, origem, destino }))
        if (origem && destino) fetchCalcDistance(origem, destino)
    }, [calc.show])

    // ── XML reader ────────────────────────────────────────────────────────────

    const readXml = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (e) => {
            const content = e.target?.result
            if (!content) return
            xml2js.parseString(content, { explicitArray: false }, (err, result) => {
                if (err) { setErrMsg('XML inválido.'); return }
                try {
                    const { NFe } = result.nfeProc
                    const { dest: d, emit: em, ide, transp, total } = NFe.infNFe
                    let pesoLiquido = 0
                    if (transp?.vol) {
                        const vols = Array.isArray(transp.vol) ? transp.vol : [transp.vol]
                        pesoLiquido = vols.reduce((acc: number, v: any) => acc + (Number(v.pesoL) || 0), 0)
                    }
                    const vNF = total?.ICMSTot?.vNF ?? ''
                    setNfe({ emit: em, dest: d, ide, peso: String(pesoLiquido).replace(/\D/g, ''), raw: result })
                    setValue('rem',  parteFromEmit(em), { shouldValidate: false })
                    setValue('dest', parteFromDest(d),  { shouldValidate: false })
                    setValue('carga.peso',   String(pesoLiquido).replace(/\D/g, ''))
                    setValue('carga.vCarga', String(vNF))
                    setErrMsg('')
                    setStatus('idle')
                } catch {
                    setErrMsg('Não foi possível ler os dados da NF-e.')
                }
            })
        }
        reader.readAsText(file)
    }

    // ── Calculator ────────────────────────────────────────────────────────────

    const SCALE = 10000
    const calcFrete = () => {
        const data = Indice.find(item => item.tipo === calc.tipoCarga)
        if (!data) return
        const ccdInt = Math.round(Number((data.coeficientes.ccd as any)[calc.eixos]) * SCALE)
        const ccInt  = Math.round(Number((data.coeficientes.cc  as any)[calc.eixos]) * SCALE)
        const distInt = Math.round(Number(calc.distancia))
        const totalInt = ccdInt * distInt + ccInt
        const totalReais = totalInt / SCALE
        let base = 0
        if (calc.multiplasNfe && calc.pesoTotalCarga) {
            base = Math.round(Number(calc.peso) * (totalReais / Number(calc.pesoTotalCarga)) * SCALE)
        } else {
            base = Math.round(totalReais * SCALE)
        }
        const icms = Math.round(base * 0.12)
        const reducao = Math.round(icms * 0.20)
        setCalcResultado({ base, icms, icmsReduzido: icms - reducao })
        setValue('trib.vTPrest', (base / SCALE).toFixed(2))
    }

    const fetchCalcDistance = async (origem: string, destino: string) => {
        if (!origem || !destino) return
        setFetchingDist(true)
        try {
            const { data } = await axios.post('/api/', { body: { origem, destino, distancia: '0' } })
            const km = String(Math.round(data.rows[0].elements[0].distance.value / 1000))
            setCalc(s => ({
                ...s,
                origem:  data.origin_addresses      ?? s.origem,
                destino: data.destination_addresses ?? s.destino,
                distancia: km,
            }))
        } catch { /* mantém distância manual */ } finally { setFetchingDist(false) }
    }

    // ── Save draft ────────────────────────────────────────────────────────────

    const handleSalvarRascunho = async () => {
        if (!nfe) return
        setStatus('loading')
        const { obs, carga, trib } = getValues()
        try {
            const payload = new CtePartesBuilder(nfe)
                .buildCompl({ xObs: obs })
                .buildvPrest({ total: vBC, xNome: 'Valor do Frete' })
                .buildImp({ vBC, pICMS, vICMS })
                .buildInfCteNorm({
                    infCarga: { proPred: carga.proPred, vCarga: Number(carga.vCarga) || undefined },
                    infModal: { versaoModal: '4.00', rodo: { RNTRC: carga.rntrc } },
                })
                .buildEmitente({ CNPJ: empresa.cnpj || undefined, IE: empresa.ie || undefined })
                .buildRemetente()
                .buildDestinatario()
                .build()

            if (draftId) {
                await fetch(`/api/ctes/${draftId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ infCte: payload.infCte, status: 'rascunho' }),
                })
            } else {
                const res = await fetch('/api/ctes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ infCte: payload.infCte, status: 'rascunho' }),
                })
                const created = await res.json()
                if (created?.id) setDraftId(created.id)
            }
            setStatus('idle')
            toast.success('Rascunho salvo com sucesso')
        } catch {
            setStatus('error')
            toast.error('Erro ao salvar rascunho')
        }
    }

    // ── Emit ──────────────────────────────────────────────────────────────────

    const onSubmit = async (data: FormValues) => {
        if (!nfe) return
        setStatus('loading')
        setErrMsg('')
        const { rem, dest, toma, carga, trib, obs } = data
        try {
            const cfgRes   = await fetch('/api/empresa')
            const cfgAtual = cfgRes.ok ? await cfgRes.json() : empresa
            const nCT:  number = cfgAtual.sequenciaCte ?? empresa.sequenciaCte ?? 1
            const serie: number = cfgAtual.serie        ?? empresa.serie        ?? 99

            const clean = (v: string | undefined) => (v && v.trim() !== '' ? v : undefined)
            const nfeEditado = {
                ...nfe,
                emit: {
                    ...nfe.emit,
                    xNome: rem.xNome,
                    CNPJ:  clean(rem.cnpj),
                    CPF:   !rem.cnpj ? clean(rem.cpf) : undefined,
                    IE:    clean(rem.ie),
                    email: clean(rem.email),
                    enderEmit: {
                        xLgr: rem.xLgr, nro: rem.nro, xBairro: rem.xBairro,
                        cMun: rem.cMun, xMun: rem.xMun, UF: rem.uf,
                        CEP:  clean(rem.cep), fone: clean(rem.fone),
                    },
                },
                dest: {
                    ...nfe.dest,
                    xNome: dest.xNome,
                    CNPJ:  clean(dest.cnpj),
                    CPF:   !dest.cnpj ? clean(dest.cpf) : undefined,
                    IE:    clean(dest.ie),
                    email: clean(dest.email),
                    fone:  clean(dest.fone),
                    enderDest: {
                        xLgr: dest.xLgr, nro: dest.nro, xBairro: dest.xBairro,
                        cMun: dest.cMun, xMun: dest.xMun, UF: dest.uf,
                        CEP:  clean(dest.cep),
                    },
                },
                peso: carga.peso,
            }

            const payload = new CtePartesBuilder(nfeEditado)
                .builIde({ nCT, serie, toma3: { toma: Number(toma) as any } })
                .buildCompl({ xObs: obs })
                .buildvPrest({ total: vBC, xNome: 'Valor do Frete' })
                .buildImp({ vBC, pICMS, vICMS })
                .buildInfCteNorm({
                    infCarga: { proPred: carga.proPred, vCarga: Number(carga.vCarga) || undefined },
                    infModal: { versaoModal: '4.00', rodo: { RNTRC: carga.rntrc } },
                })
                .buildEmitente({ CNPJ: empresa.cnpj || undefined, IE: empresa.ie || undefined })
                .buildRemetente()
                .buildDestinatario()
                .build()

            const result = await emitirCte(payload)

            const persistCte = (tipo: string, extra: Record<string, unknown>) => {
                const currentDraftId = draftId
                // 1. Salva evento imediatamente — dado crítico garantido no banco
                postEvento({ cteId: currentDraftId, tipo, ...extra })
                    .catch(() => {
                        // Evento falhou — cai no localStorage como último recurso
                        const pending = { draftId: currentDraftId, chave: String(extra.chave ?? ''), idNuvem: String(extra.idNuvem ?? ''), extra, infCte: payload.infCte }
                        localStorage.setItem(LS_KEY, JSON.stringify(pending))
                        setPendingSave(pending)
                    })
                // 2. Atualiza registro principal com retry
                saveWithRetry(currentDraftId, payload.infCte, extra, id => setDraftId(id))
                    .catch(() => {
                        // Retries esgotados — evento já foi salvo, só sinaliza fallback se ainda não foi
                        const pending = { draftId: currentDraftId, chave: String(extra.chave ?? ''), idNuvem: String(extra.idNuvem ?? ''), extra, infCte: payload.infCte }
                        localStorage.setItem(LS_KEY, JSON.stringify(pending))
                        setPendingSave(pending)
                    })
            }

            if (result?.status === 'autorizado') {
                setEmittedIdNuvem(result.id ?? null)
                setStatus('success')
                fetch('/api/empresa', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sequenciaCte: nCT + 1 }),
                }).catch(() => {})
                toast.success('CT-e autorizado pela SEFAZ', {
                    description: `Nº ${result.numero} · Protocolo ${result.autorizacao?.numero_protocolo ?? '—'}`,
                    duration: 8000,
                })
                persistCte('emitido', { status: 'autorizado', idNuvem: result.id ?? null, chave: result.chave ?? null, erroMsg: null })
            } else if (result?.status === 'rejeitado') {
                const motivo = result.autorizacao?.motivo_status ?? 'Motivo não informado'
                setStatus('error')
                setErrMsg(motivo)
                toast.error(`CT-e rejeitado (${result.autorizacao?.codigo_status ?? ''})`, {
                    description: motivo, duration: 12000,
                })
                persistCte('rejeitado', { status: 'erro', idNuvem: result.id ?? null, chave: result.chave ?? null, erroMsg: motivo })
            } else {
                setStatus('success')
                toast.info(`CT-e criado — status: ${result?.status ?? 'desconhecido'}`, {
                    description: `ID: ${result?.id ?? '—'}`, duration: 8000,
                })
                persistCte(result?.status ?? 'desconhecido', { status: result?.status ?? 'desconhecido', idNuvem: result?.id ?? null, chave: result?.chave ?? null })
            }
        } catch (e: any) {
            const apiErr = e?.response?.data
            const msg = apiErr?.details?.error?.message ?? apiErr?.error ?? e?.message ?? 'Erro ao emitir CT-e.'
            setStatus('error')
            setErrMsg(msg)
            toast.error('Falha ao emitir CT-e', { description: msg, duration: 10000 })
            if (draftId) {
                fetch(`/api/ctes/${draftId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'erro', erroMsg: msg }),
                }).catch(() => {})
            }
        }
    }

    const tomaWatch = watch('toma')
    const remWatch  = watch('rem')
    const destWatch = watch('dest')

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <main className="min-h-screen bg-slate-50 text-slate-900">
            <header className="sticky top-0 z-10 bg-white border-b shadow-sm">
                <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">F</div>
                        <span className="font-semibold text-slate-800">FreteCalc</span>
                    </Link>
                    <span className="text-slate-300">/</span>
                    <span className="text-sm text-slate-500">Emitir CT-e</span>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold">Emitir CT-e</h1>
                    <p className="text-sm text-slate-500 mt-1">Preencha os dados para emissão do Conhecimento de Transporte Eletrônico.</p>
                </div>

                {/* Upload XML */}
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex-1">
                            <Label htmlFor="xml" className="font-medium">XML da NF-e</Label>
                            <Input type="file" accept=".xml" onChange={readXml} id="xml" className="mt-1" />
                        </div>
                        {!nfe && (
                            <p className="text-xs text-slate-400 hidden sm:block">
                                Faça upload do XML autorizado pela SEFAZ para preencher os dados automaticamente.
                            </p>
                        )}
                    </div>

                    {nfe && (() => {
                        const raw = nfe.raw
                        const chave =
                            raw?.nfeProc?.protNFe?.infProt?.chNFe ??
                            raw?.protNFe?.infProt?.chNFe ??
                            (() => {
                                const id = raw?.nfeProc?.NFe?.infNFe?.$?.Id ?? raw?.NFe?.infNFe?.$?.Id
                                return typeof id === 'string' && id.startsWith('NFe') ? id.slice(3) : null
                            })()
                        return (
                            <div className="border-t border-slate-100 bg-sky-50/60 px-5 py-3 flex flex-wrap gap-x-6 gap-y-1.5 items-center">
                                <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-500 shrink-0">
                                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                    </span>
                                    <span className="text-xs font-semibold text-slate-700">
                                        NF-e {nfe.ide?.nNF}{nfe.ide?.serie ? `/${nfe.ide.serie}` : ''}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-xs text-slate-400 shrink-0">Emitente</span>
                                    <span className="text-xs font-medium text-slate-700 truncate max-w-[200px]" title={nfe.emit?.xNome}>
                                        {nfe.emit?.xNome ?? '—'}
                                    </span>
                                </div>
                                {chave && (
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="text-xs text-slate-400 shrink-0">Chave</span>
                                        <span className="font-mono text-xs text-slate-600 truncate max-w-[260px]" title={chave}>
                                            {chave.slice(0,8)}…{chave.slice(-8)}
                                        </span>
                                        <button type="button" onClick={() => navigator.clipboard.writeText(chave)}
                                            title="Copiar chave" className="ml-0.5 text-slate-400 hover:text-sky-600 transition-colors shrink-0">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                            </svg>
                                        </button>
                                    </div>
                                )}
                                <div className="flex items-center gap-1 text-xs text-slate-500 ml-auto">
                                    <span>{nfe.emit?.enderEmit?.xMun}/{nfe.emit?.enderEmit?.UF}</span>
                                    <span className="text-slate-300">→</span>
                                    <span>{nfe.dest?.enderDest?.xMun}/{nfe.dest?.enderDest?.UF}</span>
                                </div>
                            </div>
                        )
                    })()}
                </div>

                {/* Tabs */}
                <Tabs defaultValue="remetente">
                    <TabsList className="flex-wrap h-auto gap-1">
                        <TabsTrigger value="remetente" className="relative">
                            Remetente {tabError.remetente && <ErrorDot />}
                        </TabsTrigger>
                        <TabsTrigger value="destinatario" className="relative">
                            Destinatário {tabError.destinatario && <ErrorDot />}
                        </TabsTrigger>
                        <TabsTrigger value="tomador">Tomador</TabsTrigger>
                        <TabsTrigger value="carga" className="relative">
                            Dados da Carga {tabError.carga && <ErrorDot />}
                        </TabsTrigger>
                        <TabsTrigger value="tributacao" className="relative">
                            Tributação / Despesas {tabError.tributacao && <ErrorDot />}
                        </TabsTrigger>
                        <TabsTrigger value="observacao">Observação</TabsTrigger>
                        <TabsTrigger value="nfe">Dados da NF-e</TabsTrigger>
                    </TabsList>

                    {/* ── Remetente ── */}
                    <TabsContent value="remetente">
                        <Card title="Remetente">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <CF name="rem.xNome" control={control} label="Razão Social / Nome" />
                                </div>
                                <CF name="rem.cnpj" control={control} label="CNPJ" mono
                                    mask={maskCnpj} strip={/\D/g} />
                                <CF name="rem.cpf" control={control} label="CPF" mono
                                    mask={maskCpf} strip={/\D/g} placeholder="Apenas se pessoa física" />
                                <CF name="rem.ie"    control={control} label="Inscrição Estadual" />
                                <CF name="rem.fone"  control={control} label="Telefone" mono mask={maskFone} strip={/\D/g} />
                                <div className="md:col-span-2">
                                    <CF name="rem.email" control={control} label="E-mail" />
                                </div>
                            </div>
                            <AddressSection prefix="rem" control={control} />
                        </Card>
                    </TabsContent>

                    {/* ── Destinatário ── */}
                    <TabsContent value="destinatario">
                        <Card title="Destinatário">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <CF name="dest.xNome" control={control} label="Razão Social / Nome" />
                                </div>
                                <CF name="dest.cnpj" control={control} label="CNPJ" mono
                                    mask={maskCnpj} strip={/\D/g} />
                                <CF name="dest.cpf" control={control} label="CPF" mono
                                    mask={maskCpf} strip={/\D/g} placeholder="Apenas se pessoa física" />
                                <CF name="dest.ie"   control={control} label="Inscrição Estadual" />
                                <CF name="dest.fone" control={control} label="Telefone" mono mask={maskFone} strip={/\D/g} />
                                <div className="md:col-span-2">
                                    <CF name="dest.email" control={control} label="E-mail" />
                                </div>
                            </div>
                            <AddressSection prefix="dest" control={control} />
                        </Card>
                    </TabsContent>

                    {/* ── Tomador ── */}
                    <TabsContent value="tomador">
                        <Card title="Tomador do Serviço">
                            <p className="text-sm text-slate-500 mb-4">Indica quem é o responsável pelo pagamento do frete.</p>
                            <div className="max-w-xs">
                                <Label htmlFor="toma">Tomador</Label>
                                <Controller name="toma" control={control} render={({ field }) => (
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger id="toma" className="w-full mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0">0 — Remetente</SelectItem>
                                            <SelectItem value="1">1 — Expedidor</SelectItem>
                                            <SelectItem value="2">2 — Recebedor</SelectItem>
                                            <SelectItem value="3">3 — Destinatário</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )} />
                            </div>
                            {(tomaWatch === '0' || tomaWatch === '3') && (
                                <div className="mt-5 rounded-xl bg-sky-50 border border-sky-100 p-4 text-sm text-slate-700 space-y-1">
                                    <p className="font-medium text-sky-800 mb-2">
                                        {{ '0': 'Remetente', '3': 'Destinatário' }[tomaWatch]} selecionado como tomador
                                    </p>
                                    {tomaWatch === '0' && (
                                        <>
                                            <p><span className="text-slate-400">Nome:</span> {remWatch.xNome || '—'}</p>
                                            <p><span className="text-slate-400">CNPJ/CPF:</span> {remWatch.cnpj || remWatch.cpf || '—'}</p>
                                            <p><span className="text-slate-400">IE:</span> {remWatch.ie || '—'}</p>
                                        </>
                                    )}
                                    {tomaWatch === '3' && (
                                        <>
                                            <p><span className="text-slate-400">Nome:</span> {destWatch.xNome || '—'}</p>
                                            <p><span className="text-slate-400">CNPJ/CPF:</span> {destWatch.cnpj || destWatch.cpf || '—'}</p>
                                            <p><span className="text-slate-400">IE:</span> {destWatch.ie || '—'}</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </Card>
                    </TabsContent>

                    {/* ── Dados da Carga ── */}
                    <TabsContent value="carga">
                        <Card title="Dados da Carga">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <CF name="carga.proPred" control={control} label="Produto predominante"
                                    placeholder="Ex: MADEIRA" transform={v => v.toUpperCase()} />
                                <CF name="carga.peso" control={control} label="Peso líquido (kg)"
                                    placeholder="Ex: 18000" strip={/\D/g} />
                                <Controller name="carga.vCarga" control={control} render={({ field, fieldState }) => (
                                    <CurrencyInput label="Valor da carga" value={field.value} onChange={field.onChange}
                                        error={fieldState.error?.message} />
                                )} />
                                <CF name="carga.rntrc" control={control} label="RNTRC" placeholder="00000000" mono transform={maskRntrc} />
                            </div>
                        </Card>
                    </TabsContent>

                    {/* ── Tributação / Despesas ── */}
                    <TabsContent value="tributacao">
                        <Card title="Tributação / Despesas">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="vTPrest">Valor do Frete</Label>
                                    <div className="flex gap-2 mt-1">
                                        <Controller name="trib.vTPrest" control={control} render={({ field, fieldState }) => (
                                            <CurrencyInput id="vTPrest" value={field.value} onChange={field.onChange}
                                                error={fieldState.error?.message} className="flex-1" />
                                        )} />
                                        <Button type="button" variant={calc.show ? 'default' : 'outline'} size="sm"
                                            className="whitespace-nowrap shrink-0" onClick={() => setCalcF('show', !calc.show)}>
                                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3M13 3h5m0 0v5m0-5L10 11" />
                                            </svg>
                                            Calculadora
                                        </Button>
                                    </div>
                                </div>
                                <CF name="trib.pICMS" control={control} label="Alíquota ICMS (%)" placeholder="12" />
                                <div>
                                    <Label htmlFor="cst">CST</Label>
                                    <Controller name="trib.cst" control={control} render={({ field }) => (
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger id="cst" className="w-full mt-1"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="00">00 — Tributação Normal</SelectItem>
                                                <SelectItem value="20">20 — Com Redução de BC</SelectItem>
                                                <SelectItem value="40">40 — Isento</SelectItem>
                                                <SelectItem value="41">41 — Não Tributado</SelectItem>
                                                <SelectItem value="60">60 — ICMS cobrado anteriormente</SelectItem>
                                                <SelectItem value="90">90 — Outros</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )} />
                                </div>
                            </div>

                            {/* Calculadora inline */}
                            {calc.show && (
                                <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-5 space-y-4">
                                    <p className="text-sm font-semibold text-sky-800">Calculadora de ICMS</p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                            <Label>Origem</Label>
                                            <Input className="mt-1" value={calc.origem}
                                                onChange={e => setCalcF('origem', e.target.value)}
                                                onBlur={() => fetchCalcDistance(calc.origem, calc.destino)}
                                                placeholder="Ex: Buritis - RO" />
                                        </div>
                                        <div>
                                            <Label>Destino</Label>
                                            <Input className="mt-1" value={calc.destino}
                                                onChange={e => setCalcF('destino', e.target.value)}
                                                onBlur={() => fetchCalcDistance(calc.origem, calc.destino)}
                                                placeholder="Ex: Itajaí - SC" />
                                        </div>
                                        <div>
                                            <Label>Distância (km)</Label>
                                            <div className="relative mt-1">
                                                <Input value={fetchingDist ? '' : calc.distancia}
                                                    onChange={e => { if (/^\d*$/.test(e.target.value)) setCalcF('distancia', e.target.value) }}
                                                    placeholder={fetchingDist ? 'Buscando...' : 'Ex: 3500'} disabled={fetchingDist} />
                                                {fetchingDist && <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />}
                                            </div>
                                        </div>
                                        <div>
                                            <Label>Eixos</Label>
                                            <Select value={calc.eixos} onValueChange={v => setCalcF('eixos', v)}>
                                                <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {['2','3','4','5','6','7','8','9'].map(n => (
                                                        <SelectItem key={n} value={n}>{n} eixos</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>Tipo de carga</Label>
                                            <Select value={calc.tipoCarga} onValueChange={v => setCalcF('tipoCarga', v)}>
                                                <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="geral">Geral</SelectItem>
                                                    <SelectItem value="granel_solido">Granel Sólido</SelectItem>
                                                    <SelectItem value="granel_liquido">Granel Líquido</SelectItem>
                                                    <SelectItem value="frigorificada_aquecida">Frigorificada ou Aquecida</SelectItem>
                                                    <SelectItem value="conteinerizada">Conteinerizada</SelectItem>
                                                    <SelectItem value="neogranel">Neogranel</SelectItem>
                                                    <SelectItem value="perigosa_granel_solido">Perigosa Granel Sólido</SelectItem>
                                                    <SelectItem value="perigosa_granel_liquido">Perigosa Granel Líquido</SelectItem>
                                                    <SelectItem value="perigosa_frigorificada_aquecida">Perigosa Frigorificada/Aquecida</SelectItem>
                                                    <SelectItem value="perigosa_conteinerizada">Perigosa Conteinerizada</SelectItem>
                                                    <SelectItem value="perigosa_carga_geral">Perigosa Carga Geral</SelectItem>
                                                    <SelectItem value="carga_granel_pressurizada">Carga Granel Pressurizada</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="flex items-center gap-2 mt-5 cursor-pointer select-none text-sm">
                                                <div onClick={() => setCalcF('multiplasNfe', !calc.multiplasNfe)}
                                                    className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${calc.multiplasNfe ? 'bg-sky-600 border-sky-600' : 'bg-white border-slate-300'}`}>
                                                    {calc.multiplasNfe && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                                                </div>
                                                Carga Parcial
                                            </label>
                                        </div>
                                    </div>
                                    {calc.multiplasNfe && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <Label>Peso Total da Carga (kg)</Label>
                                                <Input className="mt-1" value={calc.pesoTotalCarga}
                                                    onChange={e => { if (/^\d*$/.test(e.target.value)) setCalcF('pesoTotalCarga', e.target.value) }}
                                                    placeholder="Ex: 25000" />
                                            </div>
                                            <div>
                                                <Label>Peso Líquido desta NF-e (kg)</Label>
                                                <Input className="mt-1" value={calc.peso}
                                                    onChange={e => { if (/^\d*$/.test(e.target.value)) setCalcF('peso', e.target.value) }}
                                                    placeholder="Ex: 5000" />
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3">
                                        <Button type="button" onClick={calcFrete} size="sm">Calcular</Button>
                                        {calcResultado.base > 0 && (
                                            <span className="text-sm text-sky-700">
                                                Frete: <b>R$ {(calcResultado.base / SCALE).toFixed(2)}</b>
                                                &nbsp;·&nbsp; ICMS: <b>R$ {(calcResultado.icms / SCALE).toFixed(2)}</b>
                                                &nbsp;·&nbsp; Red. 20%: <b>R$ {(calcResultado.icmsReduzido / SCALE).toFixed(2)}</b>
                                            </span>
                                        )}
                                    </div>
                                    {calcResultado.base > 0 && <p className="text-xs text-sky-600">Valor preenchido automaticamente no campo "Valor do Frete".</p>}
                                </div>
                            )}

                            {vBC > 0 && (
                                <div className="mt-4 rounded-xl bg-slate-50 border p-4 text-sm text-slate-600 space-y-1">
                                    <p className="font-semibold text-slate-700 mb-1">Resumo</p>
                                    <p>Valor do frete: <b>R$ {vBC.toFixed(2)}</b></p>
                                    <p>ICMS ({pICMS}%): <b>R$ {vICMS.toFixed(2)}</b></p>
                                </div>
                            )}
                        </Card>
                    </TabsContent>

                    {/* ── Observação ── */}
                    <TabsContent value="observacao">
                        <Card title="Observação">
                            <Controller name="obs" control={control} render={({ field }) => (
                                <div>
                                    <Label htmlFor="xObs">Texto complementar (xObs)</Label>
                                    <textarea id="xObs" value={field.value} onChange={e => field.onChange(e.target.value)}
                                        rows={6} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 resize-y focus:outline-none focus:ring-2 focus:ring-sky-500" />
                                    <p className="text-xs text-slate-400 mt-1">{field.value.length} caracteres</p>
                                </div>
                            )} />
                        </Card>
                    </TabsContent>

                    {/* ── Dados da NF-e ── */}
                    <TabsContent value="nfe">
                        <Card title="Dados da NF-e Referenciada">
                            {!nfe ? (
                                <p className="text-sm text-slate-400 py-4 text-center">
                                    Nenhum XML carregado. Faça o upload de uma NF-e para ver os dados.
                                </p>
                            ) : (
                                <NfeDataPanel nfe={nfe} />
                            )}
                        </Card>
                    </TabsContent>
                </Tabs>

                {status === 'error' && errMsg && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                        <b>Rejeição SEFAZ:</b> {errMsg}
                    </div>
                )}

                {pendingSave && (
                    <div className="rounded-xl bg-amber-50 border border-amber-300 p-4 space-y-3">
                        <p className="text-sm font-semibold text-amber-800">
                            ⚠️ CT-e emitido, mas falha ao salvar no banco de dados.
                        </p>
                        <p className="text-xs text-amber-700">
                            Guarde os dados abaixo. Eles ficarão salvos neste dispositivo até a sincronização ser concluída.
                        </p>
                        <div className="text-xs font-mono bg-white border border-amber-200 rounded-lg px-3 py-2 space-y-1">
                            {pendingSave.idNuvem && <p><span className="text-slate-500">ID Nuvem: </span>{pendingSave.idNuvem}</p>}
                            {pendingSave.chave   && <p><span className="text-slate-500">Chave: </span>{pendingSave.chave}</p>}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={async () => {
                                    try {
                                        await saveWithRetry(
                                            pendingSave.draftId,
                                            pendingSave.infCte,
                                            pendingSave.extra,
                                            id => setDraftId(id),
                                        )
                                        localStorage.removeItem(LS_KEY)
                                        setPendingSave(null)
                                        toast.success('Dados sincronizados com sucesso.')
                                    } catch {
                                        toast.error('Falha ao sincronizar. Tente novamente mais tarde.')
                                    }
                                }}
                                className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition-colors"
                            >
                                Tentar sincronizar novamente
                            </button>
                            {pendingSave.chave && (
                                <button
                                    onClick={() => { navigator.clipboard.writeText(pendingSave.chave!); toast.success('Chave copiada!') }}
                                    className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-800 text-xs font-medium hover:bg-amber-100 transition-colors"
                                >
                                    Copiar chave
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex gap-3 pb-8 flex-wrap">
                    {status !== 'success' && (
                        <Button onClick={handleSubmit(onSubmit)} disabled={!nfe || status === 'loading'} className="gap-2">
                            {status === 'loading' && (
                                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                            )}
                            {status === 'loading' ? 'Emitindo...' : 'Emitir CT-e'}
                        </Button>
                    )}
                    {status === 'success' && emittedIdNuvem && (
                        <Button
                            onClick={async () => {
                                try { await imprimirCte(emittedIdNuvem) }
                                catch (e: any) { toast.error(e?.message || 'Erro ao imprimir CT-e') }
                            }}
                            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                        >
                            Imprimir DACTE
                        </Button>
                    )}
                    <Button variant="outline" onClick={handleSalvarRascunho} disabled={!nfe || status === 'loading' || status === 'success'}>
                        Salvar rascunho
                    </Button>
                    <Link href="/"><Button variant="ghost">Cancelar</Button></Link>
                </div>
            </div>
        </main>
    )
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function ErrorDot() {
    return <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4 mt-2">
            <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">{title}</h2>
            {children}
        </div>
    )
}

/** Controlled Field — thin wrapper around Controller + Field primitive */
function CF({
    name, control, label, placeholder, maxLength, mono, mask, strip, transform,
}: {
    name: string
    control: any
    label: string
    placeholder?: string
    maxLength?: number
    mono?: boolean
    mask?: (v: string) => string
    strip?: RegExp
    transform?: (v: string) => string
}) {
    return (
        <Controller
            name={name}
            control={control}
            render={({ field, fieldState }) => (
                <Field
                    label={label}
                    value={mask ? mask(field.value ?? '') : (field.value ?? '')}
                    onChange={v => {
                        let val = strip ? v.replace(strip, '') : v
                        if (transform) val = transform(val)
                        field.onChange(val)
                    }}
                    placeholder={placeholder}
                    maxLength={maxLength}
                    mono={mono}
                    error={fieldState.error?.message}
                />
            )}
        />
    )
}

function AddressSection({ prefix, control }: { prefix: 'rem' | 'dest'; control: any }) {
    return (
        <div className="mt-4 pt-4 border-t">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Endereço</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                    <CF name={`${prefix}.xLgr`}    control={control} label="Logradouro" />
                </div>
                <CF name={`${prefix}.nro`}          control={control} label="Número" />
                <CF name={`${prefix}.xBairro`}      control={control} label="Bairro" />
                <CF name={`${prefix}.xMun`}         control={control} label="Município" />
                <CF name={`${prefix}.uf`}           control={control} label="UF" maxLength={2}
                    transform={v => v.replace(/[^a-zA-Z]/g, '').toUpperCase()} />
                <CF name={`${prefix}.cep`}          control={control} label="CEP" mono
                    mask={v => { const d = v.slice(0, 8); return d.length <= 5 ? d : `${d.slice(0,5)}-${d.slice(5)}` }}
                    strip={/\D/g} />
                <CF name={`${prefix}.cMun`}         control={control} label="Cód. Município (IBGE)" />
            </div>
        </div>
    )
}

function Field({
    label, value, onChange, placeholder, maxLength, mono, error,
}: {
    label: string
    value: string
    onChange: (v: string) => void
    placeholder?: string
    maxLength?: number
    mono?: boolean
    error?: string
}) {
    return (
        <div>
            <Label className={error ? 'text-red-600' : ''}>{label}</Label>
            <Input
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                maxLength={maxLength}
                className={`mt-1 ${mono ? 'font-mono' : ''} ${error ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            />
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
    )
}

// ─── NF-e panel ───────────────────────────────────────────────────────────────

function formatChave(chave: string) {
    return chave.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
    if (!value) return null
    return (
        <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-3 py-2 border-b border-slate-100 last:border-0">
            <span className="w-44 shrink-0 text-xs font-medium text-slate-500 uppercase tracking-wide pt-0.5">{label}</span>
            <span className={`text-sm text-slate-800 break-all ${mono ? 'font-mono' : ''}`}>{value}</span>
        </div>
    )
}

function NfeDataPanel({ nfe }: { nfe: any }) {
    const ide = nfe?.ide ?? {}
    const emit = nfe?.emit ?? {}
    const dest = nfe?.dest ?? {}
    const raw  = nfe?.raw

    const chave =
        raw?.nfeProc?.protNFe?.infProt?.chNFe ??
        raw?.protNFe?.infProt?.chNFe ??
        (() => {
            const id = raw?.nfeProc?.NFe?.infNFe?.$?.Id ?? raw?.NFe?.infNFe?.$?.Id
            return typeof id === 'string' && id.startsWith('NFe') ? id.slice(3) : null
        })()

    const protocolo = raw?.nfeProc?.protNFe?.infProt?.nProt
    const dhAuth    = raw?.nfeProc?.protNFe?.infProt?.dhRecbto
    const vNF       = raw?.nfeProc?.NFe?.infNFe?.total?.ICMSTot?.vNF ?? raw?.NFe?.infNFe?.total?.ICMSTot?.vNF

    function fmt(iso?: string | null) {
        if (!iso) return null
        const d = new Date(iso)
        if (isNaN(d.getTime())) return iso
        return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
    function fmtMoney(v?: string | number | null) {
        const n = Number(v)
        if (!v || isNaN(n)) return null
        return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    }

    return (
        <div className="space-y-1">
            {chave && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 mb-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Chave de Acesso</p>
                    <p className="font-mono text-sm text-slate-800 break-all leading-relaxed tracking-wide">{formatChave(chave)}</p>
                </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 mt-2">Identificação</p>
                    <InfoRow label="Número"       value={ide.nNF} mono />
                    <InfoRow label="Série"        value={ide.serie} />
                    <InfoRow label="Emissão"      value={fmt(ide.dhEmi)} />
                    <InfoRow label="CFOP"         value={ide.CFOP} />
                    <InfoRow label="Natureza Op." value={ide.natOp} />
                    <InfoRow label="Valor Total"  value={fmtMoney(vNF)} />
                </div>
                <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 mt-2">Autorização SEFAZ</p>
                    <InfoRow label="Protocolo"    value={protocolo} mono />
                    <InfoRow label="Data / Hora"  value={fmt(dhAuth)} />
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 mt-4">Emitente</p>
                    <InfoRow label="Razão Social" value={emit.xNome} />
                    <InfoRow label="CNPJ"         value={emit.CNPJ ? maskCnpj(String(emit.CNPJ)) : null} mono />
                    <InfoRow label="IE"           value={emit.IE} />
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 mt-4">Destinatário</p>
                    <InfoRow label="Razão Social" value={dest.xNome} />
                    <InfoRow label="CNPJ / CPF"   value={dest.CNPJ ? maskCnpj(String(dest.CNPJ)) : dest.CPF ? maskCpf(String(dest.CPF)) : null} mono />
                    <InfoRow label="IE"           value={dest.IE} />
                </div>
            </div>
        </div>
    )
}

