export type Ambiente = 'homologacao' | 'producao'
export type Toma3 = 0 | 1 | 2 | 3

type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

function mergeShallow<T extends object>(base: T, override?: Partial<T>) {
    return { ...base, ...(override ?? {}) }
}

function mergeNested<T extends Record<string, any>>(
    base: T,
    override?: DeepPartial<T>
): T {
    if (!override) return base
    const out: any = { ...base }
    for (const k of Object.keys(override)) {
        const ov = (override as any)[k]
        if (ov && typeof ov === 'object' && !Array.isArray(ov)) {
            out[k] = mergeNested(base[k] ?? {}, ov)
        } else {
            out[k] = ov
        }
    }
    return out
}

function genCct8() {
    return String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
}

function getIndIEToma(nfe: any): 1 | 9 {
    const dest = nfe?.dest
    if (dest?.CPF) return 9
    if (dest?.CNPJ) return 1
    return 9
}

export class CtePartesBuilder {
    private ide: any = {}
    private emit: any = {}
    private compl: any = {}
    private vPrest: any = {}
    private imp: any = {}
    private infCteNorm: any = {}
    private ambiente: Ambiente = 'producao'
    private rem: any = {}
    private dest: any = {}

    constructor(private nfe: any) { }

    setAmbiente(ambiente: Ambiente) {
        this.ambiente = ambiente
        return this
    }

    private getChaveNfe(): string {
        const ch1 = this.nfe?.raw?.nfeProc?.protNFe?.infProt?.chNFe
        if (typeof ch1 === 'string' && ch1.trim()) return ch1.trim()

        const ch2 = this.nfe?.raw?.protNFe?.infProt?.chNFe
        if (typeof ch2 === 'string' && ch2.trim()) return ch2.trim()

        const id =
            this.nfe?.raw?.nfeProc?.NFe?.infNFe?.$?.Id ??
            this.nfe?.raw?.NFe?.infNFe?.$?.Id

        if (typeof id === 'string' && id.startsWith('NFe')) {
            return id.replace(/^NFe/, '').trim()
        }

        return ''
    }

    builIde(override?: DeepPartial<typeof this.ide>) {
        const baseIde = {
            cUF: 11,
            cCT: '',
            CFOP: '6352',
            natOp: 'Prestações de serviços de transporte',
            mod: 57,
            serie: 99,
            nCT: 2,
            dhEmi: new Date().toISOString(),
            tpImp: 1,
            tpEmis: 1,
            cDV: 0,
            tpAmb: 1,
            tpCTe: 0,
            procEmi: 0,
            verProc: '1.0.0',
            cMunEnv: '1100452',
            xMunEnv: 'BURITIS',
            UFEnv: 'RO',
            modal: '01',
            tpServ: 0,

            cMunIni: this.nfe.emit?.enderEmit?.cMun ?? '',
            xMunIni: this.nfe.emit?.enderEmit?.xMun ?? '',
            UFIni: this.nfe.emit?.enderEmit?.UF ?? '',

            cMunFim: this.nfe.dest?.enderDest?.cMun ?? '',
            xMunFim: this.nfe.dest?.enderDest?.xMun ?? '',
            UFFim: this.nfe.dest?.enderDest?.UF ?? '',

            retira: 1,
            xDetRetira: undefined as string | undefined,

            indIEToma: getIndIEToma(this.nfe),

            toma3: { toma: 3 as Toma3 },
        }

        const merged = mergeNested(baseIde as any, override as any)

        // ✅ garante cCT se vazio
        if (!merged.cCT || String(merged.cCT).trim() === '') {
            merged.cCT = genCct8()
        }

        // ✅ se quiser permitir override do "toma" facilmente
        if (override?.toma3?.toma !== undefined) {
            merged.toma3 = { toma: override.toma3.toma as Toma3 }
        }

        // ✅ se troca o toma, você pode querer recalcular indIEToma baseado em quem é o tomador
        // Por enquanto mantém a regra do seu projeto: contrib = 1 se dest for CNPJ, 9 se CPF.
        // (se quiser eu te faço o cálculo correto por toma 0/1/2/3)
        merged.indIEToma = override?.indIEToma ?? baseIde.indIEToma

        this.ide = merged
        return this
    }

    buildCompl(override?: DeepPartial<typeof this.compl>) {
        const base = {
            xObs:
                'TRANSPORTE SUBCONTRATADO NOS TERMOS DO ANEXO XIII - PARTE 01 - CAPÍTULO 01 - SUBSEÇÃO 01 - ARTIGO 40 - DECRETO22.721/2018.CRÉDITO PRESUMIDO EM 20%,CONFORME ANEXO IV - PARTE 02 - ITEM 03 - SEÇÃO VI - ARTIGO 10 - DECRETO 22.721/2018.',
        }
        this.compl = mergeNested(base as any, override as any)
        return this
    }

    buildvPrest(
        override?: DeepPartial<typeof this.vPrest> | { total?: number; xNome?: string }
    ) {
        const total =
            (override as any)?.total ??
            18905.42

        const xNome =
            (override as any)?.xNome ??
            'Valor do Frete'

        const base = {
            vTPrest: total,
            vRec: total,
            Comp: [{ xNome: String(xNome).slice(0, 15), vComp: total }],
        }

        // se vierem overrides “full”
        this.vPrest = mergeNested(base as any, override as any)
        return this
    }

    buildImp(
        override?: DeepPartial<typeof this.imp> | { vBC?: number; pICMS?: number; vICMS?: number }
    ) {
        const vBC = (override as any)?.vBC ?? 18905.42
        const pICMS = (override as any)?.pICMS ?? 12.0
        const vICMS = (override as any)?.vICMS ?? 2268.65

        const base = {
            ICMS: {
                ICMS00: {
                    CST: '00',
                    vBC,
                    pICMS,
                    vICMS,
                },
            },
        }

        this.imp = mergeNested(base as any, override as any)
        return this
    }

    buildInfCteNorm(override?: DeepPartial<typeof this.infCteNorm>) {
        const vNF = Number(
            this.nfe?.raw?.nfeProc?.NFe?.infNFe?.total?.ICMSTot?.vNF ??
            this.nfe?.raw?.NFe?.infNFe?.total?.ICMSTot?.vNF ??
            this.nfe?.total?.ICMSTot?.vNF ??
            0
        )

        const chave = this.getChaveNfe()
        if (!chave) throw new Error('Chave da NF-e não encontrada no XML (chNFe/Id).')

        const base = {
            infCarga: {
                vCarga: vNF,
                proPred: 'MADEIRA',
                infQ: [
                    {
                        cUnid: '01',
                        tpMed: 'PESO LIQUIDO',
                        qCarga: Number(this.nfe?.peso ?? 0),
                    },
                ],
            },
            infDoc: {
                infNFe: [{ chave }],
            },
            infModal: {
                versaoModal: '4.00',
                rodo: {
                    RNTRC: '01188553',
                },
            },
        }

        this.infCteNorm = mergeNested(base as any, override as any)
        return this
    }

    buildEmitente(override?: DeepPartial<typeof this.emit>) {
        const base = {
            CNPJ: '29180936000123',
            IE: '000004925301',
            CRT: 3,
        }
        this.emit = mergeNested(base as any, override as any)
        return this
    }

    buildRemetente(override?: DeepPartial<typeof this.rem>) {
        const emit = this.nfe?.emit
        const isCnpj = !!emit?.CNPJ

        const base = {
            CNPJ: isCnpj ? String(emit?.CNPJ ?? '').replace(/\D/g, '') : undefined,
            CPF: !isCnpj ? String(emit?.CPF ?? '').replace(/\D/g, '') : undefined,
            IE: emit?.IE ?? '',
            xNome: emit?.xNome ?? '',
            xFant: emit?.xFant ?? undefined,
            fone: emit?.enderEmit?.fone ?? undefined,
            enderReme: {
                xLgr: emit?.enderEmit?.xLgr ?? '',
                nro: emit?.enderEmit?.nro ?? '',
                xCpl: emit?.enderEmit?.xCpl ?? undefined,
                xBairro: emit?.enderEmit?.xBairro ?? '',
                cMun: emit?.enderEmit?.cMun ?? '',
                xMun: emit?.enderEmit?.xMun ?? '',
                CEP: String(emit?.enderEmit?.CEP ?? '').replace(/\D/g, ''),
                UF: emit?.enderEmit?.UF ?? '',
                cPais: '1058',
                xPais: 'BRASIL',
            },
            email: emit?.email ?? undefined,
        }

        this.rem = mergeNested(base as any, override as any)
        return this
    }

    buildDestinatario(override?: DeepPartial<typeof this.dest>) {
        const dest = this.nfe?.dest
        const isCnpj = !!dest?.CNPJ

        const base = {
            CNPJ: isCnpj ? String(dest?.CNPJ ?? '').replace(/\D/g, '') : undefined,
            CPF: !isCnpj ? String(dest?.CPF ?? '').replace(/\D/g, '') : undefined,
            IE: dest?.IE ?? '',
            xNome: dest?.xNome ?? '',
            fone: dest?.fone ?? undefined,
            ISUF: dest?.ISUF ?? undefined,
            enderDest: {
                xLgr: dest?.enderDest?.xLgr ?? '',
                nro: dest?.enderDest?.nro ?? '',
                xCpl: dest?.enderDest?.xCpl ?? undefined,
                xBairro: dest?.enderDest?.xBairro ?? '',
                cMun: dest?.enderDest?.cMun ?? '',
                xMun: dest?.enderDest?.xMun ?? '',
                CEP: String(dest?.enderDest?.CEP ?? '').replace(/\D/g, ''),
                UF: dest?.enderDest?.UF ?? '',
                cPais: '1058',
                xPais: 'BRASIL',
            },
            email: dest?.email ?? undefined,
        }

        this.dest = mergeNested(base as any, override as any)
        return this
    }

    overrideRemetente(data: any) {
        this.rem = { ...this.rem, ...data }
        return this
    }

    overrideDestinatario(data: any) {
        this.dest = { ...this.dest, ...data }
        return this
    }

    build() {
        return {
            infCte: {
                versao: '4.00',
                ide: this.ide,
                emit: this.emit,
                rem: this.rem,
                dest: this.dest,
                compl: this.compl,
                vPrest: this.vPrest,
                imp: this.imp,
                infCTeNorm: this.infCteNorm,
            },
            ambiente: this.ambiente,
        }
    }
}
