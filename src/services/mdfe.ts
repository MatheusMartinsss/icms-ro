import axios from 'axios'

export async function emitirMdfe(payload: { infMDFe: unknown; ambiente: string }) {
    const response = await axios.post('/api/nuvem/mdfe/emitir', payload)
    return response.data
}

export async function encerrarMdfe(id: string, opts: {
    cuf: number; dhEnc: string; cMun: string; xJust?: string
}) {
    const response = await axios.post(`/api/nuvem/mdfe/${id}/encerrar`, opts)
    return response.data
}

export async function cancelarMdfe(id: string, justificativa?: string) {
    const response = await axios.post(`/api/nuvem/mdfe/${id}/cancelar`, {
        justificativa: justificativa ?? 'Erro na emissão do documento fiscal',
    })
    return response.data
}

export async function imprimirMdfe(id: string) {
    const response = await axios.get(`/api/nuvem/mdfe/${id}/imprimir`, { responseType: 'blob' })
    const blob = new Blob([response.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)

    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:0;opacity:0'
    iframe.src = url
    document.body.appendChild(iframe)
    iframe.onload = () => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        setTimeout(() => {
            document.body.removeChild(iframe)
            window.URL.revokeObjectURL(url)
        }, 60_000)
    }
}
