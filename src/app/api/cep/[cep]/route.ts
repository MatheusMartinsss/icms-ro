import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: { cep: string } }) {
    const cep = params.cep.replace(/\D/g, '')
    if (cep.length !== 8)
        return NextResponse.json({ error: 'CEP inválido' }, { status: 400 })

    try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
        if (!res.ok) return NextResponse.json({ error: 'CEP não encontrado' }, { status: 404 })

        const data = await res.json()
        if (data.erro) return NextResponse.json({ error: 'CEP não encontrado' }, { status: 404 })

        return NextResponse.json({
            cep,
            xLgr:   data.logradouro ?? '',
            xCompl: data.complemento ?? '',
            xBairro: data.bairro ?? '',
            xMun:   data.localidade ?? '',
            cMun:   data.ibge ?? '',
            uf:     data.uf ?? '',
        })
    } catch {
        return NextResponse.json({ error: 'Erro ao consultar CEP' }, { status: 500 })
    }
}
