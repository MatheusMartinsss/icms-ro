import axios from "axios"
import { NextResponse } from "next/server"
import { limitar } from "@/lib/rate-limit"

export async function POST(request: Request) {
    // Cada consulta gasta cota do Google. O site é público, então limita por IP.
    const bloqueio = limitar(request, "distancia", 60, 10 * 60_000)
    if (bloqueio) return bloqueio

    const { body } = await request.json()
    const API_KEY = process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY
    const API_URL = process.env.GOOGLE_API_URL || process.env.NEXT_PUBLIC_GOOGLE_API_URL || "https://maps.googleapis.com/maps/api/distancematrix/json"
    try {
        const result = await axios.get(API_URL!, {
            params: { destinations: body?.destino, origins: body?.origem, key: API_KEY },
        })
        return NextResponse.json(result.data)
    } catch (error) {
        console.log(error)
        return NextResponse.json({ error: 'Falha ao consultar a distância' }, { status: 502 })
    }
}
