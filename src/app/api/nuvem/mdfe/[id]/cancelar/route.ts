import { nuvemFiscal } from '@/lib/nuvemFiscal'
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const body = await req.json()
        const justificativa = body.justificativa ?? 'Erro na emissão do documento fiscal'
        const { data } = await nuvemFiscal.post(`/mdfe/${params.id}/cancelamento`, { justificativa })
        return NextResponse.json(data)
    } catch (err: any) {
        return NextResponse.json(
            { error: 'Falha ao cancelar MDF-e', details: err?.response?.data || err?.message },
            { status: 500 },
        )
    }
}
