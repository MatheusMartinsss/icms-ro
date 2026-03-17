import { NextResponse } from 'next/server'
import { nuvemFiscal } from '@/lib/nuvemFiscal'

export async function GET(req: Request) {
    try {
        const url = new URL(req.url)

        const cpfCnpjRaw = url.searchParams.get('cpf_cnpj')
        const ambiente = 'producao'

        if (!cpfCnpjRaw) {
            return NextResponse.json(
                { error: 'Parâmetro cpf_cnpj é obrigatório' },
                { status: 400 }
            )
        }

        const cpf_cnpj = cpfCnpjRaw.replace(/\D/g, '')


        const top = clampInt(url.searchParams.get('$top') ?? '10', 1, 100)
        const skip = clampInt(url.searchParams.get('$skip') ?? '0', 0, 1_000_000)
        const inlinecount = toBool(url.searchParams.get('$inlinecount') ?? 'false')

        const referencia = url.searchParams.get('referencia') ?? undefined
        const chave = url.searchParams.get('chave') ?? undefined
        const serie = url.searchParams.get('serie') ?? undefined


        const qs = new URLSearchParams()
        qs.set('$top', String(top))
        qs.set('$skip', String(skip))
        qs.set('$inlinecount', String(inlinecount))
        qs.set('cpf_cnpj', cpf_cnpj)
        qs.set('ambiente', ambiente)

        if (referencia) qs.set('referencia', referencia)
        if (chave) qs.set('chave', chave)
        if (serie) qs.set('serie', serie)


        const { data } = await nuvemFiscal.get(`/cte?${qs.toString()}`)

        return NextResponse.json(data)
    } catch (err: any) {
        return NextResponse.json(
            {
                error: 'Falha ao listar CT-e',
                details: err?.response?.data || err?.message,
            },
            { status: 500 }
        )
    }
}

function clampInt(value: string, min: number, max: number) {
    const n = Number.parseInt(value, 10)
    if (Number.isNaN(n)) return min
    return Math.max(min, Math.min(max, n))
}

function toBool(value: string) {
    return value === 'true' || value === '1'
}
