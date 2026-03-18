import { nuvemFiscal } from '@/lib/nuvemFiscal'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
    try {
        const { data, headers } = await nuvemFiscal.get(`/mdfe/${params.id}/pdf`, {
            responseType: 'arraybuffer',
        })
        return new NextResponse(data, {
            headers: {
                'Content-Type': headers['content-type'] ?? 'application/pdf',
                'Content-Disposition': 'inline; filename="damdfe.pdf"',
            },
        })
    } catch (err: any) {
        return NextResponse.json(
            { error: 'Falha ao obter DAMDFE', details: err?.response?.data || err?.message },
            { status: 500 },
        )
    }
}
