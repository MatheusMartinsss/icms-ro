import type { ContribuinteEnvio, DareForm, Transportadora } from '@/lib/types'

export type ResultadoEmissao =
  | { ok: true; linhaDigitavel: string | null; dataVencimento: string | null; mesReferencia: string | null }
  | { ok: false; error: string }

export function baixarBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}

const contribuinte = (t: Transportadora): ContribuinteEnvio => ({
  cnpj: t.cnpj,
  razaoSocial: t.razaoSocial,
  cep: t.cep,
  logradouro: t.logradouro,
  numero: t.numero,
  bairro: t.bairro,
  municipio: t.municipio,
  uf: t.uf,
  telefone: t.telefone,
})

// Emite o DARE e baixa o PDF. Nunca lança exceção: devolve o erro para a tela
// mostrar o motivo. As telas usam o emitir do contexto, que grava o histórico.
export async function emitirDare(t: Transportadora, form: DareForm): Promise<ResultadoEmissao> {
  try {
    const res = await fetch('/api/dare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, transportadora: contribuinte(t) }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { ok: false, error: body.error || `Falha ao gerar o DARE (${res.status})` }
    }
    baixarBlob(await res.blob(), `dare-${form.notaFiscal}.pdf`)
    return {
      ok: true,
      linhaDigitavel: res.headers.get('X-Linha-Digitavel'),
      dataVencimento: res.headers.get('X-Data-Vencimento'),
      mesReferencia: res.headers.get('X-Mes-Referencia'),
    }
  } catch (error) {
    return { ok: false, error: `Sem conexão com o servidor: ${(error as Error).message}` }
  }
}
