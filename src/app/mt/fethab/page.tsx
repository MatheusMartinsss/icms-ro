'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { registrarEvento } from '@/lib/analytics'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  FONTE_LOCAL,
  GRUPOS,
  PRODUTOS,
  UNIDADE_LABEL,
  arredondar,
  lerDecimal,
  percentuaisLocais,
  periodoAtual,
  periodoValido,
  valorPorUnidade,
} from '@/lib/fethab'
import { detectarProdutos, periodoDaEmissao, remetenteDa, type NotaNfe, type ProdutoDetectado } from '@/lib/nfe'
import { cn } from '@/lib/utils'
import GerarDar from './gerar-dar'
import ImportarNfe from './importar-nfe'

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const brlUnidade = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 })
const numero = (v: number, casas = 3) => v.toLocaleString('pt-BR', { maximumFractionDigits: casas })
const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`

type ConsultaSefaz =
  | { estado: 'carregando' }
  | { estado: 'ok'; valores: Record<string, number | null> }
  | { estado: 'erro'; mensagem: string }

interface Linha {
  descricao: string
  codigo: string
  porUnidade: number | null
  percentual: number | null
  total: number | null
  divergente: boolean
}

// Valores da SEFAZ para o produto e período, com espera curta enquanto a
// pessoa digita o período.
function useValoresSefaz(codigos: string[], periodo: string) {
  const [consulta, setConsulta] = useState<ConsultaSefaz>({ estado: 'carregando' })
  const chave = `${codigos.join(',')}|${periodo}`

  useEffect(() => {
    if (!periodoValido(periodo)) return
    const controle = new AbortController()
    setConsulta({ estado: 'carregando' })
    const espera = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ periodo, codigos: codigos.join(',') })
        const resposta = await fetch(`/api/fethab?${params}`, { signal: controle.signal })
        const corpo = await resposta.json().catch(() => ({}))
        if (!resposta.ok) throw new Error(corpo.error || 'Falha na consulta')
        setConsulta({ estado: 'ok', valores: corpo.valores })
      } catch (error) {
        if (controle.signal.aborted) return
        setConsulta({ estado: 'erro', mensagem: (error as Error).message })
      }
    }, 350)
    return () => { clearTimeout(espera); controle.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  return consulta
}

export default function FethabPage() {
  const [produtoId, setProdutoId] = useState('soja')
  const [periodo, setPeriodo] = useState(periodoAtual)
  const [quantidadeTexto, setQuantidadeTexto] = useState('')
  const [emKg, setEmKg] = useState(false)
  const [notas, setNotas] = useState<NotaNfe[]>([])

  const usarDetectado = (d: ProdutoDetectado) => {
    setProdutoId(d.produto.id)
    setEmKg(false)
    setQuantidadeTexto(d.quantidade > 0 ? numero(d.quantidade, 4).replace(/\./g, '') : '')
  }

  const carregarNotas = (novas: NotaNfe[], erros: string[]) => {
    erros.forEach(e => toast.error(e, { duration: 8000 }))
    if (!novas.length) return
    setNotas(novas)
    const p = periodoDaEmissao(novas[0].emissao)
    if (p) setPeriodo(p)
    const { detectados } = detectarProdutos(novas)
    if (detectados[0]) {
      usarDetectado(detectados[0])
      toast.success(novas.length === 1 ? 'NF-e carregada' : `${novas.length} NF-e carregadas`)
      registrarEvento('fethab-nfe-importada', { quantidade: novas.length })
    } else {
      toast.warning('Nenhum produto do FETHAB foi encontrado nas notas.')
    }
  }

  const deteccao = useMemo(() => detectarProdutos(notas), [notas])

  const produto = PRODUTOS.find(p => p.id === produtoId)!
  const unidade = UNIDADE_LABEL[produto.unidade]
  const aceitaKg = produto.unidade === 't'
  const periodoOk = periodoValido(periodo)

  const codigos = useMemo(
    () => [produto.codigoFethab, produto.codigoEntidade].filter((c): c is string => !!c),
    [produto],
  )
  const sefaz = useValoresSefaz(codigos, periodo)
  const local = periodoOk ? percentuaisLocais(produto, periodo) : null

  const quantidadeDigitada = lerDecimal(quantidadeTexto)
  const quantidade = quantidadeDigitada === null ? null : emKg && aceitaKg ? quantidadeDigitada / 1000 : quantidadeDigitada

  const linhas: Linha[] = useMemo(() => {
    const montar = (descricao: string, codigo: string, percentualLocal: number | undefined): Linha => {
      const doLocal = percentualLocal !== undefined ? valorPorUnidade(percentualLocal) : null
      const daSefaz = sefaz.estado === 'ok' ? sefaz.valores[codigo] ?? null : undefined
      // Com a SEFAZ no ar, vale o que ela diz, inclusive "não se aplica" (null).
      const porUnidade = daSefaz !== undefined ? daSefaz : doLocal
      return {
        descricao,
        codigo,
        porUnidade,
        percentual: percentualLocal ?? null,
        total: porUnidade !== null && quantidade !== null ? arredondar(quantidade * porUnidade) : null,
        divergente: daSefaz != null && doLocal !== null && Math.abs(daSefaz - doLocal) > 0.005,
      }
    }
    const resultado = [montar('FETHAB', produto.codigoFethab, local?.fethab)]
    if (produto.codigoEntidade) resultado.push(montar('Entidade representativa', produto.codigoEntidade, local?.entidade))
    return resultado
  }, [produto, local?.fethab, local?.entidade, sefaz, quantidade])

  const total = linhas.every(l => l.total !== null) ? arredondar(linhas.reduce((s, l) => s + (l.total ?? 0), 0)) : null
  const semValor = linhas.some(l => l.porUnidade === null)
  const algumDivergente = linhas.some(l => l.divergente)

  // Avisos sobre as notas carregadas: o DAR é de um remetente, um mês e um produto.
  const remetente = notas.length ? remetenteDa(notas[0]) : null
  const avisos = useMemo(() => {
    if (!notas.length) return []
    const lista: string[] = []
    const remetentes = new Set(notas.map(n => { const r = remetenteDa(n); return r.documento || r.ie || r.nome }))
    if (remetentes.size > 1) lista.push('As notas têm remetentes diferentes. O DAR sai no nome de um só: confira o remetente abaixo.')
    const r = remetenteDa(notas[0])
    if (r.uf && r.uf !== 'MT') lista.push(`O remetente é de ${r.uf}. O FETHAB é recolhido pelo remetente de MT.`)
    const periodos = Array.from(new Set(notas.map(n => periodoDaEmissao(n.emissao)).filter(Boolean)))
    if (periodos.length > 1) lista.push(`As notas são de meses diferentes (${periodos.join(', ')}). Gere uma guia por mês.`)
    const atual = deteccao.detectados.find(d => d.produto.id === produtoId)
    if (atual?.semConversao.length) {
      lista.push(`Não deu para converter a unidade de: ${atual.semConversao.slice(0, 3).join('; ')}. Confira a quantidade.`)
    }
    if (deteccao.ignorados.length) {
      const exemplos = deteccao.ignorados.slice(0, 3).join('; ')
      lista.push(`${deteccao.ignorados.length} item(ns) sem FETHAB ficaram de fora: ${exemplos}${deteccao.ignorados.length > 3 ? '…' : ''}`)
    }
    return lista
  }, [notas, deteccao, produtoId])

  const fonte = !periodoOk
    ? null
    : sefaz.estado === 'carregando'
      ? { texto: 'Consultando a SEFAZ-MT…', classe: 'text-slate-500' }
      : sefaz.estado === 'ok'
        ? { texto: 'Valores por unidade consultados agora no emissor da SEFAZ-MT.', classe: 'text-emerald-700' }
        : local
          ? { texto: `SEFAZ-MT não respondeu. Usando a ${FONTE_LOCAL}.`, classe: 'text-amber-700' }
          : { texto: 'SEFAZ-MT não respondeu e a tabela local não cobre este período. Tente de novo em instantes.', classe: 'text-red-700' }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mato Grosso · DAR-1/AUT SEFAZ-MT</p>
        <h1 className="text-2xl font-semibold">FETHAB</h1>
        <p className="text-sm text-slate-500">
          Fundo de Transporte e Habitação. O valor é um percentual da UPF/MT por tonelada, cabeça ou m³.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <section className="lg:col-span-2 bg-white border rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">
          <div className="space-y-3">
            <ImportarNfe onCarregar={carregarNotas} />
            {notas.length > 0 && (
              <div className="rounded-xl border bg-slate-50 p-3 text-sm space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{notas.length === 1 ? `NF-e ${notas[0].numero}` : `${notas.length} NF-e`}</p>
                    {remetente && (
                      <p className="text-xs text-slate-500 truncate">
                        Remetente: {remetente.nome}{remetente.municipio && ` · ${remetente.municipio}/${remetente.uf}`}
                      </p>
                    )}
                  </div>
                  <button type="button" onClick={() => setNotas([])} className="text-xs text-slate-500 hover:underline shrink-0">
                    Limpar
                  </button>
                </div>
                {deteccao.detectados.length > 1 && (
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">Mais de um produto nas notas. Cada um tem a sua guia:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {deteccao.detectados.map(d => (
                        <button
                          key={d.produto.id}
                          type="button"
                          onClick={() => usarDetectado(d)}
                          className={cn(
                            'rounded-full border px-2.5 py-0.5 text-xs',
                            d.produto.id === produtoId ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-slate-100',
                          )}
                        >
                          {d.produto.nome} · {numero(d.quantidade, 4)} {UNIDADE_LABEL[d.produto.unidade].curta}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {avisos.map(a => <p key={a} className="text-xs text-amber-700">{a}</p>)}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Produto</Label>
            <Select value={produtoId} onValueChange={id => { setProdutoId(id); setEmKg(false) }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-80">
                {GRUPOS.map(grupo => (
                  <SelectGroup key={grupo}>
                    <SelectLabel className="text-xs text-slate-400">{grupo}</SelectLabel>
                    {PRODUTOS.filter(p => p.grupo === grupo).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">{produto.incidencia}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="periodo">Período de referência</Label>
            <Input
              id="periodo"
              inputMode="numeric"
              placeholder="MM/AAAA"
              maxLength={7}
              value={periodo}
              onChange={e => {
                const digitos = e.target.value.replace(/\D/g, '').slice(0, 6)
                setPeriodo(digitos.length > 2 ? `${digitos.slice(0, 2)}/${digitos.slice(2)}` : digitos)
              }}
            />
            {!periodoOk && periodo.length === 7 && <p className="text-xs text-red-600">Período inválido.</p>}
            <p className="text-xs text-slate-500">Mês da operação. A UPF de janeiro vale de janeiro a junho e a de julho, de julho a dezembro.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quantidade">Quantidade ({emKg && aceitaKg ? 'kg' : unidade.plural})</Label>
            <div className="flex gap-2">
              <Input
                id="quantidade"
                inputMode="decimal"
                placeholder={emKg && aceitaKg ? 'Ex: 37.500' : produto.unidade === 'cabeca' ? 'Ex: 120' : 'Ex: 37,5'}
                value={quantidadeTexto}
                onChange={e => setQuantidadeTexto(e.target.value)}
              />
              {aceitaKg && (
                <div className="flex rounded-md border p-0.5 shrink-0" role="group" aria-label="Unidade da quantidade">
                  {([false, true] as const).map(kg => (
                    <button
                      key={String(kg)}
                      type="button"
                      onClick={() => setEmKg(kg)}
                      className={cn('px-3 text-sm rounded', emKg === kg ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}
                    >
                      {kg ? 'kg' : 't'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {quantidadeTexto && quantidadeDigitada === null && <p className="text-xs text-red-600">Quantidade inválida.</p>}
            {emKg && aceitaKg && quantidade !== null && (
              <p className="text-xs text-slate-500">= {numero(quantidade, 4)} t (a SEFAZ pede em toneladas)</p>
            )}
          </div>
        </section>

        <section className="lg:col-span-3 space-y-6">
          <div className="bg-white border rounded-2xl p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-3 mb-4">
              <h2 className="text-lg font-medium">Valor a recolher</h2>
              {produto.composicao && <span className="text-xs text-slate-500 sm:text-right">{produto.composicao}</span>}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b">
                    <th className="py-2 pr-3">Contribuição</th>
                    <th className="py-2 pr-3 hidden sm:table-cell">Código</th>
                    <th className="py-2 pr-3">Por {unidade.curta}</th>
                    <th className="py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(l => (
                    <tr key={l.codigo} className="border-b last:border-0">
                      <td className="py-3 pr-3">
                        {l.descricao}
                        <div className="sm:hidden text-xs text-slate-400 font-mono">{l.codigo}</div>
                      </td>
                      <td className="py-3 pr-3 font-mono hidden sm:table-cell">{l.codigo}</td>
                      <td className="py-3 pr-3 whitespace-nowrap">
                        {l.porUnidade === null ? (
                          <span className="text-slate-400">
                            {sefaz.estado === 'ok' ? 'não se aplica' : sefaz.estado === 'carregando' ? '…' : '—'}
                          </span>
                        ) : (
                          <>
                            {brlUnidade(l.porUnidade)}
                            {l.percentual !== null && !l.divergente && <span className="text-slate-400 text-xs ml-1 hidden sm:inline">({pct(l.percentual)} UPF)</span>}
                          </>
                        )}
                      </td>
                      <td className="py-3 text-right font-medium whitespace-nowrap">{l.total === null ? '—' : brl(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-baseline justify-between border-t pt-4">
              <span className="text-slate-500">Total</span>
              <span className="text-2xl font-semibold">{total === null ? '—' : brl(total)}</span>
            </div>

            {fonte && <p className={cn('mt-3 text-xs', fonte.classe)}>{fonte.texto}</p>}
            {algumDivergente && (
              <p className="mt-1 text-xs text-amber-700">
                A SEFAZ-MT está usando um valor diferente da nossa tabela (UPF ou percentual mudou). O cálculo segue o da SEFAZ.
              </p>
            )}
            {semValor && sefaz.estado === 'ok' && (
              <p className="mt-1 text-xs text-slate-500">Para este período a SEFAZ-MT não tem valor em algum dos códigos.</p>
            )}
          </div>

          <GerarDar
            produto={produto}
            periodo={periodo}
            periodoOk={periodoOk}
            quantidade={quantidade}
            guias={linhas.map(l => ({ descricao: l.descricao, codigo: l.codigo, total: l.total }))}
            notas={notas}
            consultando={sefaz.estado === 'carregando'}
          />

          <p className="text-xs text-slate-400">
            Carne, combustível, energia, gás natural e mineração têm regras próprias e não entram nesta calculadora.
            Códigos de recolhimento:{' '}
            <a className="underline" href="https://www.portaldoconhecimento.mt.gov.br/codigos-de-recolhimento" target="_blank" rel="noopener noreferrer">
              portal do conhecimento SEFAZ-MT
            </a>.
          </p>
        </section>
      </div>
    </main>
  )
}
