import axios from 'axios'

interface ListCteParams {
    cpf_cnpj: string
    $top?: number
    $skip?: number
    $inlinecount?: boolean
    referencia?: string
    chave?: string
    serie?: string
}

export async function listarCte(params: ListCteParams) {
    const response = await axios.get('/api/nuvem/cte', {
        params: {
            ...params,
            cpf_cnpj: params.cpf_cnpj.replace(/\D/g, ''),
            $top: params.$top ?? 10,
            $skip: params.$skip ?? 0,
            $inlinecount: params.$inlinecount ?? false,
        },
    })

    return response.data
}

export async function emitirCte(payload: any) {
    const response = await axios.post('/api/nuvem/cte/emitir', payload)
    return response.data
}


export async function sincronizarCte(id: string) {
    const response = await axios.post(`/api/ctes/${id}/sync`)
    return response.data
}

export async function cancelarCte(id: string, justificativa: string) {
    const response = await axios.post(`/api/nuvem/cte/${id}/cancelar`, {
        justificativa: justificativa ?? 'Erro na emissão do documento fiscal'
    })
    return response.data
}

function openPdfBlob(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => window.URL.revokeObjectURL(url), 60_000)
}

export async function previewDacte(payload: any) {
    const response = await axios.post('/api/nuvem/cte/previa-dacte', payload, { responseType: 'blob' })
    openPdfBlob(new Blob([response.data], { type: 'application/pdf' }), 'previa-dacte.pdf')
}

export async function imprimirCte(id: string) {
    const response = await axios.get(`/api/ctes/${id}/dacte`, { responseType: 'blob' })
    openPdfBlob(new Blob([response.data], { type: 'application/pdf' }), `dacte-${id}.pdf`)
}

