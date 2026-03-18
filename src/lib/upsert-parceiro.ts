import { prisma } from './prisma'

interface ParteInfCte {
    xNome?: string
    CNPJ?: string | number
    CPF?: string | number
    IE?: string
    fone?: string
    email?: string
    enderReme?: Endereco
    enderDest?: Endereco
    enderExped?: Endereco
    enderReceb?: Endereco
}

interface Endereco {
    xLgr?: string
    nro?: string
    xCompl?: string
    xBairro?: string
    cMun?: string
    xMun?: string
    UF?: string
    CEP?: string | number
}

function pickEnder(parte: ParteInfCte): Endereco {
    return parte.enderReme ?? parte.enderDest ?? parte.enderExped ?? parte.enderReceb ?? {}
}

/** Upsert a parceiro by CNPJ or CPF. Returns the parceiro id, or null if no document is present. */
export async function upsertParceiro(
    empresaId: string,
    parte: ParteInfCte,
): Promise<string | null> {
    const cnpj = String(parte.CNPJ ?? '').replace(/\D/g, '') || null
    const cpf  = String(parte.CPF  ?? '').replace(/\D/g, '') || null
    const doc  = cnpj ?? cpf
    if (!doc) return null

    const end = pickEnder(parte)
    const data = {
        tipoPessoa: cnpj ? 'J' : 'F',
        xNome:   parte.xNome   ?? '',
        cnpj:    cnpj,
        cpf:     cpf,
        ie:      parte.IE      ?? null,
        fone:    parte.fone    ?? null,
        email:   parte.email   ?? null,
        xLgr:    end.xLgr     ?? null,
        nro:     end.nro      ?? null,
        xCompl:  end.xCompl   ?? null,
        xBairro: end.xBairro  ?? null,
        cMun:    end.cMun     ?? null,
        xMun:    end.xMun     ?? null,
        uf:      end.UF       ?? null,
        cep:     String(end.CEP ?? '').replace(/\D/g, '') || null,
        cPais:   '1058',
        xPais:   'BRASIL',
    }

    const where = cnpj ? { empresaId, cnpj } : { empresaId, cpf: cpf! }
    const existing = await prisma.parceiro.findFirst({ where, select: { id: true } })

    if (existing) {
        await prisma.parceiro.update({ where: { id: existing.id }, data })
        return existing.id
    }

    const created = await prisma.parceiro.create({ data: { empresaId, ...data } })
    return created.id
}
