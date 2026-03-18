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

export interface VeicTracao {
    placa: string
    tpRod: string   // '01'=Truck, '02'=Toco, '03'=Cavalo, '04'=VAN, '05'=Utilitário, '06'=Outros
    tpCar: string   // '00'=N/A, '01'=Aberta, '02'=Fechada/Baú, '03'=Graneleira, '04'=Porta Container, '05'=Sider
    uf: string
    tara?: number
    capKG?: number
    cInt?: string
    renavam?: string
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

export class MdfeBuilder {
    private ambiente: Ambiente = 'producao'
    private ide: any = {}
    private emit: any = {}
    private rodo: any = {}
    private condutores: Condutor[] = []
    private ctes: CteSelecionado[] = []
    private tot: any = {}
    private infAdic: any = {}

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

    buildRodo(veic: VeicTracao) {
        this.rodo = {
            infANTT: {
                RNTRC: this.empresa.rntrc ?? '',
            },
            veicTracao: omitNil({
                cInt: veic.cInt || '01',
                placa: veic.placa.replace(/[^A-Z0-9]/gi, '').toUpperCase(),
                tpRod: veic.tpRod,
                tpCar: veic.tpCar,
                UF: veic.uf,
                tara: veic.tara,
                capKG: veic.capKG,
                RENAVAM: veic.renavam || undefined,
                condutor: this.condutores.map(c => ({
                    xNome: c.xNome,
                    CPF: c.cpf.replace(/\D/g, ''),
                })),
            }),
        }
        return this
    }

    addCondutor(c: Condutor) {
        this.condutores.push(c)
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

        const infMDFe = {
            versao: '3.00',
            ide: this.ide,
            emit: this.emit,
            infModal: {
                versaoModal: '3.00',
                rodo: this.rodo,
            },
            infDoc: this.buildInfDoc(),
            tot: this.tot,
            ...(Object.keys(this.infAdic).length ? { infAdic: this.infAdic } : {}),
        }

        return { infMDFe, ambiente: this.ambiente }
    }
}
