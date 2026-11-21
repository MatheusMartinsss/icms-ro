'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { registrarEvento } from '@/lib/analytics'
import {
  CRV_SERRADA, METODOS_TORA, lerNumero, m3, reais, volumeFrancon, volumeSerrada, volumeSmalian,
  type MetodoTora, type UnidadeSecao,
} from '@/lib/cubagem'
import { cn } from '@/lib/utils'

type Aba = 'tora' | 'serrada'

interface LinhaTora { id: number; d1: string; d2: string; d3: string; d4: string; circ: string; comp: string }
interface LinhaPeca { id: number; esp: string; larg: string; comp: string; qtd: string }

const CHAVE = 'geraguia:cubagem:v1'
const GFLONA_URL = 'https://gflona.com.br/?utm_source=geraguia&utm_medium=referral&utm_campaign=cubagem'

let proximoId = 1
const novaTora = (): LinhaTora => ({ id: proximoId++, d1: '', d2: '', d3: '', d4: '', circ: '', comp: '' })
const novaPeca = (base?: LinhaPeca): LinhaPeca => ({ id: proximoId++, esp: base?.esp ?? '', larg: base?.larg ?? '', comp: '', qtd: '' })

const limparNumero = (v: string) => v.replace(/[^\d.,]/g, '').slice(0, 8)
const texto = (v: unknown) => (typeof v === 'string' ? limparNumero(v) : '')

function Alternativa<T extends string>({ valor, opcoes, onChange, rotulo }: {
  valor: T
  opcoes: { valor: T; label: string }[]
  onChange: (v: T) => void
  rotulo: string
}) {
  return (
    <div className="flex rounded-md border p-0.5 bg-white" role="group" aria-label={rotulo}>
      {opcoes.map(o => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={cn('flex-1 px-3 py-1.5 text-sm rounded whitespace-nowrap', valor === o.valor ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Campo({ rotulo, valor, onChange, onEnter, placeholder, nome }: {
  rotulo: string
  valor: string
  onChange: (v: string) => void
  onEnter?: () => void
  placeholder?: string
  nome: string
}) {
  return (
    <label className="block min-w-0">
      <span className="block text-[11px] leading-4 text-slate-500 truncate">{rotulo}</span>
      <Input
        inputMode="decimal"
        autoComplete="off"
        name={nome}
        placeholder={placeholder}
        value={valor}
        onChange={e => onChange(limparNumero(e.target.value))}
        onKeyDown={e => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter() } }}
        className="h-9 px-2 tabular-nums"
      />
    </label>
  )
}

function Cartao({ titulo, volume, onRemover, podeRemover, children }: {
  titulo: string
  volume: number | null
  onRemover: () => void
  podeRemover: boolean
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-white p-2.5 sm:p-3 break-inside-avoid">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-slate-500">{titulo}</span>
        <span className="flex items-center gap-2">
          <span className={cn('tabular-nums', volume ? 'font-semibold text-slate-900' : 'text-slate-300')}>
            {volume ? `${m3(volume)} m³` : '— m³'}
          </span>
          {podeRemover && (
            <button type="button" onClick={onRemover} aria-label={`Remover ${titulo.toLowerCase()}`} className="rounded px-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 print:hidden">
              ✕
            </button>
          )}
        </span>
      </div>
      {children}
    </div>
  )
}

export function Calculadora() {
  const [aba, setAba] = useState<Aba>('tora')
  const [metodo, setMetodo] = useState<MetodoTora>('smalian')
  const [unidade, setUnidade] = useState<UnidadeSecao>('cm')
  const [toras, setToras] = useState<LinhaTora[]>(() => [novaTora()])
  const [pecas, setPecas] = useState<LinhaPeca[]>(() => [novaPeca()])
  const [preco, setPreco] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [carregado, setCarregado] = useState(false)
  const focarUltima = useRef(false)
  const lista = useRef<HTMLDivElement>(null)

  // Restaura o último romaneio deste navegador (só conveniência; pode falhar em aba anônima).
  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? 'null')
      if (salvo && typeof salvo === 'object') {
        if (salvo.aba === 'tora' || salvo.aba === 'serrada') setAba(salvo.aba)
        if (salvo.metodo === 'smalian' || salvo.metodo === 'francon') setMetodo(salvo.metodo)
        if (salvo.unidade === 'cm' || salvo.unidade === 'pol') setUnidade(salvo.unidade)
        if (Array.isArray(salvo.toras) && salvo.toras.length) {
          setToras(salvo.toras.slice(0, 500).map((t: Record<string, unknown>) => ({
            id: proximoId++, d1: texto(t.d1), d2: texto(t.d2), d3: texto(t.d3), d4: texto(t.d4), circ: texto(t.circ), comp: texto(t.comp),
          })))
        }
        if (Array.isArray(salvo.pecas) && salvo.pecas.length) {
          setPecas(salvo.pecas.slice(0, 500).map((p: Record<string, unknown>) => ({
            id: proximoId++, esp: texto(p.esp), larg: texto(p.larg), comp: texto(p.comp), qtd: texto(p.qtd).replace(/\D/g, ''),
          })))
        }
        if (typeof salvo.preco === 'string') setPreco(salvo.preco.slice(0, 14))
      }
    } catch {
      // sem armazenamento: começa vazio
    }
    setCarregado(true)
  }, [])

  useEffect(() => {
    if (!carregado) return
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ aba, metodo, unidade, toras, pecas, preco }))
    } catch {
      // ignora
    }
  }, [carregado, aba, metodo, unidade, toras, pecas, preco])

  const volumesToras = useMemo(() => toras.map(t => {
    const comp = lerNumero(t.comp)
    return metodo === 'smalian'
      ? volumeSmalian({ d1: lerNumero(t.d1), d2: lerNumero(t.d2), d3: lerNumero(t.d3), d4: lerNumero(t.d4) }, comp)
      : volumeFrancon(lerNumero(t.circ), comp)
  }), [toras, metodo])

  const volumesPecas = useMemo(
    () => pecas.map(p => volumeSerrada(lerNumero(p.esp), lerNumero(p.larg), lerNumero(p.comp), lerNumero(p.qtd), unidade)),
    [pecas, unidade],
  )

  const volumes = aba === 'tora' ? volumesToras : volumesPecas
  const validos = volumes.filter((v): v is number => v !== null && v > 0)
  const total = Math.round(Number((validos.reduce((s, v) => s + v, 0) * 10000).toPrecision(12))) / 10000
  const quantidade = aba === 'tora'
    ? validos.length
    : pecas.reduce((s, p, i) => s + (volumesPecas[i] ? lerNumero(p.qtd) ?? 0 : 0), 0)
  const valorM3 = lerNumero(preco.replace(/[R$\s]/g, ''))
  const valorTotal = valorM3 && total ? Math.round(Number((total * valorM3 * 100).toPrecision(12))) / 100 : null

  // Um evento por aba/método quando o romaneio tem resultado.
  const ultimoEvento = useRef('')
  useEffect(() => {
    if (!total) return
    const chave = `${aba}|${aba === 'tora' ? metodo : unidade}`
    const t = setTimeout(() => {
      if (chave === ultimoEvento.current) return
      ultimoEvento.current = chave
      registrarEvento('cubagem-calculada', { tipo: aba, metodo: aba === 'tora' ? metodo : unidade, linhas: validos.length })
    }, 2000)
    return () => clearTimeout(t)
  }, [total, aba, metodo, unidade, validos.length])

  useEffect(() => {
    if (!focarUltima.current) return
    focarUltima.current = false
    const linhas = lista.current?.querySelectorAll('[data-linha]')
    linhas?.[linhas.length - 1]?.querySelector('input')?.focus()
  }, [toras.length, pecas.length])

  function adicionar() {
    focarUltima.current = true
    if (aba === 'tora') setToras(ts => [...ts, novaTora()])
    // Item novo repete a bitola do anterior: o romaneio costuma vir em blocos da mesma seção.
    else setPecas(ps => [...ps, novaPeca(ps[ps.length - 1])])
  }

  function limpar() {
    if (aba === 'tora') setToras([novaTora()])
    else setPecas([novaPeca()])
    setCopiado(false)
  }

  const mudarTora = (id: number, campo: keyof LinhaTora, valor: string) =>
    setToras(ts => ts.map(t => (t.id === id ? { ...t, [campo]: valor } : t)))
  const mudarPeca = (id: number, campo: keyof LinhaPeca, valor: string) =>
    setPecas(ps => ps.map(p => (p.id === id ? { ...p, [campo]: valor } : p)))

  function textoRomaneio() {
    const linhas: string[] = []
    if (aba === 'tora') {
      linhas.push(`Romaneio de toras · ${METODOS_TORA[metodo].titulo}`)
      toras.forEach((t, i) => {
        const v = volumesToras[i]
        if (!v) return
        const medidas = metodo === 'smalian'
          ? `base ${[t.d1, t.d2].filter(Boolean).join('/')} cm, topo ${[t.d3, t.d4].filter(Boolean).join('/')} cm`
          : `circ. ${t.circ} cm`
        linhas.push(`${i + 1}. ${medidas}, ${t.comp} m = ${m3(v)} m³`)
      })
    } else {
      linhas.push(`Romaneio de madeira serrada (${unidade === 'cm' ? 'cm' : 'polegadas'})`)
      pecas.forEach((p, i) => {
        const v = volumesPecas[i]
        if (!v) return
        linhas.push(`${i + 1}. ${p.qtd} pç ${p.esp} × ${p.larg} × ${p.comp} m = ${m3(v)} m³`)
      })
    }
    linhas.push(`Total: ${quantidade} ${aba === 'tora' ? 'toras' : 'peças'}, ${m3(total)} m³`)
    if (valorTotal && valorM3) linhas.push(`Valor: ${m3(total)} m³ × ${reais(valorM3)} = ${reais(valorTotal)}`)
    linhas.push('Calculado em geraguia.com.br/cubagem-madeira')
    return linhas.join('\n')
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoRomaneio())
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      // navegador sem permissão de área de transferência
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <section className="lg:col-span-3 space-y-4">
        <div className="bg-white border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 print:border-0 print:shadow-none print:p-0">
          <div className="print:hidden">
            <Alternativa
              rotulo="Tipo de madeira"
              valor={aba}
              onChange={v => { setAba(v); setCopiado(false) }}
              opcoes={[{ valor: 'tora', label: 'Madeira em tora' }, { valor: 'serrada', label: 'Madeira serrada' }]}
            />
          </div>

          {aba === 'tora' ? (
            <div className="space-y-1.5">
              <Label>Método de cubagem</Label>
              <Alternativa
                rotulo="Método de cubagem"
                valor={metodo}
                onChange={setMetodo}
                opcoes={[{ valor: 'smalian', label: 'Geométrico' }, { valor: 'francon', label: 'Francon' }]}
              />
              <p className="text-xs text-slate-500">{METODOS_TORA[metodo].resumo}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Espessura e largura em</Label>
              <Alternativa
                rotulo="Unidade da seção"
                valor={unidade}
                onChange={setUnidade}
                opcoes={[{ valor: 'cm', label: 'Centímetros' }, { valor: 'pol', label: 'Polegadas' }]}
              />
              <p className="text-xs text-slate-500">
                Volume = espessura × largura × comprimento × peças. O comprimento é sempre em metros
                {unidade === 'pol' ? '; 1 polegada = 2,54 cm.' : '.'}
              </p>
            </div>
          )}
        </div>

        <div ref={lista} className="space-y-2">
          {aba === 'tora'
            ? toras.map((t, i) => (
              <div key={t.id} data-linha>
                <Cartao titulo={`Tora ${i + 1}`} volume={volumesToras[i]} podeRemover={toras.length > 1} onRemover={() => setToras(ts => ts.filter(x => x.id !== t.id))}>
                  {metodo === 'smalian' ? (
                    <div className="grid grid-cols-5 gap-1.5">
                      <Campo nome="d1" rotulo="Base (cm)" placeholder="48" valor={t.d1} onChange={v => mudarTora(t.id, 'd1', v)} />
                      <Campo nome="d2" rotulo="Base 2" placeholder="opc." valor={t.d2} onChange={v => mudarTora(t.id, 'd2', v)} />
                      <Campo nome="d3" rotulo="Topo (cm)" placeholder="40" valor={t.d3} onChange={v => mudarTora(t.id, 'd3', v)} />
                      <Campo nome="d4" rotulo="Topo 2" placeholder="opc." valor={t.d4} onChange={v => mudarTora(t.id, 'd4', v)} />
                      <Campo nome="comp" rotulo="Compr. (m)" placeholder="4,5" valor={t.comp} onChange={v => mudarTora(t.id, 'comp', v)} onEnter={i === toras.length - 1 ? adicionar : undefined} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5">
                      <Campo nome="circ" rotulo="Circunferência no meio (cm)" placeholder="140" valor={t.circ} onChange={v => mudarTora(t.id, 'circ', v)} />
                      <Campo nome="comp" rotulo="Comprimento (m)" placeholder="4,5" valor={t.comp} onChange={v => mudarTora(t.id, 'comp', v)} onEnter={i === toras.length - 1 ? adicionar : undefined} />
                    </div>
                  )}
                </Cartao>
              </div>
            ))
            : pecas.map((p, i) => (
              <div key={p.id} data-linha>
                <Cartao titulo={`Item ${i + 1}`} volume={volumesPecas[i]} podeRemover={pecas.length > 1} onRemover={() => setPecas(ps => ps.filter(x => x.id !== p.id))}>
                  <div className="grid grid-cols-4 gap-1.5">
                    <Campo nome="esp" rotulo={`Espessura (${unidade})`} placeholder={unidade === 'cm' ? '5' : '2'} valor={p.esp} onChange={v => mudarPeca(p.id, 'esp', v)} />
                    <Campo nome="larg" rotulo={`Largura (${unidade})`} placeholder={unidade === 'cm' ? '20' : '8'} valor={p.larg} onChange={v => mudarPeca(p.id, 'larg', v)} />
                    <Campo nome="comp" rotulo="Compr. (m)" placeholder="3" valor={p.comp} onChange={v => mudarPeca(p.id, 'comp', v)} />
                    <Campo nome="qtd" rotulo="Peças" placeholder="10" valor={p.qtd} onChange={v => mudarPeca(p.id, 'qtd', v.replace(/\D/g, ''))} onEnter={i === pecas.length - 1 ? adicionar : undefined} />
                  </div>
                </Cartao>
              </div>
            ))}
        </div>

        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" onClick={adicionar} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            + Adicionar {aba === 'tora' ? 'tora' : 'item'}
          </button>
          <button type="button" onClick={limpar} className="rounded-md border px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Limpar
          </button>
          <span className="self-center text-xs text-slate-400">Enter no último campo adiciona outra linha.</span>
        </div>
      </section>

      <section className="lg:col-span-2 space-y-4">
        <div className="bg-white border rounded-2xl p-4 sm:p-6 shadow-sm lg:sticky lg:top-4">
          <h2 className="text-lg font-medium">Total do romaneio</h2>
          <p className="text-xs text-slate-500">
            {aba === 'tora' ? `Toras · ${METODOS_TORA[metodo].titulo}` : `Madeira serrada · seção em ${unidade === 'cm' ? 'centímetros' : 'polegadas'}`}
          </p>

          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-slate-500">Volume</span>
            <span className="text-2xl font-semibold tabular-nums" data-testid="cubagem-total">{total ? `${m3(total)} m³` : '—'}</span>
          </div>
          <div className="mt-1 flex justify-between text-sm text-slate-500">
            <span>{aba === 'tora' ? 'Toras' : 'Peças'}</span>
            <span className="tabular-nums">{quantidade || '—'}</span>
          </div>
          {aba === 'tora' && total > 0 && (
            <div className="mt-1 flex justify-between gap-3 text-sm text-slate-500">
              <span>Serrada estimada ({Math.round(CRV_SERRADA * 100)}%)</span>
              <span className="tabular-nums">{m3(total * CRV_SERRADA, 3)} m³</span>
            </div>
          )}

          <div className="mt-5 space-y-1.5 border-t pt-4">
            <Label htmlFor="preco">Preço por m³ (opcional)</Label>
            <Input id="preco" inputMode="decimal" placeholder="R$ 0,00" value={preco} onChange={e => setPreco(e.target.value.slice(0, 14))} />
          </div>
          {valorTotal !== null && (
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-slate-500">Valor</span>
              <span className="text-xl font-semibold tabular-nums" data-testid="cubagem-valor">{reais(valorTotal)}</span>
            </div>
          )}

          {!total && <p className="mt-3 text-xs text-slate-500">Preencha as medidas para calcular.</p>}

          <div className="mt-5 flex gap-2 print:hidden">
            <button type="button" onClick={copiar} disabled={!total} className="flex-1 rounded-md border px-3 py-2 text-sm hover:bg-slate-100 disabled:opacity-40">
              {copiado ? 'Copiado!' : 'Copiar romaneio'}
            </button>
            <button type="button" onClick={() => window.print()} disabled={!total} className="flex-1 rounded-md border px-3 py-2 text-sm hover:bg-slate-100 disabled:opacity-40">
              Imprimir
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5 print:hidden">
          <p className="text-sm font-semibold text-emerald-900">Faz isso todo dia no pátio?</p>
          <p className="mt-1 text-sm text-emerald-900/80">
            O GFLONA guarda a cubagem de cada tora por plaqueta, controla pátio e serraria, monta o carregamento com
            o DOF e prepara a nota fiscal.
          </p>
          <a
            href={GFLONA_URL}
            target="_blank"
            rel="noopener"
            onClick={() => registrarEvento('gflona-clique', { origem: 'cubagem' })}
            className="mt-3 inline-block rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Conhecer o GFLONA
          </a>
        </div>

        <ul className="text-xs text-slate-500 space-y-1.5 list-disc pl-4 print:hidden">
          <li>Diâmetros e circunferência em centímetros; comprimento em metros. Aceita vírgula ou ponto.</li>
          <li>No geométrico, a segunda medida de cada ponta é opcional: com ela, vale a média das duas.</li>
          <li>Volume de cada linha arredondado em 4 casas, como nos romaneios.</li>
          <li>O romaneio fica salvo só neste navegador.</li>
        </ul>
      </section>
    </div>
  )
}
