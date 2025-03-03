import axios from "axios";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const body = await request.json();
    const API_URL = process.env.NEXT_PUBLIC_DARE_API_URL;

    try {
        const response = await axios.post(`${API_URL}/dare`, body, {
            responseType: 'arraybuffer'
        });

        // Create a new response with PDF buffer
        return new NextResponse(response.data, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="document.pdf"'
            }
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { error: 'Failed to generate PDF' },
            { status: 500 }
        );
    }
}