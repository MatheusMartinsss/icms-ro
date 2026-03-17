import { NextResponse } from 'next/server'
import { nuvemFiscal } from '@/lib/nuvemFiscal'

export async function GET(
    _req: Request,
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

        // Axios no Node: pegue como arraybuffer
        const res = await nuvemFiscal.get(`/cte/${id}/pdf`, {
            responseType: 'arraybuffer',
        })

        // ✅ converte para Uint8Array (aceito como BodyInit)
        const bytes = new Uint8Array(res.data)

        return new NextResponse(bytes, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="cte-${id}.pdf"`,
                'Cache-Control': 'no-store',
            },
        })
    } catch (err: any) {
        return NextResponse.json(
            {
                error: 'Falha ao gerar PDF do CT-e',
                details: err?.response?.data || err?.message,
            },
            { status: 500 }
        )
    }
}
