export const onlyDigits = (value: unknown) => String(value ?? '').replace(/\D/g, '')

export function formatCnpj(cnpj: string) {
  const d = onlyDigits(cnpj)
  if (d.length !== 14) return cnpj
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

// Confere os dois dígitos verificadores.
export function isValidCnpj(cnpj: string) {
  const d = onlyDigits(cnpj)
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false
  const digit = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0)
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }
  return digit(12) === Number(d[12]) && digit(13) === Number(d[13])
}

export interface DadosEmpresa {
  cnpj: string
  razaoSocial: string
  nomeFantasia: string
  inscricaoEstadual: string
  email: string
  telefone: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  municipio: string
  codigoMunicipio: string
  uf: string
  fonte: 'cnpja' | 'brasilapi'
}
