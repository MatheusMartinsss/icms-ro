import { nuvemFiscal } from '@/lib/nuvemFiscal'
import { NextResponse } from 'next/server'

function genCMDF() {
    return String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { infMDFe, ambiente = 'producao', referencia } = body

        if (!infMDFe) return NextResponse.json({ error: 'infMDFe obrigatório' }, { status: 400 })

        if (!infMDFe.ide?.cMDF || String(infMDFe.ide.cMDF).trim() === '') {
            infMDFe.ide.cMDF = genCMDF()
        }
        if (!infMDFe.ide?.dhEmi) {
            infMDFe.ide.dhEmi = new Date().toISOString()
        }

        const payload = { infMDFe, ambiente, ...(referencia ? { referencia } : {}) }
        console.log('MDFE_EMITIR_PAYLOAD =>', JSON.stringify(payload, null, 2))

        const { data } = await nuvemFiscal.post('/mdfe', payload)
        return NextResponse.json(data)
    } catch (err: any) {
        return NextResponse.json(
            { error: 'Falha ao emitir MDF-e', details: err?.response?.data || err?.message },
            { status: 500 },
        )
    }
}
