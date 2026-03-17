import { NextResponse } from 'next/server'
import { nuvemFiscal } from '@/lib/nuvemFiscal'

export async function GET(_req: Request, { params }: { params: { cnpj: string } }) {
    const cnpj = params.cnpj.replace(/\D/g, '')
    if (cnpj.length !== 14) {
        return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 })
    }
    try {
        const { data } = await nuvemFiscal.get(`/cnpj/${cnpj}`)

        const endereco = data.endereco ?? {}
        const municipio = endereco.municipio ?? {}

        return NextResponse.json({
            razaoSocial: data.razao_social ?? '',
            nomeFantasia: data.nome_fantasia ?? '',
            uf: endereco.uf ?? '',
            xMun: municipio.descricao ?? '',
            cMun: municipio.codigo_ibge ?? '',
            cep: (endereco.cep ?? '').replace(/\D/g, ''),
            logradouro: endereco.logradouro ?? '',
            numero: endereco.numero ?? '',
            bairro: endereco.bairro ?? '',
            email: data.email ?? '',
            telefone: data.telefones?.[0]
                ? `${data.telefones[0].ddd}${data.telefones[0].numero}`.replace(/\D/g, '')
                : '',
        })
    } catch (err: any) {
        const status = err?.response?.status === 404 ? 404 : 500
        return NextResponse.json(
            { error: status === 404 ? 'CNPJ não encontrado' : 'Erro ao consultar CNPJ' },
            { status }
        )
    }
}
