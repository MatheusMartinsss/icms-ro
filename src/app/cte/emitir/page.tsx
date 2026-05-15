'use client'

import { ChangeEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useForm, Controller, useWatch, useFieldArray } from 'react-hook-form'
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
import { emitirCte, imprimirCte, previewDacte } from '@/services/cte'
import { CtePartesBuilder } from '@/lib/cte/cte'
import Indice from '../../indice.json'
import { useEmpresaConfig, type EmpresaConfig } from '@/components/configuracoes-empresa'

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

export const CTE_CFOPS = [
    // ── Estadual (5xxx) ──────────────────────────────────────────────
    { code: '5351', natOp: 'Prestação de serviço de transporte para execução de serviço da mesma natureza' },
    { code: '5352', natOp: 'Prestação de serviço de transporte a estabelecimento industrial' },
    { code: '5353', natOp: 'Prestação de serviço de transporte a estabelecimento comercial' },
    { code: '5354', natOp: 'Prestação de serviço de transporte a estabelecimento de prestador de serviço de comunicação' },
    { code: '5355', natOp: 'Prestação de serviço de transporte a estabelecimento de geradora ou de distribuidora de energia elétrica' },
    { code: '5356', natOp: 'Prestação de serviço de transporte a estabelecimento de produtor rural' },
    { code: '5357', natOp: 'Prestação de serviço de transporte a não contribuinte' },
    { code: '5359', natOp: 'Prestação de serviço de transporte a contribuinte ou a não contribuinte quando o tomador for o remetente ou destinatário da mercadoria' },
    // ── Interestadual (6xxx) ─────────────────────────────────────────
    { code: '6351', natOp: 'Prestação de serviço de transporte para execução de serviço da mesma natureza' },
    { code: '6352', natOp: 'Prestação de serviço de transporte a estabelecimento industrial' },
    { code: '6353', natOp: 'Prestação de serviço de transporte a estabelecimento comercial' },
    { code: '6354', natOp: 'Prestação de serviço de transporte a estabelecimento de prestador de serviço de comunicação' },
    { code: '6355', natOp: 'Prestação de serviço de transporte a estabelecimento de geradora ou de distribuidora de energia elétrica' },
    { code: '6356', natOp: 'Prestação de serviço de transporte a estabelecimento de produtor rural' },
    { code: '6357', natOp: 'Prestação de serviço de transporte a não contribuinte' },
    { code: '6359', natOp: 'Prestação de serviço de transporte a contribuinte ou a não contribuinte quando o tomador for o remetente ou destinatário da mercadoria' },
    { code: '6932', natOp: 'Prestação de serviço fora da sede da transportadora' },
    // ── Exportação (7xxx) ────────────────────────────────────────────
    { code: '7358', natOp: 'Prestação de serviço de transporte' },
] as const

const UF_LIST = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const TP_ICMS_MAP: Record<string, string> = {
    normal:        '00',
    isento:        '40',
    nao_tributado: '41',
    outra_uf:      '90',
}

function cstToTpIcms(cst: string): string {
    return { '00': 'normal', '20': 'normal', '40': 'isento', '41': 'nao_tributado', '90': 'outra_uf' }[cst] ?? 'normal'
}

const schema = z.object({
    dhEmi:   z.string().min(1),
    tpCTe:   z.string(),
    tpServ:  z.string(),
    modal:   z.string(),
    cfop:    z.string().min(1, 'Obrigatório'),
    ufIni:   z.string(),
    xMunIni: z.string(),
    cMunIni: z.string(),
    ufFim:   z.string(),
    xMunFim: z.string(),
    cMunFim: z.string(),
    rem:     parteSchema,
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
        comp: z.array(z.object({
            xNome: z.string().min(1, 'Obrigatório'),
            vComp: z.string(),
        })).min(1).refine(
            arr => arr.some(c => Number(c.vComp) > 0),
            { message: 'Informe ao menos uma despesa com valor' }
        ),
        tpIcms: z.string(),
        vBC:    z.string(),
        pICMS:  z.string(),
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
        dhEmi:   new Date().toISOString().slice(0, 10),
        tpCTe:   '0',
        tpServ:  '0',
        modal:   '01',
        cfop:    '6352',
        ufIni:   '',
        xMunIni: '',
        cMunIni: '',
        ufFim:   '',
        xMunFim: '',
        cMunFim: '',
        rem:     emptyParte(),
        dest: emptyParte(),
        toma: '3',
        carga: { proPred: 'MADEIRA', peso: '', vCarga: '', rntrc: '' },
        trib:  { comp: [{ xNome: 'Valor do Frete', vComp: '' }], tpIcms: 'normal', vBC: '', pICMS: '12' },
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

function emitFromEmpresa(e: EmpresaConfig) {
    const clean = (v: string | undefined) => (v && v.trim() !== '' ? v : undefined)
    return {
        CNPJ: clean(e.cnpj?.replace(/\D/g, '')),
        IE:   clean(e.ie),
        CRT:  Number(e.crt) || 3,
        xNome: clean(e.razaoSocial),
        xFant: clean(e.nomeFantasia),
        fone:  clean(e.fone?.replace(/\D/g, '')),
        email: clean(e.email),
        enderEmit: {
            xLgr:    clean(e.xLgr),
            nro:     clean(e.nro),
            xCpl:    clean(e.xCompl),
            xBairro: clean(e.xBairro),
            cMun:    clean(e.cMunEnv),
            xMun:    clean(e.xMunEnv),
            UF:      clean(e.ufEnv),
            CEP:     clean(e.cep?.replace(/\D/g, '')),
            cPais:   '1058',
            xPais:   'BRASIL',
        },
    }
}

function icmsGroup(imp: any): any {
    const icms = imp?.ICMS
    if (!icms) return undefined
    const key = Object.keys(icms).find(k => k.startsWith('ICMS'))
    return key ? icms[key] : undefined
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

// ─── Parceiro helpers ────────────────────────────────────────────────────────

type ParceiroLite = {
    id: string
    tipoPessoa: string
    xNome: string
    cnpj?: string | null
    cpf?: string | null
    ie?: string | null
    fone?: string | null
    email?: string | null
    xLgr?: string | null
    nro?: string | null
    xBairro?: string | null
    cMun?: string | null
    xMun?: string | null
    uf?: string | null
    cep?: string | null
}

function applyParceiroToForm(prefix: 'rem' | 'dest', p: ParceiroLite, sv: any) {
    sv(`${prefix}.xNome`,   p.xNome   ?? '')
    sv(`${prefix}.cnpj`,    p.cnpj    ?? '')
    sv(`${prefix}.cpf`,     p.cpf     ?? '')
    sv(`${prefix}.ie`,      p.ie      ?? '')
    sv(`${prefix}.fone`,    p.fone    ?? '')
    sv(`${prefix}.email`,   p.email   ?? '')
    sv(`${prefix}.xLgr`,    p.xLgr    ?? '')
    sv(`${prefix}.nro`,     p.nro     ?? '')
    sv(`${prefix}.xBairro`, p.xBairro ?? '')
    sv(`${prefix}.cMun`,    p.cMun    ?? '')
    sv(`${prefix}.xMun`,    p.xMun    ?? '')
    sv(`${prefix}.uf`,      p.uf      ?? '')
    sv(`${prefix}.cep`,     String(p.cep ?? '').replace(/\D/g, ''))
}

async function syncParceiroFromForm(id: string, p: ReturnType<typeof emptyParte>): Promise<void> {
    await fetch(`/api/parceiros/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            xNome:   p.xNome   || null,
            cnpj:    p.cnpj    || null,
            cpf:     p.cpf     || null,
            ie:      p.ie      || null,
            fone:    p.fone    || null,
            email:   p.email   || null,
            xLgr:    p.xLgr    || null,
            nro:     p.nro     || null,
            xBairro: p.xBairro || null,
            cMun:    p.cMun    || null,
            xMun:    p.xMun    || null,
            uf:      p.uf      || null,
            cep:     p.cep     || null,
        }),
    })
}

async function upsertParceiroFromXml(data: any, enderKey: string): Promise<ParceiroLite | null> {
    const cnpj = String(data?.CNPJ ?? '').replace(/\D/g, '')
    const cpf  = String(data?.CPF  ?? '').replace(/\D/g, '')
    if (!cnpj && !cpf) return null
    const ender = data?.[enderKey] ?? {}
    const res = await fetch('/api/parceiros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tipoPessoa: cnpj ? 'J' : 'F',
            xNome:   data?.xNome  ?? '',
            cnpj:    cnpj  || null,
            cpf:     cpf   || null,
            ie:      data?.IE    || null,
            fone:    data?.fone  || null,
            email:   data?.email || null,
            xLgr:    ender.xLgr    || null,
            nro:     ender.nro     || null,
            xBairro: ender.xBairro || null,
            cMun:    ender.cMun    || null,
            xMun:    ender.xMun    || null,
            uf:      ender.UF      || null,
            cep:     String(ender.CEP ?? '').replace(/\D/g, '') || null,
        }),
    })
    if (!res.ok) return null
    return res.json()
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EmitirCtePage() {
    const { config: empresa } = useEmpresaConfig()
    const searchParams = useSearchParams()

    const [draftId, setDraftId]               = useState<string | null>(null)
    const [nfe, setNfe]                       = useState<any>(null)
    const [status, setStatus]                 = useState<Status>('idle')
    const [remParceiro, setRemParceiro]       = useState<ParceiroLite | null>(null)
    const [destParceiro, setDestParceiro]     = useState<ParceiroLite | null>(null)
    const [emittedIdNuvem, setEmittedIdNuvem] = useState<string | null>(null)
    const [cteInfo, setCteInfo]               = useState<{ status: string; chave?: string | null; dhEmi?: string | null; canceladoEm?: string | null } | null>(null)
    const isReadOnly = cteInfo?.status === 'autorizado' || cteInfo?.status === 'cancelado'
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

    const { fields: compFields, append: appendComp, remove: removeComp } = useFieldArray({
        control,
        name: 'trib.comp',
    })

    const tribComp   = watch('trib.comp')
    const tpIcmsW    = watch('trib.tpIcms')
    const pICMSWatch = watch('trib.pICMS')
    const vBCWatch   = watch('trib.vBC')

    const compTotal = (tribComp ?? []).reduce((s: number, c: any) => s + (Number(c.vComp) || 0), 0)
    const semBC     = ['isento', 'nao_tributado'].includes(tpIcmsW ?? '')
    const vBC       = semBC ? 0 : (vBCWatch ? Number(vBCWatch) : compTotal)
    const pICMS     = semBC ? 0 : (Number(pICMSWatch) || 12)
    const vICMS     = semBC ? 0 : Math.round(vBC * (pICMS / 100) * 100) / 100
    const cst       = TP_ICMS_MAP[tpIcmsW ?? ''] ?? '00'

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
                    dhEmi:   ic.ide?.dhEmi ? String(ic.ide.dhEmi).slice(0, 10) : new Date().toISOString().slice(0, 10),
                    tpCTe:   String(ic.ide?.tpCTe  ?? '0'),
                    tpServ:  String(ic.ide?.tpServ  ?? '0'),
                    modal:   String(ic.ide?.modal   ?? '01'),
                    cfop:    ic.ide?.CFOP ?? '6352',
                    ufIni:   ic.ide?.UFIni   ?? '',
                    xMunIni: ic.ide?.xMunIni ?? '',
                    cMunIni: ic.ide?.cMunIni ?? '',
                    ufFim:   ic.ide?.UFFim   ?? '',
                    xMunFim: ic.ide?.xMunFim ?? '',
                    cMunFim: ic.ide?.cMunFim ?? '',
                    rem:     parteFromCteRem(ic.rem),
                    dest: parteFromDest(ic.dest),
                    toma: String(ic.ide?.toma3?.toma ?? ic.ide?.toma4?.toma ?? '3'),
                    carga: {
                        proPred: ic.infCTeNorm?.infCarga?.proPred ?? 'MADEIRA',
                        peso:    String(ic.infCTeNorm?.infCarga?.infQ?.[0]?.qCarga ?? ''),
                        vCarga:  String(ic.infCTeNorm?.infCarga?.vCarga ?? ''),
                        rntrc:   ic.infCTeNorm?.infModal?.rodo?.RNTRC ?? empresa.rntrc ?? '',
                    },
                    trib: {
                        comp:   [{ xNome: 'Valor do Frete', vComp: String(ic.vPrest?.vTPrest ?? '') }],
                        tpIcms: cstToTpIcms(String(icmsGroup(ic.imp)?.CST ?? '00')),
                        vBC:    String(icmsGroup(ic.imp)?.vBC ?? ''),
                        pICMS:  String(icmsGroup(ic.imp)?.pICMS ?? '12'),
                    },
                    obs: ic.compl?.xObs ?? DEFAULT_OBS,
                })
                if (cte.status === 'erro' && cte.erroMsg) {
                    setStatus('error')
                    setErrMsg(cte.erroMsg)
                } else if (cte.status === 'autorizado' || cte.status === 'cancelado') {
                    setStatus('success')
                    setCteInfo({
                        status:      cte.status,
                        chave:       cte.chave ?? null,
                        dhEmi:       cte.dhEmi ?? null,
                        canceladoEm: cte.status === 'cancelado' ? (cte.updatedAt ?? null) : null,
                    })
                }

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
                    setValue('ufIni',   em.enderEmit?.UF   ?? '')
                    setValue('xMunIni', em.enderEmit?.xMun ?? '')
                    setValue('cMunIni', em.enderEmit?.cMun ?? '')
                    setValue('ufFim',   d.enderDest?.UF    ?? '')
                    setValue('xMunFim', d.enderDest?.xMun  ?? '')
                    setValue('cMunFim', d.enderDest?.cMun  ?? '')
                    setErrMsg('')
                    setStatus('idle')
                    // Upsert parceiros em background
                    ;(async () => {
                        try {
                            const [remP, destP] = await Promise.all([
                                upsertParceiroFromXml(em, 'enderEmit'),
                                upsertParceiroFromXml(d,  'enderDest'),
                            ])
                            if (remP)  setRemParceiro(remP)
                            if (destP) setDestParceiro(destP)
                        } catch { /* silent */ }
                    })()
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
        setValue('trib.comp.0.vComp', (base / SCALE).toFixed(2))
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
        const data = getValues()
        if (remParceiro)  syncParceiroFromForm(remParceiro.id,  data.rem).catch(() => {})
        if (destParceiro) syncParceiroFromForm(destParceiro.id, data.dest).catch(() => {})
        const { dhEmi, tpCTe, tpServ, modal, cfop, ufIni, xMunIni, cMunIni, ufFim, xMunFim, cMunFim, rem, dest, obs, carga, trib } = data
        const cfopEntry = CTE_CFOPS.find(c => c.code === cfop) ?? CTE_CFOPS[13]
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
        try {
            const cfgRes   = await fetch('/api/empresa')
            const cfgAtual = cfgRes.ok ? await cfgRes.json() : empresa
            const nCT:  number = cfgAtual.sequenciaCte ?? empresa.sequenciaCte ?? 1
            const serie: number = cfgAtual.serie       ?? empresa.serie        ?? 99

            const vTPrestRascunho = trib.comp.reduce((s, c) => s + (Number(c.vComp) || 0), 0)
            const payload = new CtePartesBuilder(nfeEditado)
                .builIde({
                    nCT, serie,
                    CFOP: cfopEntry.code, natOp: cfopEntry.natOp,
                    dhEmi: dhEmi ? new Date(dhEmi + 'T12:00:00').toISOString() : new Date().toISOString(),
                    tpCTe: Number(tpCTe),
                    tpServ: Number(tpServ),
                    modal,
                    ...(ufIni && { UFIni: ufIni, xMunIni, cMunIni }),
                    ...(ufFim && { UFFim: ufFim, xMunFim, cMunFim }),
                    toma3: { toma: Number(data.toma) as any },
                })
                .buildCompl({ xObs: obs })
                .buildvPrest({ total: vTPrestRascunho, xNome: trib.comp[0]?.xNome ?? 'Valor do Frete' })
                .buildImp({ vBC, pICMS, vICMS, cst })
                .buildInfCteNorm({
                    infCarga: { proPred: carga.proPred, vCarga: Number(carga.vCarga) || undefined },
                    infModal: { versaoModal: '4.00', rodo: { RNTRC: carga.rntrc } },
                })
                .buildEmitente(emitFromEmpresa(empresa))
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

    // ── Payload builder ───────────────────────────────────────────────────────

    const buildPayload = (data: FormValues, nCT: number, serie: number) => {
        const { dhEmi, tpCTe, tpServ, modal, cfop, ufIni, xMunIni, cMunIni, ufFim, xMunFim, cMunFim, rem, dest, toma, carga, trib, obs } = data
        const cfopEntry = CTE_CFOPS.find(c => c.code === cfop) ?? CTE_CFOPS[13]
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
        const vTPrestBuild = trib.comp.reduce((s, c) => s + (Number(c.vComp) || 0), 0)
        const cstBuild     = TP_ICMS_MAP[trib.tpIcms] ?? '00'
        const semBCBuild   = ['isento', 'nao_tributado'].includes(trib.tpIcms)
        const vBCBuild     = semBCBuild ? 0 : (trib.vBC ? Number(trib.vBC) : vTPrestBuild)
        const pICMSBuild   = semBCBuild ? 0 : (Number(trib.pICMS) || 12)
        const vICMSBuild   = semBCBuild ? 0 : Math.round(vBCBuild * (pICMSBuild / 100) * 100) / 100
        return new CtePartesBuilder(nfeEditado)
            .builIde({
                nCT, serie,
                CFOP: cfopEntry.code, natOp: cfopEntry.natOp,
                dhEmi: dhEmi ? new Date(dhEmi + 'T12:00:00').toISOString() : new Date().toISOString(),
                tpCTe: Number(tpCTe),
                tpServ: Number(tpServ),
                modal,
                ...(ufIni   && { UFIni: ufIni,   xMunIni, cMunIni }),
                ...(ufFim   && { UFFim: ufFim,   xMunFim, cMunFim }),
                toma3: { toma: Number(toma) as any },
            })
            .buildCompl({ xObs: obs })
            .buildvPrest({ total: vTPrestBuild, xNome: trib.comp[0]?.xNome ?? 'Valor do Frete' })
            .buildImp({ vBC: vBCBuild, pICMS: pICMSBuild, vICMS: vICMSBuild, cst: cstBuild })
            .buildInfCteNorm({
                infCarga: { proPred: carga.proPred, vCarga: Number(carga.vCarga) || undefined },
                infModal: { versaoModal: '4.00', rodo: { RNTRC: carga.rntrc } },
            })
            .buildEmitente({ CNPJ: empresa.cnpj || undefined, IE: empresa.ie || undefined })
            .buildRemetente()
            .buildDestinatario()
            .build()
    }

    // ── Pré-DACTE ─────────────────────────────────────────────────────────────

    const [previewLoading, setPreviewLoading] = useState(false)

    const onPreviewDacte = async (data: FormValues) => {
        if (!nfe) return
        setPreviewLoading(true)
        try {
            const cfgRes   = await fetch('/api/empresa')
            const cfgAtual = cfgRes.ok ? await cfgRes.json() : empresa
            const nCT: number  = cfgAtual.sequenciaCte ?? empresa.sequenciaCte ?? 1
            const serie: number = cfgAtual.serie       ?? empresa.serie        ?? 99
            await previewDacte(buildPayload(data, nCT, serie))
        } catch (e: any) {
            toast.error('Erro ao gerar pré-DACTE', { description: e?.message })
        } finally {
            setPreviewLoading(false)
        }
    }

    // ── Emit ──────────────────────────────────────────────────────────────────

    const onSubmit = async (data: FormValues) => {
        if (!nfe) return
        if (remParceiro)  syncParceiroFromForm(remParceiro.id,  data.rem).catch(() => {})
        if (destParceiro) syncParceiroFromForm(destParceiro.id, data.dest).catch(() => {})
        setStatus('loading')
        setErrMsg('')
        try {
            const cfgRes   = await fetch('/api/empresa')
            const cfgAtual = cfgRes.ok ? await cfgRes.json() : empresa
            const nCT:  number = cfgAtual.sequenciaCte ?? empresa.sequenciaCte ?? 1
            const serie: number = cfgAtual.serie        ?? empresa.serie        ?? 99

            const payload = buildPayload(data, nCT, serie)

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
            const msg = apiErr?.details?.message ?? apiErr?.details?.error?.message ?? apiErr?.error ?? e?.message ?? 'Erro ao emitir CT-e.'
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

    const tomaWatch  = watch('toma')
    const remWatch   = watch('rem')
    const destWatch  = watch('dest')
    const ufIniWatch = watch('ufIni')
    const ufFimWatch = watch('ufFim')
    const xMunIniWatch = watch('xMunIni')
    const xMunFimWatch = watch('xMunFim')

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <main className="min-h-screen bg-slate-50 text-slate-900">

            <div className="max-w-[1400px] mx-auto px-6 py-6">
                <div className="mb-5">
                    <h1 className="text-xl font-semibold">Emitir CT-e</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Preencha os dados para emissão do Conhecimento de Transporte Eletrônico.</p>
                </div>

                {status === 'error' && errMsg && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-5">
                        <b>Rejeição SEFAZ:</b> {errMsg}
                    </div>
                )}

                {cteInfo?.status === 'autorizado' && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 mb-5">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-emerald-800">CT-e Autorizado — somente leitura</p>
                                {cteInfo.chave && (
                                    <p className="text-xs text-emerald-700 mt-1 font-mono break-all">Chave: {cteInfo.chave}</p>
                                )}
                                {cteInfo.dhEmi && (
                                    <p className="text-xs text-emerald-600 mt-0.5">
                                        Emitido em: {new Date(cteInfo.dhEmi).toLocaleString('pt-BR')}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {cteInfo?.status === 'cancelado' && (
                    <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 mb-5">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-rose-800">CT-e Cancelado — somente leitura</p>
                                {cteInfo.chave && (
                                    <p className="text-xs text-rose-700 mt-1 font-mono break-all">Chave: {cteInfo.chave}</p>
                                )}
                                {cteInfo.canceladoEm && (
                                    <p className="text-xs text-rose-600 mt-0.5">
                                        Cancelado em: {new Date(cteInfo.canceladoEm).toLocaleString('pt-BR')}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Barra de campos do cabeçalho ── */}
                <div className="bg-white rounded-2xl border shadow-sm p-4 mb-5 space-y-3">
                    {/* Linha 1: Data | Tipo CT-e | Tipo Serviço | Modal | CFOP */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
                        <div>
                            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Data</Label>
                            <Controller name="dhEmi" control={control} render={({ field }) => (
                                <Input type="date" value={field.value} onChange={e => field.onChange(e.target.value)} className="mt-1" />
                            )} />
                        </div>
                        <div>
                            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tipo CT-e</Label>
                            <Controller name="tpCTe" control={control} render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">0 — Normal</SelectItem>
                                        <SelectItem value="1">1 — Complementar</SelectItem>
                                        <SelectItem value="2">2 — Anulação</SelectItem>
                                        <SelectItem value="3">3 — Substituto</SelectItem>
                                    </SelectContent>
                                </Select>
                            )} />
                        </div>
                        <div>
                            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tipo de Serviço</Label>
                            <Controller name="tpServ" control={control} render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">0 — Normal</SelectItem>
                                        <SelectItem value="1">1 — Subcontratação</SelectItem>
                                        <SelectItem value="2">2 — Redespacho</SelectItem>
                                        <SelectItem value="3">3 — Red. Intermediário</SelectItem>
                                        <SelectItem value="4">4 — Multimodal</SelectItem>
                                    </SelectContent>
                                </Select>
                            )} />
                        </div>
                        <div>
                            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Modal CT-e</Label>
                            <Controller name="modal" control={control} render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="01">01 — Rodoviário</SelectItem>
                                        <SelectItem value="02">02 — Aéreo</SelectItem>
                                        <SelectItem value="03">03 — Aquaviário</SelectItem>
                                        <SelectItem value="04">04 — Ferroviário</SelectItem>
                                        <SelectItem value="05">05 — Dutoviário</SelectItem>
                                        <SelectItem value="06">06 — Multimodal</SelectItem>
                                    </SelectContent>
                                </Select>
                            )} />
                        </div>
                        <div className="sm:col-span-2 lg:col-span-1">
                            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">CFOP</Label>
                            <Controller name="cfop" control={control} render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                        {CTE_CFOPS.map(c => (
                                            <SelectItem key={c.code} value={c.code}>
                                                <span className="font-mono font-semibold mr-2">{c.code}</span>
                                                <span className="text-slate-600">{c.natOp}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )} />
                        </div>
                    </div>

                    {/* Linha 2: Origem → Destino */}
                    <div className="border-t pt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-3 items-end">
                        <div>
                            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">UF Origem</Label>
                            <Controller name="ufIni" control={control} render={({ field }) => (
                                <Select value={field.value} onValueChange={v => {
                                    field.onChange(v)
                                    setValue('xMunIni', '')
                                    setValue('cMunIni', '')
                                }}>
                                    <SelectTrigger className="mt-1"><SelectValue placeholder="UF" /></SelectTrigger>
                                    <SelectContent>
                                        {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )} />
                        </div>
                        <div className="sm:col-span-2 lg:col-span-3">
                            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Cidade Origem</Label>
                            <MunicipioPicker
                                uf={ufIniWatch}
                                value={xMunIniWatch}
                                onChange={(xMun, cMun) => {
                                    setValue('xMunIni', xMun)
                                    setValue('cMunIni', cMun)
                                }}
                                placeholder="Selecione a cidade..."
                            />
                        </div>
                        <div className="items-end justify-center pb-2 text-slate-300 hidden lg:flex">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                        </div>
                        <div>
                            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">UF Destino</Label>
                            <Controller name="ufFim" control={control} render={({ field }) => (
                                <Select value={field.value} onValueChange={v => {
                                    field.onChange(v)
                                    setValue('xMunFim', '')
                                    setValue('cMunFim', '')
                                }}>
                                    <SelectTrigger className="mt-1"><SelectValue placeholder="UF" /></SelectTrigger>
                                    <SelectContent>
                                        {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )} />
                        </div>
                        <div className="sm:col-span-2 lg:col-span-3">
                            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Cidade Destino</Label>
                            <MunicipioPicker
                                uf={ufFimWatch}
                                value={xMunFimWatch}
                                onChange={(xMun, cMun) => {
                                    setValue('xMunFim', xMun)
                                    setValue('cMunFim', cMun)
                                }}
                                placeholder="Selecione a cidade..."
                            />
                        </div>
                    </div>
                </div>

                <div className={`pb-24${isReadOnly ? ' pointer-events-none select-none opacity-60' : ''}`}>
                    <div className="space-y-4">
                {/* Tabs */}
                <Tabs defaultValue="remetente">
                    <TabsList className={`flex-wrap h-auto gap-1${isReadOnly ? ' pointer-events-auto opacity-100' : ''}`}>
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
                            <ParceiroPickerCte
                                value={remParceiro}
                                onSelect={p => { setRemParceiro(p); applyParceiroToForm('rem', p, setValue) }}
                                onClear={() => setRemParceiro(null)}
                            />
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="sm:col-span-2 lg:col-span-3">
                                    <CF name="rem.xNome" control={control} label="Razão Social / Nome" />
                                </div>
                                <DocInputField prefix="rem" control={control} setValue={setValue}
                                    onParceiroFound={p => setRemParceiro(p)} />
                                <CF name="rem.ie"   control={control} label="Inscrição Estadual" />
                                <CF name="rem.fone" control={control} label="Telefone" mono mask={maskFone} strip={/\D/g} />
                                <div className="sm:col-span-2">
                                    <CF name="rem.email" control={control} label="E-mail" />
                                </div>
                            </div>
                            <AddressSection prefix="rem" control={control} setValue={setValue} watch={watch} />
                        </Card>
                    </TabsContent>

                    {/* ── Destinatário ── */}
                    <TabsContent value="destinatario">
                        <Card title="Destinatário">
                            <ParceiroPickerCte
                                value={destParceiro}
                                onSelect={p => { setDestParceiro(p); applyParceiroToForm('dest', p, setValue) }}
                                onClear={() => setDestParceiro(null)}
                            />
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="sm:col-span-2 lg:col-span-3">
                                    <CF name="dest.xNome" control={control} label="Razão Social / Nome" />
                                </div>
                                <DocInputField prefix="dest" control={control} setValue={setValue}
                                    onParceiroFound={p => setDestParceiro(p)} />
                                <CF name="dest.ie"   control={control} label="Inscrição Estadual" />
                                <CF name="dest.fone" control={control} label="Telefone" mono mask={maskFone} strip={/\D/g} />
                                <div className="sm:col-span-2">
                                    <CF name="dest.email" control={control} label="E-mail" />
                                </div>
                            </div>
                            <AddressSection prefix="dest" control={control} setValue={setValue} watch={watch} />
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="lg:col-span-2">
                                    <CF name="carga.proPred" control={control} label="Produto predominante"
                                        placeholder="Ex: MADEIRA" transform={v => v.toUpperCase()} />
                                </div>
                                <CF name="carga.peso" control={control} label="Peso líquido (kg)"
                                    placeholder="Ex: 18000" strip={/\D/g} />
                                <CF name="carga.rntrc" control={control} label="RNTRC" placeholder="00000000" mono transform={maskRntrc} />
                                <Controller name="carga.vCarga" control={control} render={({ field, fieldState }) => (
                                    <CurrencyInput label="Valor da carga" value={field.value} onChange={field.onChange}
                                        error={fieldState.error?.message} />
                                )} />
                            </div>
                        </Card>
                    </TabsContent>

                    {/* ── Tributação / Despesas ── */}
                    <TabsContent value="tributacao">
                        <Card title="Tributação / Despesas">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">

                                {/* ── Coluna esquerda: Despesas ── */}
                                <div className="pb-6 lg:pb-0 lg:pr-6 space-y-2">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Despesas de Transporte</p>
                                        <Button type="button" variant={calc.show ? 'default' : 'outline'} size="sm"
                                            className="h-7 text-xs gap-1.5 shrink-0" onClick={() => setCalcF('show', !calc.show)}>
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3M13 3h5m0 0v5m0-5L10 11" />
                                            </svg>
                                            Calculadora
                                        </Button>
                                    </div>

                                    {/* Header das colunas */}
                                    <div className="grid grid-cols-[1fr_140px_28px] gap-2 px-1">
                                        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Descrição</span>
                                        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Valor</span>
                                        <span />
                                    </div>

                                    {compFields.map((field, index) => (
                                        <div key={field.id} className="grid grid-cols-[1fr_140px_28px] gap-2 items-start">
                                            <Controller
                                                name={`trib.comp.${index}.xNome`}
                                                control={control}
                                                render={({ field: f, fieldState }) => (
                                                    <Input
                                                        value={f.value}
                                                        onChange={e => f.onChange(e.target.value)}
                                                        placeholder="Ex: Valor do Frete"
                                                        className={fieldState.error ? 'border-red-500' : ''}
                                                    />
                                                )}
                                            />
                                            <Controller
                                                name={`trib.comp.${index}.vComp`}
                                                control={control}
                                                render={({ field: f }) => (
                                                    <CurrencyInput value={f.value} onChange={f.onChange} />
                                                )}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeComp(index)}
                                                disabled={compFields.length === 1}
                                                className="mt-0.5 h-9 w-7 flex items-center justify-center rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-0 disabled:pointer-events-none"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                                                </svg>
                                            </button>
                                        </div>
                                    ))}

                                    <button
                                        type="button"
                                        onClick={() => appendComp({ xNome: '', vComp: '' })}
                                        className="mt-1 text-xs text-sky-600 hover:text-sky-800 font-medium flex items-center gap-1"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                                        </svg>
                                        Adicionar despesa
                                    </button>

                                    <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                                        <span className="text-xs text-slate-400">Total das despesas</span>
                                        <span className="text-sm font-semibold text-slate-800">
                                            {compTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                    </div>
                                    {(errors.trib as any)?.comp && (
                                        <p className="text-xs text-red-500">{(errors.trib as any).comp.message ?? (errors.trib as any).comp.root?.message}</p>
                                    )}
                                </div>

                                {/* ── Coluna direita: Tributação ── */}
                                <div className="pt-6 lg:pt-0 lg:pl-6 space-y-4">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Tributação</p>

                                    <div>
                                        <Label>Tipo de Tributação</Label>
                                        <Controller name="trib.tpIcms" control={control} render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="normal">Normal</SelectItem>
                                                    <SelectItem value="isento">Isento</SelectItem>
                                                    <SelectItem value="nao_tributado">Não Tributado</SelectItem>
                                                    <SelectItem value="outra_uf">Outra UF</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )} />
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <Label>Valor BC ICMS</Label>
                                            {semBC ? (
                                                <div className="mt-1 h-9 flex items-center px-3 rounded-md border border-slate-200 bg-slate-50 text-sm font-mono text-slate-400">
                                                    R$ 0,00
                                                </div>
                                            ) : (
                                                <>
                                                    <Controller name="trib.vBC" control={control} render={({ field }) => (
                                                        <CurrencyInput
                                                            value={field.value}
                                                            onChange={field.onChange}
                                                            placeholder={compTotal > 0 ? compTotal.toFixed(2) : '0,00'}
                                                        />
                                                    )} />
                                                    {!vBCWatch && compTotal > 0 && (
                                                        <p className="text-[11px] text-slate-400 mt-1">Preenchido automaticamente com o total das despesas</p>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        <div>
                                            <Label>Alíquota ICMS (%)</Label>
                                            {semBC ? (
                                                <div className="mt-1 h-9 flex items-center px-3 rounded-md border border-slate-200 bg-slate-50 text-sm font-mono text-slate-400">
                                                    0%
                                                </div>
                                            ) : (
                                                <Controller name="trib.pICMS" control={control} render={({ field }) => (
                                                    <Input value={field.value} onChange={e => field.onChange(e.target.value)}
                                                        placeholder="12" className="mt-1" />
                                                )} />
                                            )}
                                        </div>
                                        <div>
                                            <Label>Valor ICMS</Label>
                                            <div className={`mt-1 h-9 flex items-center px-3 rounded-md border border-slate-200 bg-slate-50 text-sm font-mono ${semBC ? 'text-slate-400' : 'text-slate-700'}`}>
                                                {vICMS.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </div>
                                            {!semBC && (
                                                <p className="text-[11px] text-slate-400 mt-1">Calculado: {vBC.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} × {pICMS}%</p>
                                            )}
                                        </div>
                                    </div>
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
                        <Card title="NF-e Referenciada">
                            <div>
                                <Label htmlFor="xml" className="font-medium text-sm">Importar XML da NF-e</Label>
                                <p className="text-xs text-slate-400 mt-0.5 mb-2">Faça upload do XML autorizado pela SEFAZ. Os dados de remetente, destinatário, peso e valor serão preenchidos automaticamente.</p>
                                <Input type="file" accept=".xml" onChange={readXml} id="xml" className="max-w-sm" />
                            </div>
                            {nfe ? (
                                <div className="mt-4 pt-4 border-t">
                                    <NfeDataPanel nfe={nfe} />
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400 py-6 text-center border-t mt-4">
                                    Nenhum XML carregado ainda.
                                </p>
                            )}
                        </Card>
                    </TabsContent>
                </Tabs>

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
                    </div>{/* fim area principal */}
                </div>{/* fim pb-24 */}
            </div>

            {/* ── Footer sticky ── */}
            <footer className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t shadow-lg">
                <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center gap-3">
                    {vBC > 0 && (
                        <div className="text-sm text-slate-600 mr-4 hidden sm:block">
                            <span className="text-slate-400 mr-1">Frete:</span>
                            <b className="text-slate-800">R$ {vBC.toFixed(2)}</b>
                            <span className="text-slate-300 mx-2">·</span>
                            <span className="text-slate-400 mr-1">ICMS {pICMS}%:</span>
                            <b className="text-slate-800">R$ {vICMS.toFixed(2)}</b>
                        </div>
                    )}

                    <div className="flex items-center gap-2 ml-auto">
                        <Link href="/cte"><Button variant="ghost" size="sm">Voltar</Button></Link>
                        {isReadOnly ? (
                            draftId && (
                                <Button size="sm"
                                    onClick={async () => {
                                        try { await imprimirCte(draftId) }
                                        catch (e: any) { toast.error(e?.message || 'Erro ao gerar DACTE') }
                                    }}
                                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                                    Imprimir DACTE
                                </Button>
                            )
                        ) : (
                            <>
                                <Button variant="outline" size="sm" onClick={handleSalvarRascunho}
                                    disabled={!nfe || status === 'loading' || status === 'success'}>
                                    Salvar rascunho
                                </Button>
                                <Button variant="outline" size="sm"
                                    onClick={handleSubmit(onPreviewDacte)}
                                    disabled={!nfe || status === 'loading' || previewLoading}
                                    className="gap-1.5">
                                    {previewLoading && (
                                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-400/40 border-t-slate-500" />
                                    )}
                                    Pré-DACTE
                                </Button>
                                {status === 'success' && draftId ? (
                                    <Button size="sm"
                                        onClick={async () => {
                                            try { await imprimirCte(draftId) }
                                            catch (e: any) { toast.error(e?.message || 'Erro ao gerar DACTE') }
                                        }}
                                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                                        Imprimir DACTE
                                    </Button>
                                ) : (
                                    <Button size="sm"
                                        onClick={handleSubmit(onSubmit)}
                                        disabled={!nfe || status === 'loading'}
                                        className="gap-1.5">
                                        {status === 'loading' && (
                                            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                        )}
                                        {status === 'loading' ? 'Emitindo...' : 'Emitir CT-e'}
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </footer>
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

// ─── Parceiro Picker ──────────────────────────────────────────────────────────

function ParceiroPickerCte({ value, onSelect, onClear }: {
    value: ParceiroLite | null
    onSelect: (p: ParceiroLite) => void
    onClear: () => void
}) {
    const [query, setQuery]     = useState('')
    const [results, setResults] = useState<ParceiroLite[]>([])
    const [loading, setLoading] = useState(false)
    const [open, setOpen]       = useState(false)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const ref         = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    useEffect(() => {
        const q = query.trim()
        if (q.length < 2) { setResults([]); setOpen(false); return }
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(async () => {
            setLoading(true)
            try {
                const digits = q.replace(/\D/g, '')
                const param  = digits.length === 14 ? `cnpj=${digits}`
                             : digits.length === 11 ? `cpf=${digits}`
                             : `q=${encodeURIComponent(q)}`
                const res = await fetch(`/api/parceiros?${param}`)
                if (res.ok) { setResults(await res.json()); setOpen(true) }
            } finally { setLoading(false) }
        }, 300)
    }, [query])

    function fmtDoc(p: ParceiroLite) {
        if (p.cnpj) return maskCnpj(p.cnpj)
        if (p.cpf)  return maskCpf(p.cpf)
        return '—'
    }

    if (value) {
        return (
            <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{value.xNome}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs font-mono text-slate-500">{fmtDoc(value)}</span>
                        {value.xMun && <span className="text-xs text-slate-400">{value.xMun} / {value.uf}</span>}
                    </div>
                </div>
                <button type="button" onClick={onClear}
                    className="text-xs text-sky-600 hover:text-sky-800 font-medium shrink-0 border border-sky-200 rounded-lg px-2.5 py-1 hover:bg-sky-100 transition-colors">
                    Trocar
                </button>
            </div>
        )
    }

    return (
        <div ref={ref} className="relative">
            <div className="relative">
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => results.length > 0 && setOpen(true)}
                    placeholder="Buscar por nome, CNPJ ou CPF..."
                    className="w-full h-9 px-3 pr-8 text-sm border rounded-md border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
                {loading
                    ? <span className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
                    : <svg className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35"/>
                      </svg>
                }
            </div>
            {open && (
                <div className="absolute z-50 top-full mt-1 w-full bg-white border rounded-lg shadow-xl max-h-56 overflow-y-auto">
                    {results.length === 0
                        ? <p className="text-sm text-slate-400 text-center py-4">Nenhum cadastro encontrado</p>
                        : results.map(p => (
                            <button key={p.id} type="button"
                                onClick={() => { onSelect(p); setQuery(''); setOpen(false) }}
                                className="w-full text-left px-3 py-2.5 hover:bg-sky-50 transition-colors border-b last:border-0">
                                <p className="text-sm font-medium text-slate-800">{p.xNome}</p>
                                <p className="text-xs text-slate-400 font-mono">
                                    {fmtDoc(p)}{p.xMun ? ` · ${p.xMun}/${p.uf}` : ''}
                                </p>
                            </button>
                        ))
                    }
                </div>
            )}
        </div>
    )
}

// ─── Doc Input (CNPJ/CPF unificado + lookup Receita Federal) ─────────────────

function normalizeStr(s: string) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function DocInputField({ prefix, control, setValue, onParceiroFound }: {
    prefix: 'rem' | 'dest'
    control: any
    setValue: any
    onParceiroFound?: (p: ParceiroLite) => void
}) {
    const [looking, setLooking] = useState(false)
    const [lookupErr, setLookupErr] = useState('')
    const lastLookup = useRef('')

    async function lookupCnpj(cnpj: string) {
        if (cnpj === lastLookup.current) return
        lastLookup.current = cnpj
        setLooking(true)
        setLookupErr('')
        try {
            const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
            if (!res.ok) { setLookupErr('CNPJ não encontrado na Receita Federal'); return }
            const data = await res.json()

            setValue(`${prefix}.xNome`,   data.razao_social ?? '')
            setValue(`${prefix}.fone`,    String(data.ddd_telefone_1 ?? '').replace(/\D/g, ''))
            setValue(`${prefix}.email`,   data.email ?? '')
            setValue(`${prefix}.xLgr`,   data.logradouro ?? '')
            setValue(`${prefix}.nro`,     data.numero ?? '')
            setValue(`${prefix}.xBairro`, data.bairro ?? '')
            setValue(`${prefix}.cep`,     String(data.cep ?? '').replace(/\D/g, ''))
            setValue(`${prefix}.uf`,      data.uf ?? '')

            if (data.municipio && data.uf) {
                const uf = String(data.uf).toUpperCase()
                if (!municipioCache[uf]) {
                    const mr = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`)
                    if (mr.ok) municipioCache[uf] = await mr.json()
                }
                const match = (municipioCache[uf] ?? []).find(
                    m => normalizeStr(m.nome) === normalizeStr(data.municipio)
                )
                setValue(`${prefix}.xMun`, match?.nome ?? data.municipio)
                setValue(`${prefix}.cMun`, match ? String(match.id) : '')
            }

            if (onParceiroFound) {
                const pr = await fetch('/api/parceiros', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tipoPessoa: 'J',
                        xNome:   data.razao_social ?? '',
                        cnpj,
                        ie:      null,
                        fone:    String(data.ddd_telefone_1 ?? '').replace(/\D/g, '') || null,
                        email:   data.email || null,
                        xLgr:    data.logradouro || null,
                        nro:     data.numero || null,
                        xBairro: data.bairro || null,
                        cMun:    (municipioCache[data.uf ?? ''] ?? []).find(m => normalizeStr(m.nome) === normalizeStr(data.municipio ?? ''))?.id?.toString() || null,
                        xMun:    data.municipio || null,
                        uf:      data.uf || null,
                        cep:     String(data.cep ?? '').replace(/\D/g, '') || null,
                    }),
                })
                if (pr.ok) onParceiroFound(await pr.json())
            }
        } catch {
            setLookupErr('Erro ao consultar Receita Federal')
        } finally {
            setLooking(false)
        }
    }

    return (
        <Controller
            name={`${prefix}.cnpj`}
            control={control}
            render={({ field: cnpjField, fieldState }) => (
                <Controller
                    name={`${prefix}.cpf`}
                    control={control}
                    render={({ field: cpfField }) => {
                        const rawDigits = ((cnpjField.value || cpfField.value) as string ?? '').replace(/\D/g, '')
                        const isCnpj    = rawDigits.length > 11 || (!!cnpjField.value && !cpfField.value)
                        const display   = isCnpj ? maskCnpj(cnpjField.value ?? '') : maskCpf(cpfField.value ?? '')

                        function handleChange(raw: string) {
                            const d = raw.replace(/\D/g, '').slice(0, 14)
                            lastLookup.current = ''
                            setLookupErr('')
                            if (d.length <= 11) {
                                setValue(`${prefix}.cnpj`, '')
                                cpfField.onChange(d)
                            } else {
                                cpfField.onChange('')
                                cnpjField.onChange(d)
                                if (d.length === 14) lookupCnpj(d)
                            }
                        }

                        return (
                            <div>
                                <Label className={fieldState.error ? 'text-red-600' : ''}>CNPJ / CPF</Label>
                                <div className="relative mt-1">
                                    <Input
                                        value={display}
                                        onChange={e => handleChange(e.target.value)}
                                        placeholder="000.000.000-00"
                                        maxLength={18}
                                        className={`font-mono pr-8 ${fieldState.error ? 'border-red-500' : ''}`}
                                    />
                                    {looking && (
                                        <span className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />
                                    )}
                                </div>
                                {lookupErr && <p className="mt-1 text-xs text-amber-600">{lookupErr}</p>}
                                {fieldState.error && <p className="mt-1 text-xs text-red-500">{fieldState.error.message}</p>}
                            </div>
                        )
                    }}
                />
            )}
        />
    )
}

// ─── Município Picker ─────────────────────────────────────────────────────────

type Municipio = { id: number; nome: string }
const municipioCache: Record<string, Municipio[]> = {}

function MunicipioPicker({ uf, value, onChange, placeholder = 'Selecione a cidade...' }: {
    uf: string
    value: string
    onChange: (xMun: string, cMun: string) => void
    placeholder?: string
}) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [municipios, setMunicipios] = useState<Municipio[]>([])
    const [loading, setLoading] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false)
                setSearch('')
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    useEffect(() => {
        if (!uf || !open || municipioCache[uf]) {
            if (uf && municipioCache[uf]) setMunicipios(municipioCache[uf])
            return
        }
        setLoading(true)
        fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`)
            .then(r => r.json())
            .then((data: Municipio[]) => {
                municipioCache[uf] = data
                setMunicipios(data)
            })
            .catch(() => setMunicipios([]))
            .finally(() => setLoading(false))
    }, [uf, open])

    const filtered = search.length >= 2
        ? municipios.filter(m => m.nome.toLowerCase().includes(search.toLowerCase()))
        : municipios.slice(0, 150)

    return (
        <div ref={ref} className="relative mt-1">
            <button
                type="button"
                disabled={!uf}
                onClick={() => uf && setOpen(v => !v)}
                className={[
                    'w-full h-9 px-3 text-sm border rounded-md bg-white text-left flex items-center justify-between gap-2',
                    'border-input ring-offset-background',
                    !uf ? 'opacity-50 cursor-not-allowed text-slate-400' : 'hover:border-slate-400 cursor-pointer',
                    open ? 'ring-2 ring-ring ring-offset-2' : '',
                ].join(' ')}
            >
                <span className={value ? 'text-slate-900 truncate' : 'text-slate-400'}>
                    {value || placeholder}
                </span>
                <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6"/>
                </svg>
            </button>

            {open && (
                <div className="absolute z-50 top-full mt-1 w-full min-w-[200px] bg-white border rounded-lg shadow-xl">
                    <div className="p-2 border-b">
                        <input
                            autoFocus
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar município..."
                            className="w-full px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                    </div>
                    <div className="max-h-56 overflow-y-auto py-1">
                        {loading ? (
                            <p className="text-xs text-center py-4 text-slate-400">Carregando...</p>
                        ) : filtered.length === 0 ? (
                            <p className="text-xs text-center py-4 text-slate-400">Nenhum município encontrado</p>
                        ) : filtered.map(m => (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                    onChange(m.nome, String(m.id))
                                    setOpen(false)
                                    setSearch('')
                                }}
                                className={[
                                    'w-full text-left px-3 py-2 text-sm transition-colors',
                                    value === m.nome
                                        ? 'bg-sky-50 text-sky-700 font-medium'
                                        : 'hover:bg-slate-50',
                                ].join(' ')}
                            >
                                {m.nome}
                            </button>
                        ))}
                    </div>
                    {search.length < 2 && municipios.length > 150 && (
                        <p className="text-[11px] text-center py-1.5 text-slate-400 border-t">
                            Digite ao menos 2 letras para filtrar
                        </p>
                    )}
                </div>
            )}
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

function AddressSection({ prefix, control, setValue, watch }: {
    prefix: 'rem' | 'dest'
    control: any
    setValue: any
    watch: any
}) {
    const ufVal   = watch(`${prefix}.uf`)   ?? ''
    const xMunVal = watch(`${prefix}.xMun`) ?? ''

    return (
        <div className="mt-4 pt-4 border-t">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Endereço</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="col-span-2 lg:col-span-2">
                    <CF name={`${prefix}.xLgr`}  control={control} label="Logradouro" />
                </div>
                <CF name={`${prefix}.nro`}        control={control} label="Número" />
                <CF name={`${prefix}.xBairro`}    control={control} label="Bairro" />
                <div>
                    <Label className="text-sm">UF</Label>
                    <Controller name={`${prefix}.uf`} control={control} render={({ field }) => (
                        <Select value={field.value} onValueChange={v => {
                            field.onChange(v)
                            setValue(`${prefix}.xMun`, '')
                            setValue(`${prefix}.cMun`, '')
                        }}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder="UF" /></SelectTrigger>
                            <SelectContent>
                                {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )} />
                </div>
                <div className="col-span-2">
                    <Label className="text-sm">Município</Label>
                    <MunicipioPicker
                        uf={ufVal}
                        value={xMunVal}
                        onChange={(xMun, cMun) => {
                            setValue(`${prefix}.xMun`, xMun)
                            setValue(`${prefix}.cMun`, cMun)
                        }}
                        placeholder="Selecione o município..."
                    />
                </div>
                <CF name={`${prefix}.cep`} control={control} label="CEP" mono
                    mask={v => { const d = v.replace(/\D/g, '').slice(0, 8); return d.length <= 5 ? d : `${d.slice(0,5)}-${d.slice(5)}` }}
                    strip={/\D/g} />
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

