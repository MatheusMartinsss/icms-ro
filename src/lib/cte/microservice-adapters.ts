export function adaptToMicroservice(infCte: any, empresa: any): Record<string, any> {
    return {
        cnpj: empresa.cnpj.replace(/\D/g, ''),
        ide: adaptIde(infCte.ide),
        emit: {
            CRT: infCte.emit?.CRT ?? 3,
            enderEmit: buildEnderEmit(empresa),
        },
        ...(infCte.compl ? { compl: infCte.compl } : {}),
        rem: infCte.rem,
        dest: infCte.dest,
        ...(infCte.exped ? { exped: infCte.exped } : {}),
        ...(infCte.receb ? { receb: infCte.receb } : {}),
        vPrest: adaptVPrest(infCte.vPrest),
        imp: adaptImp(infCte.imp),
        infCTeNorm: adaptInfCTeNorm(infCte.infCTeNorm),
        ...(infCte.infAdic ? { infAdic: infCte.infAdic } : {}),
    }
}

export function adaptIde(ide: any): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { mod, cDV, toma3, toma4, ...rest } = ide
    const toma = toma4 ?? toma3 ?? { toma: 3 }
    return { ...rest, modal: Number(rest.modal), toma }
}

export function buildEnderEmit(empresa: any): Record<string, any> {
    return Object.fromEntries(
        Object.entries({
            xLgr:    empresa.xLgr    || undefined,
            nro:     empresa.nro     || undefined,
            xCpl:    empresa.xCompl  || undefined,
            xBairro: empresa.xBairro || undefined,
            cMun:    empresa.cMunEnv || undefined,
            xMun:    empresa.xMunEnv || undefined,
            UF:      empresa.ufEnv   || undefined,
            CEP:     empresa.cep ? empresa.cep.replace(/\D/g, '') : undefined,
            fone:    empresa.fone    || undefined,
        }).filter(([, v]) => v !== undefined)
    )
}

export function adaptVPrest(vPrest: any): Record<string, any> {
    if (!vPrest) return vPrest
    const { Comp, comp, ...rest } = vPrest
    return { ...rest, comp: Comp ?? comp ?? [] }
}

export function adaptImp(imp: any): Record<string, any> {
    if (!imp?.ICMS) return imp
    const icms = imp.ICMS
    const groupKey = Object.keys(icms).find(k => /^ICMS/i.test(k))
    if (!groupKey) return imp
    const inner = icms[groupKey]
    const { CST, cst: cstLower, ...fields } = inner
    return { ...imp, ICMS: { cst: CST ?? cstLower ?? '', ...fields } }
}

export function adaptInfCTeNorm(infCTeNorm: any): Record<string, any> {
    if (!infCTeNorm) return infCTeNorm
    const { infModal, ...rest } = infCTeNorm
    const modal: Record<string, any> = {}
    if (infModal?.rodo)   modal.rodo   = infModal.rodo
    if (infModal?.aereo)  modal.aereo  = infModal.aereo
    if (infModal?.ferrov) modal.ferrov = infModal.ferrov
    return { ...rest, ...modal }
}

export const STATUS_MAP: Record<string, string> = {
    authorized: 'autorizado',
    rejected:   'rejeitado',
    cancelled:  'cancelado',
    pending:    'pendente',
    error:      'erro',
}

export function adaptResponse(data: any): Record<string, any> {
    const status = STATUS_MAP[data.status] ?? data.status
    return {
        id:      data.id,
        status,
        numero:  data.numero,
        serie:   data.serie,
        chave:   data.chave,
        autorizacao: {
            numero_protocolo: data.n_prot ?? null,
            motivo_status:    data.xmotivo ?? null,
            codigo_status:    data.cstat ? Number(data.cstat) : null,
        },
    }
}
