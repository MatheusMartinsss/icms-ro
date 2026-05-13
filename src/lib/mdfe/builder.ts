export type Ambiente = 'homologacao' | 'producao'

function genCMDF() {
    return String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
}

function omitNil<T extends Record<string, any>>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ) as Partial<T>
}

export interface EmpresaConfig {
    cnpj?: string
    cpf?: string
    ie?: string
    razaoSocial?: string
    nomeFantasia?: string
    cuf?: string          // ex: "11" para RO
    ufEnv?: string        // ex: "RO"
    xMunEnv?: string
    cMunEnv?: string
    xLgr?: string
    nro?: string
    xCompl?: string
    xBairro?: string
    cep?: string
    fone?: string
    email?: string
    rntrc?: string
    sequenciaMdfe?: number
    serieMdfe?: number
}

export interface CteSelecionado {
    chave: string           // 44 dígitos
    cMunDescarga: string    // código IBGE do município de descarga
    xMunDescarga: string    // nome do município de descarga
}

export interface PropVeiculo {
    rntrc:  string
    xNome:  string
    tpProp: number          // 0=TAC Agregado, 1=TAC Independente, 2=Outros
    cpf?:   string
    cnpj?:  string
    ie?:    string
    uf?:    string
}

export interface ProdPred {
    tpCarga: string
    xProd:   string
    ncm?:    string
    infLotacao?: {
        cepCarrega?:    string
        cepDescarrega?: string
    }
}

export interface VeicTracao {
    placa:   string
    tpRod:   string
    tpCar:   string
    uf:      string
    tara:    number
    capKG?:  number
    capM3?:  number
    cInt?:   string
    renavam?: string
    prop?:   PropVeiculo
    prodPred?: ProdPred
}

export interface VeicReboque {
    placa:   string
    tpCar:   string
    tara:    number
    capKG?:  number
    capM3?:  number
    uf?:     string
    renavam?: string
    cInt?:   string
    prop?:   PropVeiculo
}

export interface Condutor {
    xNome: string
    cpf: string
}

export interface BuildIdeOpts {
    nMDF: number
    serie: number
    ufIni: string
    ufFim: string
    munCarrega: Array<{ cMun: string; xMun: string }>
    percurso?: string[]     // UFs intermediárias
    dhIniViagem?: string
    modal?: number          // 1=Rodoviário (default)
    tpEmit?: number         // 1=Transportador (default)
}

export interface BuildTotOpts {
    vCarga: number
    qCarga: number
    cUnid: '01' | '02'   // 01=KG, 02=TON
}

export interface InfPag {
    xNome:     string
    cnpj?:     string
    cpf?:      string
    chPix?:    string
    indPag:    '0' | '1'
    vContrato: number
    comp:      Array<{ tpComp: string; vComp: number }>
}

export interface SegCarga {
    respSeg: '1' | '2'
    cnpj?: string
    cpf?: string
    infSeg?: {
        xSeg: string
        cnpj?: string
    }
    nApol?: string
    nAver?: string[]
}

export class MdfeBuilder {
    private ambiente: Ambiente = 'producao'
    private ide: any = {}
    private emit: any = {}
    private rodo: any = {}
    private condutores: Condutor[] = []
    private contratantes: Array<{ cnpj?: string; cpf?: string; xNome?: string }> = []
    private ctes: CteSelecionado[] = []
    private tot: any = {}
    private infAdic: any = {}
    private seg: SegCarga | null = null
    private pags: InfPag[] = []

    constructor(private empresa: EmpresaConfig) {}

    setAmbiente(a: Ambiente) {
        this.ambiente = a
        return this
    }

    buildIde(opts: BuildIdeOpts) {
        const cMDF = genCMDF()
        this.ide = {
            cUF: Number(this.empresa.cuf ?? '11'),
            tpAmb: this.ambiente === 'producao' ? 1 : 2,
            tpEmit: opts.tpEmit ?? 1,
            mod: 58,
            serie: opts.serie,
            nMDF: opts.nMDF,
            cMDF,
            modal: opts.modal ?? 1,
            dhEmi: new Date().toISOString(),
            tpEmis: 1,
            procEmi: '0',
            verProc: '1.0',
            UFIni: opts.ufIni,
            UFFim: opts.ufFim,
            infMunCarrega: opts.munCarrega.map(m => ({ cMunCarrega: m.cMun, xMunCarrega: m.xMun })),
            ...(opts.percurso?.length ? { infPercurso: opts.percurso.map(uf => ({ UFPer: uf })) } : {}),
            ...(opts.dhIniViagem ? { dhIniViagem: opts.dhIniViagem } : {}),
        }
        return this
    }

    buildEmit() {
        const e = this.empresa
        this.emit = {
            ...omitNil({ CNPJ: e.cnpj?.replace(/\D/g, '') || undefined, CPF: e.cpf?.replace(/\D/g, '') || undefined }),
            IE: e.ie ?? '',
            xNome: e.razaoSocial ?? '',
            ...omitNil({ xFant: e.nomeFantasia || undefined }),
            enderEmit: omitNil({
                xLgr: e.xLgr, nro: e.nro, xCpl: e.xCompl,
                xBairro: e.xBairro, cMun: e.cMunEnv, xMun: e.xMunEnv,
                CEP: e.cep?.replace(/\D/g, ''), UF: e.ufEnv,
                fone: e.fone?.replace(/\D/g, '') || undefined,
                email: e.email || undefined,
            }),
        }
        return this
    }

    buildRodo(veic: VeicTracao, prodPred?: ProdPred, reboque?: VeicReboque[]) {
        const buildProp = (p: PropVeiculo) => omitNil({
            ...omitNil({ CPF: p.cpf?.replace(/\D/g, '') || undefined, CNPJ: p.cnpj?.replace(/\D/g, '') || undefined }),
            RNTRC:  p.rntrc,
            xNome:  p.xNome,
            IE:     p.ie  || undefined,
            UF:     p.uf  || undefined,
            tpProp: p.tpProp,
        })

        this.rodo = {
            infANTT: {
                RNTRC: this.empresa.rntrc ?? '',
            },
            ...(prodPred ? { prodPred: {
                tpCarga: prodPred.tpCarga,
                xProd:   prodPred.xProd,
                ...(prodPred.ncm ? { NCM: prodPred.ncm } : {}),
                ...(prodPred.infLotacao ? { infLotacao: prodPred.infLotacao } : {}),
            }} : {}),
            veicTracao: omitNil({
                cInt:    veic.cInt || '01',
                placa:   veic.placa.replace(/[^A-Z0-9]/gi, '').toUpperCase(),
                tpRod:   veic.tpRod,
                tpCar:   veic.tpCar,
                UF:      veic.uf || undefined,
                tara:    veic.tara,
                capKG:   veic.capKG || undefined,
                capM3:   veic.capM3 || undefined,
                RENAVAM: veic.renavam || undefined,
                prop: veic.prop ? buildProp(veic.prop) : undefined,
                // condutores são adicionados em build() após addCondutor()
            }),
            ...(reboque?.length ? {
                veicReboque: reboque.map(r => omitNil({
                    cInt:    r.cInt || undefined,
                    placa:   r.placa.replace(/[^A-Z0-9]/gi, '').toUpperCase(),
                    tpCar:   r.tpCar,
                    UF:      r.uf || undefined,
                    tara:    r.tara,
                    capKG:   r.capKG || undefined,
                    capM3:   r.capM3 || undefined,
                    RENAVAM: r.renavam || undefined,
                    prop:    r.prop ? buildProp(r.prop) : undefined,
                })),
            } : {}),
        }
        return this
    }

    addCondutor(c: Condutor) {
        this.condutores.push(c)
        return this
    }

    addContratante(c: { cnpj?: string; cpf?: string; xNome?: string }) {
        this.contratantes.push(c)
        return this
    }

    addCtes(ctes: CteSelecionado[]) {
        this.ctes = ctes
        return this
    }

    buildTot(opts: BuildTotOpts) {
        this.tot = {
            qCTe: this.ctes.length,
            qNFe: 0,
            qMDFe: 0,
            vCarga: opts.vCarga,
            cUnid: opts.cUnid,
            qCarga: opts.qCarga,
        }
        return this
    }

    buildAdic(infCpl: string) {
        if (infCpl?.trim()) this.infAdic = { infCpl: infCpl.trim() }
        return this
    }

    buildSeg(seg: SegCarga) {
        this.seg = seg
        return this
    }

    buildPag(pags: InfPag[]) {
        this.pags = pags
        return this
    }

    /** Agrupa CT-es por município de descarga → infDoc.infMunDescarga */
    private buildInfDoc() {
        const byMun = new Map<string, { xMunDescarga: string; ctes: string[] }>()
        for (const cte of this.ctes) {
            const key = cte.cMunDescarga
            if (!byMun.has(key)) byMun.set(key, { xMunDescarga: cte.xMunDescarga, ctes: [] })
            byMun.get(key)!.ctes.push(cte.chave)
        }
        return {
            infMunDescarga: Array.from(byMun.entries()).map(([cMunDescarga, { xMunDescarga, ctes }]) => ({
                cMunDescarga,
                xMunDescarga,
                infCTe: ctes.map(chCTe => ({ chCTe })),
            })),
        }
    }

    build() {
        if (!this.condutores.length) throw new Error('Pelo menos um condutor é obrigatório')
        if (!this.ctes.length) throw new Error('Pelo menos um CT-e é obrigatório')

        const rodo = {
            ...this.rodo,
            infANTT: {
                ...this.rodo.infANTT,
                ...(this.contratantes.length ? { infContratante: this.contratantes } : {}),
            },
            ...(this.pags.length ? { infPag: this.pags } : {}),
            veicTracao: {
                ...this.rodo.veicTracao,
                condutor: this.condutores.map(c => ({
                    xNome: c.xNome,
                    CPF:   c.cpf.replace(/\D/g, ''),
                })),
            },
        }

        const infMDFe = {
            versao: '3.00',
            ide: this.ide,
            emit: this.emit,
            infModal: {
                versaoModal: '3.00',
                rodo,
            },
            infDoc: this.buildInfDoc(),
            ...(this.seg ? { seg: this.seg } : {}),
            tot: this.tot,
            ...(Object.keys(this.infAdic).length ? { infAdic: this.infAdic } : {}),
        }

        return { infMDFe, ambiente: this.ambiente }
    }
}
