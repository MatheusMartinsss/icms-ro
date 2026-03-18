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


export async function cancelarCte(id: string, justificativa: string) {
    const response = await axios.post(`/api/nuvem/cte/${id}/cancelar`, {
        justificativa: justificativa ?? 'Erro na emissão do documento fiscal'
    })
    return response.data
}

export async function imprimirCte(id: string) {
    const response = await axios.get(`/api/nuvem/cte/${id}/imprimir`, { responseType: 'blob' })

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

