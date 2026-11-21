// Eventos do Umami (script em /u/script.js, carregado no layout). Não manda
// dado de contribuinte: só o tipo da ação e números/códigos genéricos.
type Umami = { track: (evento: string, dados?: Record<string, string | number>) => void }

export function registrarEvento(evento: string, dados?: Record<string, string | number>) {
  try {
    ;(window as unknown as { umami?: Umami }).umami?.track(evento, dados)
  } catch {
    // analytics nunca pode atrapalhar a emissão
  }
}
