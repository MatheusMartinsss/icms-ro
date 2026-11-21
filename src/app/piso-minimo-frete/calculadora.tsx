'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { registrarEvento } from '@/lib/analytics'
import {
  EIXOS_OPCOES, TABELA_INFO, TIPOS_CARGA_PISO, calcularPiso, coeficiente, reais, tabelaDaOperacao,
} from '@/lib/piso-antt'
import { cn } from '@/lib/utils'

const CONTEINER = ['conteinerizada', 'perigosa_conteinerizada']

// Aceita "12.345,67", "12345,67" e "12345.67".
function lerValor(texto: string): number | null {
  const limpo = texto.replace(/[R$\s]/g, '')
  if (!limpo) return null
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  const v = Number(normal)
  return Number.isFinite(v) && v >= 0 ? v : null
}

function Alternativa<T extends string | boolean>({ valor, opcoes, onChange, rotulo }: {
  valor: T
  opcoes: { valor: T; label: string }[]
  onChange: (v: T) => void
  rotulo: string
}) {
  return (
    <div className="flex rounded-md border p-0.5" role="group" aria-label={rotulo}>
      {opcoes.map(o => (
        <button
          key={String(o.valor)}
          type="button"
          aria-pressed={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={cn('flex-1 px-3 py-1.5 text-sm rounded', valor === o.valor ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Calculadora() {
  const [tipo, setTipo] = useState('geral')
  const [eixos, setEixos] = useState('5')
  const [distancia, setDistancia] = useState('')
  const [composicao, setComposicao] = useState(true)
  const [altoDesempenho, setAltoDesempenho] = useState(false)
  const [retornoVazio, setRetornoVazio] = useState(false)
  const [freteTexto, setFreteTexto] = useState('')

  const km = distancia ? Number(distancia) : 0
  const tabela = tabelaDaOperacao(composicao, altoDesempenho)
  const conteiner = CONTEINER.includes(tipo)

  const r = useMemo(
    () => (km > 0 ? calcularPiso({ tipo, eixos: Number(eixos), distanciaKm: km, composicao, altoDesempenho, retornoVazio }) : null),
    [tipo, eixos, km, composicao, altoDesempenho, retornoVazio],
  )
  // Mesmo sem distância, mostra quais coeficientes valem.
  const coef = useMemo(
    () => calcularPiso({ tipo, eixos: Number(eixos), distanciaKm: 0, composicao, altoDesempenho, retornoVazio: false }),
    [tipo, eixos, composicao, altoDesempenho],
  )
  const frete = lerValor(freteTexto)

  // Um evento por combinação, depois que a pessoa para de digitar.
  const ultimoEvento = useRef('')
  useEffect(() => {
    if (!r) return
    const chave = `${tipo}|${r.eixosUsados}|${r.tabela}|${retornoVazio}`
    const t = setTimeout(() => {
      if (chave === ultimoEvento.current) return
      ultimoEvento.current = chave
      registrarEvento('piso-calculado', { tabela: r.tabela, eixos: r.eixosUsados, tipo, retorno: retornoVazio ? 'sim' : 'nao' })
    }, 2000)
    return () => clearTimeout(t)
  }, [r, tipo, retornoVazio])

  function trocarTipo(novo: string) {
    setTipo(novo)
    // Contêiner sempre paga o retorno vazio (§ 6º do art. 5º da Resolução 5.867).
    if (CONTEINER.includes(novo)) setRetornoVazio(true)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <section className="lg:col-span-2 bg-white border rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">
        <div className="space-y-1.5">
          <Label>Tipo de carga</Label>
          <Select value={tipo} onValueChange={trocarTipo}>
            <SelectTrigger aria-label="Tipo de carga"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-80">
              {TIPOS_CARGA_PISO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Eixos carregados</Label>
            <Select value={eixos} onValueChange={setEixos}>
              <SelectTrigger aria-label="Número de eixos"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EIXOS_OPCOES.map(e => <SelectItem key={e} value={e}>{e} eixos</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="distancia">Distância (km)</Label>
            <Input
              id="distancia"
              inputMode="numeric"
              placeholder="Ex.: 850"
              value={distancia}
              onChange={e => setDistancia(e.target.value.replace(/\D/g, '').slice(0, 5))}
            />
          </div>
        </div>
        {coef && coef.eixosUsados !== eixos && (
          <p className="-mt-3 text-xs text-amber-700">
            A {TABELA_INFO[tabela].titulo} não tem coeficiente para {eixos} eixos neste tipo de carga. Pela regra da ANTT,
            vale o de {coef.eixosUsados} eixos.
          </p>
        )}

        <div className="space-y-1.5">
          <Label>O que foi contratado</Label>
          <Alternativa
            rotulo="O que foi contratado"
            valor={composicao}
            onChange={setComposicao}
            opcoes={[{ valor: true, label: 'Veículo completo' }, { valor: false, label: 'Só o cavalo' }]}
          />
          <p className="text-xs text-slate-500">
            {composicao
              ? 'Caminhão, ou cavalo mecânico com o implemento do transportador.'
              : 'Só o cavalo mecânico: a carreta é do contratante.'}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Operação de alto desempenho</Label>
          <Alternativa
            rotulo="Operação de alto desempenho"
            valor={altoDesempenho}
            onChange={setAltoDesempenho}
            opcoes={[{ valor: false, label: 'Não' }, { valor: true, label: 'Sim' }]}
          />
          <p className="text-xs text-slate-500">Carga e descarga rápidas, em geral carga fidelizada. Na dúvida, deixe em Não.</p>
        </div>

        <div className="space-y-1.5">
          <Label>Retorno vazio</Label>
          <Alternativa
            rotulo="Retorno vazio"
            valor={retornoVazio}
            onChange={setRetornoVazio}
            opcoes={[{ valor: false, label: 'Não' }, { valor: true, label: 'Sim' }]}
          />
          <p className={cn('text-xs', conteiner && !retornoVazio ? 'text-amber-700' : 'text-slate-500')}>
            {conteiner
              ? 'Obrigatório no transporte de contêiner.'
              : 'Obrigatório em contêiner e em frota dedicada ou fidelizada. Soma 92% do deslocamento.'}
          </p>
        </div>

        <div className="space-y-1.5 border-t pt-5">
          <Label htmlFor="frete">Frete combinado (opcional)</Label>
          <Input id="frete" inputMode="decimal" placeholder="R$ 0,00" value={freteTexto} onChange={e => setFreteTexto(e.target.value)} />
          <p className="text-xs text-slate-500">Para conferir se o valor está acima do piso. Não conte o pedágio.</p>
        </div>
      </section>

      <section className="lg:col-span-3 space-y-6">
        <div className="bg-white border rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-medium">Piso mínimo do frete</h2>
            <p className="text-xs text-slate-500">{TABELA_INFO[tabela].titulo} · {TABELA_INFO[tabela].resumo}</p>
          </div>

          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b">
                <td className="py-3 pr-3">
                  <div>Deslocamento e carga/descarga</div>
                  <div className="text-xs text-slate-400">
                    {coef ? `${km || 'km'} × ${coeficiente(coef.ccd, 4)} + ${coeficiente(coef.cc, 2)}` : '—'}
                  </div>
                </td>
                <td className="py-3 text-right font-medium whitespace-nowrap">{r ? reais(r.ida) : '—'}</td>
              </tr>
              <tr className="border-b">
                <td className="py-3 pr-3">
                  <div className={cn(!retornoVazio && 'text-slate-400')}>Retorno vazio</div>
                  <div className="text-xs text-slate-400">
                    {retornoVazio ? (coef ? `0,92 × ${km || 'km'} × ${coeficiente(coef.ccd, 4)}` : '—') : 'Não incluído'}
                  </div>
                </td>
                <td className="py-3 text-right font-medium whitespace-nowrap">{r ? reais(r.retorno) : '—'}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-slate-500">Piso mínimo</span>
            <span className="text-2xl font-semibold" data-testid="piso-total">{r ? reais(r.total) : '—'}</span>
          </div>
          {!r && <p className="mt-2 text-xs text-slate-500">Informe a distância para calcular.</p>}

          {r && frete !== null && frete > 0 && (
            frete >= r.total ? (
              <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                O frete combinado de {reais(frete)} está {frete === r.total ? 'no' : `${reais(frete - r.total)} acima do`} piso.
              </p>
            ) : (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                O frete combinado de {reais(frete)} está {reais(r.total - frete)} abaixo do piso mínimo da ANTT.
              </p>
            )
          )}

          {coef && (
            <dl className="mt-5 grid grid-cols-3 gap-3 border-t pt-4 text-xs">
              <div><dt className="text-slate-400">CCD (R$/km)</dt><dd className="font-mono text-slate-700">{coeficiente(coef.ccd, 4)}</dd></div>
              <div><dt className="text-slate-400">CC (R$)</dt><dd className="font-mono text-slate-700">{coeficiente(coef.cc, 2)}</dd></div>
              <div><dt className="text-slate-400">Eixos na tabela</dt><dd className="font-mono text-slate-700">{coef.eixosUsados}</dd></div>
            </dl>
          )}
        </div>

        <ul className="text-xs text-slate-500 space-y-1.5 list-disc pl-4">
          <li>O pedágio não entra no piso: é pago à parte pelo contratante, com o vale-pedágio.</li>
          <li>A distância é a do trajeto rodoviário entre a origem e o destino da carga.</li>
          <li>Os valores foram conferidos com a calculadora oficial da ANTT.</li>
        </ul>
      </section>
    </div>
  )
}
