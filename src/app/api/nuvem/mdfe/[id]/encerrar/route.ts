import { nuvemFiscal } from '@/lib/nuvemFiscal'
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const body = await req.json()
        const { cuf, dhEnc, cMun, xJust } = body
        const { data } = await nuvemFiscal.post(`/mdfe/${params.id}/encerramento`, {
            cuf, dhEnc, cMun, xJust,
        })
        return NextResponse.json(data)
    } catch (err: any) {
        return NextResponse.json(
            { error: 'Falha ao encerrar MDF-e', details: err?.response?.data || err?.message },
            { status: 500 },
        )
    }
}
