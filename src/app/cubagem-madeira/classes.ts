// Classe da peça serrada pela seção, na nomenclatura da ABNT NBR 7203
// (espessura × largura, em cm). A norma deixa buracos entre as faixas
// (10×10, 4×4…); aqui cada seção cai na classe mais próxima, então toda
// peça tem classe.
//
//   Pranchão  esp. > 7      larg. > 20
//   Prancha   esp. 4 a 7    larg. > 20
//   Viga      esp. ≥ 4      larg. 11 a 20  (e as grossas: 10×10, 12×12…)
//   Vigota    esp. 4 a 8    larg. 8 a 11
//   Caibro    esp. 4 a 8    larg. ≤ 8
//   Tábua     esp. < 4      larg. > 10
//   Sarrafo   esp. 2 a 4    larg. ≤ 10
//   Ripa      esp. < 2      larg. ≤ 10

export const CLASSES = ['Pranchão', 'Prancha', 'Viga', 'Vigota', 'Caibro', 'Tábua', 'Sarrafo', 'Ripa'] as const
export type Classe = (typeof CLASSES)[number]

// Recebe as duas medidas da seção em cm, em qualquer ordem.
export function classePeca(a: number, b: number): Classe {
  const esp = Math.min(a, b)
  const larg = Math.max(a, b)
  if (esp < 4) {
    if (larg > 10) return 'Tábua'
    return esp < 2 ? 'Ripa' : 'Sarrafo'
  }
  if (larg > 20) return esp > 7 ? 'Pranchão' : 'Prancha'
  if (larg > 11 || esp > 8) return 'Viga'
  return larg > 8 ? 'Vigota' : 'Caibro'
}
