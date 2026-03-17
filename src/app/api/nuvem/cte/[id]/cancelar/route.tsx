import { NextResponse } from 'next/server'
import { nuvemFiscal } from '@/lib/nuvemFiscal'

export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params

        if (!id) {
            return NextResponse.json(
                { error: 'ID do CT-e é obrigatório' },
                { status: 400 }
            )
        }

        const body = await req.json()

        const justificativa = body?.justificativa

        if (!justificativa || justificativa.length < 15) {
            return NextResponse.json(
                { error: 'Justificativa é obrigatória e deve ter pelo menos 15 caracteres' },
                { status: 400 }
            )
        }

        const payload = {
            justificativa,
        }

        console.log('CTE_CANCELAMENTO =>', { id, payload })

        // ⚠️ ajuste caso a API use outro path
        const { data } = await nuvemFiscal.post(
            `/cte/${id}/cancelamento`,
            payload
        )

        return NextResponse.json(data)
    } catch (err: any) {
        return NextResponse.json(
            {
                error: 'Falha ao cancelar CT-e',
                details: err?.response?.data || err?.message,
            },
            { status: 500 }
        )
    }
}
