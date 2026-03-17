import { NextResponse } from 'next/server'
import { nuvemFiscal } from '@/lib/nuvemFiscal'

type Ambiente = 'homologacao' | 'producao'

export async function POST(req: Request) {
    try {
        const body = await req.json()

        const ambiente: Ambiente = body?.ambiente ?? 'producao'
        const infCte = body?.infCte

        if (!infCte) {
            return NextResponse.json(
                { error: 'Body inválido: infCte é obrigatório' },
                { status: 400 }
            )
        }

        if (!infCte?.ide) {
            return NextResponse.json(
                { error: 'Body inválido: infCte.ide é obrigatório' },
                { status: 400 }
            )
        }

        // ✅ garante cCT (muita rejeição quando vazio)
        if (!infCte.ide.cCT || String(infCte.ide.cCT).trim() === '') {
            infCte.ide.cCT = genCct8()
        }

        // ✅ garante dhEmi
        if (!infCte.ide.dhEmi) {
            infCte.ide.dhEmi = new Date().toISOString()
        }

        // ✅ monta payload final
        const payload = {
            ambiente,
            referencia: body?.referencia,
            infCte,
        }

        // log no servidor (útil pra debugar)
        console.log('CTE_EMITIR_PAYLOAD =>', JSON.stringify(payload, null, 2))

        // ⚠️ ajuste o endpoint se a Nuvem Fiscal usar outro caminho:
        // ex: '/cte' ou '/cte/emissao' ou '/cte/emitir'
        const { data } = await nuvemFiscal.post('/cte', payload)

        return NextResponse.json(data)
    } catch (err: any) {
        return NextResponse.json(
            {
                error: 'Falha ao emitir CT-e',
                details: err?.response?.data || err?.message,
            },
            { status: 500 }
        )
    }
}

function genCct8() {
    // string numérica de 8 dígitos
    return String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
}
