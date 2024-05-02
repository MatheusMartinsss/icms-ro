import axios from "axios"
import { NextResponse } from "next/server"
const cheerio = require('cheerio')

export async function POST(request: Request) {
    const { body } = await request.json()
    const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY
    const API_URL = process.env.NEXT_PUBLIC_GOOGLE_API_URL
    try {

        const URL = `${API_URL}?destinations=${body.destino}&origins=${body.origem}&key=${API_KEY}`
        const result = await axios.get(URL)
        return NextResponse.json(result.data)
    } catch (error) {
        console.log(error)
    }

}
