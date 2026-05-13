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

export async function encerrarMdfePorChave(chave: string, opts: {
    cuf: number; dhEnc: string; cMun: string
}) {
    const response = await axios.post('/api/nuvem/mdfe/encerrar-chave', { chave, ...opts })
    return response.data
}

export async function cancelarMdfe(id: string, justificativa?: string) {
    const response = await axios.post(`/api/nuvem/mdfe/${id}/cancelar`, {
        justificativa: justificativa ?? 'Erro na emissão do documento fiscal',
    })
    return response.data
}

export function imprimirMdfe(id: string) {
    window.open(`/api/nuvem/mdfe/${id}/imprimir`, '_blank', 'noopener,noreferrer')
    return Promise.resolve()
}
