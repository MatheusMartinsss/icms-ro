// Leitura e escrita no local storage que nunca quebram a tela: em aba anônima,
// com o storage bloqueado ou cheio, o site continua funcionando sem lembrar.
export const CHAVES = {
  transportadoras: 'icms-ro:transportadoras',
  ativa: 'icms-ro:transportadora-ativa',
  historico: 'icms-ro:dares',
} as const

export function lerJson<T>(chave: string, padrao: T): T {
  try {
    const bruto = window.localStorage.getItem(chave)
    return bruto ? (JSON.parse(bruto) as T) : padrao
  } catch {
    return padrao
  }
}

export function gravarJson(chave: string, valor: unknown): boolean {
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor))
    return true
  } catch {
    return false
  }
}

export function lerTexto(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave)
  } catch {
    return null
  }
}

export function gravarTexto(chave: string, valor: string) {
  try {
    window.localStorage.setItem(chave, valor)
  } catch {
    // sem storage: só não lembra
  }
}

export function novoId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  }
}
