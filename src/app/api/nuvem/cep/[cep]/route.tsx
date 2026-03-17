import { NextResponse } from 'next/server'
import { nuvemFiscal } from '@/lib/nuvemFiscal'

export async function GET(
    _req: Request,
    { params }: { params: { cep: string } }
) {
    try {
        const cep = params.cep.replace(/\D/g, '')
        const { data } = await nuvemFiscal.get(`/cep/${cep}`)
        return NextResponse.json(data)
    } catch (err: any) {
        return NextResponse.json(
            { error: 'Falha ao consultar CEP', details: err?.response?.data || err?.message },
            { status: 500 }
        )
    }
}  