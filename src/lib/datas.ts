// Mesma regra do gdare (src/datas.js) para mostrar as datas já preenchidas
// no formulário do DARE.
const pad = (n: number) => String(n).padStart(2, '0')
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const formatDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`

function easterSunday(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

const addDays = (date: Date, days: number) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// Feriados nacionais, de Rondônia e Carnaval.
function holidaysOf(year: number) {
  const fixed = ['01-01', '01-04', '04-21', '05-01', '06-18', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25']
    .map(md => `${year}-${md}`)
  const easter = easterSunday(year)
  const movable = [-48, -47, -2, 60].map(days => key(addDays(easter, days)))
  return new Set([...fixed, ...movable])
}

export function isBusinessDay(date: Date) {
  const day = date.getDay()
  if (day === 0 || day === 6) return false
  return !holidaysOf(date.getFullYear()).has(key(date))
}

// Mesmo dia do mês seguinte (ou o último dia, se o mês for mais curto),
// empurrado para o próximo dia útil.
export function defaultDueDate(now = new Date()) {
  const target = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(now.getDate(), lastDay))
  let d = target
  while (!isBusinessDay(d)) d = addDays(d, 1)
  return formatDate(d)
}

export const currentMonthYear = (now = new Date()) => `${pad(now.getMonth() + 1)}/${now.getFullYear()}`
