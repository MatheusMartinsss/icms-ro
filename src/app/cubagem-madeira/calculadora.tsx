'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { registrarEvento } from '@/lib/analytics'
import { CRV_SERRADA, METODOS_TORA, lerNumero, m3, reais } from '@/lib/cubagem'
import { AbasEspecies } from './abas-especies'
import { Alternativa, Num } from './campos'
import { montarDocumento } from './documento'
import { FormLargura } from './form-largura'
import { FormLivre } from './form-livre'
import { FormPadrao } from './form-padrao'
import { FormToras } from './form-toras'
import { RomaneioImpresso } from './impresso'
import { carregarPdf, enviarPdf } from './pdf'
import {
  aplicarFaixa, comprimentosDaFaixa, especieAtiva, estadoInicial, novaEspecieSerrada, novaLarguraLinha, novaPadraoLinha,
  novoToraBloco, restaurar, resumir, textoRomaneio, unidadeQtd,
  type EspecieSerrada, type Estado, type Faixa, type LarguraBloco, type LivreLinha, type Modelo, type PadraoBloco, type ToraBloco,
} from './romaneio'

const CHAVE = 'geraguia:cubagem:v2'
const CHAVE_V1 = 'geraguia:cubagem:v1'
const GFLONA_URL = 'https://gflona.com.br/?utm_source=geraguia&utm_medium=referral&utm_campaign=cubagem'

const MODELOS: Record<Modelo, { label: string; resumo: string }> = {
  padrao: { label: 'Padrão', resumo: 'Um bloco por bitola × largura; digite a quantidade de peças em cada comprimento.' },
  largura: { label: 'Largura aberta', resumo: 'Bitola fixa e largura variada: digite a largura de cada peça na linha do comprimento.' },
  livre: { label: 'Lista livre', resumo: 'Uma linha por lote: espessura × largura × comprimento × peças.' },
}

// Romaneio salvo pela versão anterior da calculadora (lista simples).
function migrarV1(v1: Record<string, unknown>): unknown {
  return {
    tipo: v1.aba,
    metodo: v1.metodo,
    unidade: v1.unidade,
    preco: v1.preco,
    modelo: 'livre',
    toras: [{ especie: '', preco: '', linhas: v1.toras }],
    livre: v1.pecas,
  }
}

function EditorFaixa({ faixa, onAplicar }: { faixa: Faixa; onAplicar: (f: Faixa) => void }) {
  const [rasc, setRasc] = useState(faixa)
  useEffect(() => setRasc(faixa), [faixa])
  const aplicar = () => {
    if (rasc.espacamento === faixa.espacamento && rasc.de === faixa.de && rasc.ate === faixa.ate) return
    if (comprimentosDaFaixa(rasc).length) onAplicar(rasc)
    else setRasc(faixa)
  }
  const campo = (k: keyof Faixa, rotulo: string) => (
    <label className="w-16 text-[11px] leading-4 text-slate-500">
      {rotulo}
      <Num
        valor={rasc[k]}
        onValor={v => setRasc(r => ({ ...r, [k]: v }))}
        onBlur={aplicar}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); aplicar() } }}
      />
    </label>
  )
  return (
    <div className="flex flex-wrap items-end gap-2">
      {campo('de', 'De (m)')}
      {campo('ate', 'Até (m)')}
      {campo('espacamento', 'A cada (m)')}
      <span className="pb-2 text-xs text-slate-400">{comprimentosDaFaixa(faixa).length} comprimentos por bloco</span>
    </div>
  )
}

export function Calculadora() {
  const [e, setEstado] = useState<Estado>(estadoInicial)
  const [copiado, setCopiado] = useState(false)
  const [carregado, setCarregado] = useState(false)
  const [pdf, setPdf] = useState<'' | 'gerando' | 'erro'>('')
  const [toque, setToque] = useState(false)

  // Restaura o último romaneio deste navegador (só conveniência; pode falhar em aba anônima).
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE)
      const v1 = salvo ? null : localStorage.getItem(CHAVE_V1)
      const bruto = salvo ? JSON.parse(salvo) : v1 ? migrarV1(JSON.parse(v1) ?? {}) : null
      const r = restaurar(bruto)
      if (r) setEstado(r)
    } catch {
      // sem armazenamento: começa vazio
    }
    setCarregado(true)
    setToque(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && typeof navigator.share === 'function')
  }, [])

  useEffect(() => {
    if (!carregado) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(CHAVE, JSON.stringify(e))
      } catch {
        // ignora
      }
    }, 400)
    return () => clearTimeout(t)
  }, [carregado, e])

  const mudar = useCallback(<K extends keyof Estado>(k: K, v: Estado[K]) => { setEstado(s => ({ ...s, [k]: v })); setCopiado(false) }, [])
  const setToras = useCallback((fn: (b: ToraBloco[]) => ToraBloco[]) => setEstado(s => ({ ...s, toras: fn(s.toras) })), [])
  const mudarEspecie = useCallback((id: number, fn: (s: EspecieSerrada) => EspecieSerrada) =>
    setEstado(st => ({ ...st, serradas: st.serradas.map(x => (x.id === id ? fn(x) : x)) })), [])
  const setAtiva = useCallback((fn: (s: EspecieSerrada) => EspecieSerrada) =>
    setEstado(st => { const id = especieAtiva(st).id; return { ...st, serradas: st.serradas.map(x => (x.id === id ? fn(x) : x)) } }), [])
  const setPadrao = useCallback((fn: (b: PadraoBloco[]) => PadraoBloco[]) => setAtiva(s => ({ ...s, padrao: fn(s.padrao) })), [setAtiva])
  const setLargura = useCallback((fn: (b: LarguraBloco[]) => LarguraBloco[]) => setAtiva(s => ({ ...s, largura: fn(s.largura) })), [setAtiva])
  const setLivre = useCallback((fn: (l: LivreLinha[]) => LivreLinha[]) => setAtiva(s => ({ ...s, livre: fn(s.livre) })), [setAtiva])

  function aplicarNovaFaixa(f: Faixa) {
    const comps = comprimentosDaFaixa(f)
    setEstado(s => ({
      ...s,
      faixa: f,
      serradas: s.serradas.map(sp => ({
        ...sp,
        padrao: sp.padrao.map(b => ({ ...b, linhas: aplicarFaixa(b.linhas, comps, c => novaPadraoLinha(c), l => !!l.qtd) })),
        largura: sp.largura.map(b => ({ ...b, linhas: aplicarFaixa(b.linhas, comps, c => novaLarguraLinha(c), l => l.pecas.length > 0) })),
      })),
    }))
  }

  function limpar() {
    if (r.volume && !window.confirm(`Apagar ${e.tipo === 'tora' ? 'todas as toras' : 'toda a madeira serrada'} deste romaneio?`)) return
    setCopiado(false)
    setEstado(s => {
      if (s.tipo === 'tora') return { ...s, toras: [novoToraBloco()] }
      const nova = novaEspecieSerrada(s.faixa)
      return { ...s, serradas: [nova], ativa: nova.id }
    })
  }

  const r = useMemo(() => resumir(e), [e])
  const doc = useMemo(() => (carregado && r.volume ? montarDocumento(e, r) : null), [carregado, e, r])
  const ativa = especieAtiva(e)
  const usadas = r.especies.filter(p => p.volume)

  // Baixa as bibliotecas do PDF assim que houver romaneio: no clique o arquivo
  // sai na hora e o compartilhamento do celular não perde o gesto do usuário.
  const temVolume = r.volume > 0
  useEffect(() => {
    if (!temVolume) return
    const t = setTimeout(() => { carregarPdf().catch(() => {}) }, 1500)
    return () => clearTimeout(t)
  }, [temVolume])

  async function baixarPdf() {
    if (!doc || pdf === 'gerando') return
    setPdf('gerando')
    try {
      const resultado = await enviarPdf(doc)
      registrarEvento('cubagem-pdf', { resultado, tipo: e.tipo })
      setPdf('')
    } catch {
      setPdf('erro')
    }
  }
  const rotuloPdf = pdf === 'gerando' ? 'Gerando...' : toque ? 'Enviar PDF' : 'Baixar PDF'
  const variante = e.tipo === 'tora' ? e.metodo : e.modelo

  // Um evento por tipo/variante quando o romaneio tem resultado.
  const ultimoEvento = useRef('')
  useEffect(() => {
    if (!r.volume) return
    const chave = `${e.tipo}|${variante}`
    const t = setTimeout(() => {
      if (chave === ultimoEvento.current) return
      ultimoEvento.current = chave
      registrarEvento('cubagem-calculada', { tipo: e.tipo, metodo: variante, linhas: r.linhas })
    }, 2000)
    return () => clearTimeout(t)
  }, [r.volume, r.linhas, e.tipo, variante])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoRomaneio(e, r))
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      // navegador sem permissão de área de transferência
    }
  }

  const subtitulo = e.tipo === 'tora'
    ? `Toras · ${METODOS_TORA[e.metodo].titulo}`
    : `Serrada · ${MODELOS[e.modelo].label} · seção em ${e.unidade === 'cm' ? 'centímetros' : 'polegadas'}`

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0 space-y-4 print:hidden">
        <div className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
          <Alternativa
            rotulo="Tipo de madeira"
            valor={e.tipo}
            onChange={v => mudar('tipo', v)}
            opcoes={[{ valor: 'tora', label: 'Madeira em tora' }, { valor: 'serrada', label: 'Madeira serrada' }]}
          />

          {e.tipo === 'tora' ? (
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <div className="space-y-1.5">
                <Label>Método de cubagem</Label>
                <Alternativa
                  pequena
                  rotulo="Método de cubagem"
                  valor={e.metodo}
                  onChange={v => mudar('metodo', v)}
                  opcoes={[{ valor: 'smalian', label: 'Geométrico' }, { valor: 'francon', label: 'Francon' }]}
                />
              </div>
              {e.metodo === 'smalian' && (
                <label className="flex items-center gap-2 pb-1 text-sm text-slate-700">
                  <input type="checkbox" checked={e.duasMedidas} onChange={ev => mudar('duasMedidas', ev.target.checked)} className="h-4 w-4 accent-slate-900" />
                  Duas medidas por ponta
                </label>
              )}
              <p className="basis-full text-xs text-slate-500">
                {METODOS_TORA[e.metodo].resumo} Diâmetros e circunferência em cm, comprimento em m.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                <div className="space-y-1.5">
                  <Label>Modelo do romaneio</Label>
                  <Alternativa
                    pequena
                    rotulo="Modelo do romaneio"
                    valor={e.modelo}
                    onChange={v => mudar('modelo', v)}
                    opcoes={(Object.keys(MODELOS) as Modelo[]).map(m => ({ valor: m, label: MODELOS[m].label }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Bitola e largura em</Label>
                  <Alternativa
                    pequena
                    rotulo="Unidade da seção"
                    valor={e.unidade}
                    onChange={v => mudar('unidade', v)}
                    opcoes={[{ valor: 'cm', label: 'cm' }, { valor: 'pol', label: 'polegadas' }]}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">{MODELOS[e.modelo].resumo} Comprimento sempre em metros.</p>
              {e.modelo !== 'livre' && <EditorFaixa faixa={e.faixa} onAplicar={aplicarNovaFaixa} />}
            </div>
          )}
        </div>

        {/* Os ids das linhas nascem no navegador; renderizar no servidor daria ids diferentes. */}
        {!carregado && <div className="h-96 animate-pulse rounded-xl border bg-white" />}
        {carregado && e.tipo === 'tora' && <FormToras blocos={e.toras} set={setToras} metodo={e.metodo} duasMedidas={e.duasMedidas} />}
        {carregado && e.tipo === 'serrada' && (
          <>
            <AbasEspecies
              especies={e.serradas}
              ativa={ativa}
              parciais={r.especies}
              faixa={e.faixa}
              temPrecoGeral={!!lerNumero(e.preco)}
              onAtivar={id => setEstado(s => ({ ...s, ativa: id }))}
              onMudar={(id, campos) => mudarEspecie(id, x => ({ ...x, ...campos }))}
              onAdicionar={nova => setEstado(s => ({ ...s, serradas: [...s.serradas, nova], ativa: nova.id }))}
              onRemover={id => setEstado(s => {
                const i = s.serradas.findIndex(x => x.id === id)
                const resto = s.serradas.filter(x => x.id !== id)
                return { ...s, serradas: resto, ativa: (resto[i] ?? resto[i - 1] ?? resto[0]).id }
              })}
            />
            {/* key: cada espécie tem o seu formulário (rascunhos não passam de uma para outra). */}
            <div data-form-serrada key={ativa.id}>
              {e.modelo === 'padrao' && <FormPadrao blocos={ativa.padrao} set={setPadrao} unidade={e.unidade} faixa={e.faixa} />}
              {e.modelo === 'largura' && <FormLargura blocos={ativa.largura} set={setLargura} unidade={e.unidade} faixa={e.faixa} />}
              {e.modelo === 'livre' && <FormLivre linhas={ativa.livre} set={setLivre} unidade={e.unidade} />}
            </div>
          </>
        )}
      </section>

      {doc && <RomaneioImpresso doc={doc} />}

      <section className="space-y-4 print:hidden">
        <div className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6 lg:sticky lg:top-4">
          <h2 className="text-lg font-medium">Total do romaneio</h2>
          <p className="text-xs text-slate-500">{subtitulo}</p>

          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-slate-500">Volume</span>
            <span className="text-2xl font-semibold tabular-nums" data-testid="cubagem-total">{r.volume ? `${m3(r.volume)} m³` : '—'}</span>
          </div>
          <div className="mt-1 flex justify-between text-sm text-slate-500">
            <span>{r.rotulo}</span>
            <span className="tabular-nums" data-testid="cubagem-quantidade">{r.quantidade || '—'}</span>
          </div>
          {usadas.length > 1 && (
            <ul className="mt-3 space-y-0.5 border-t pt-2 text-xs text-slate-600" data-testid="cubagem-especies">
              {usadas.map(p => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span className="truncate">{p.nome}</span>
                  <span className="shrink-0 tabular-nums">{m3(p.volume)} m³{p.valor !== null && ` · ${reais(p.valor)}`}</span>
                </li>
              ))}
            </ul>
          )}
          {e.tipo === 'tora' && r.volume > 0 && (
            <div className="mt-1 flex justify-between gap-3 text-sm text-slate-500">
              <span>Serrada estimada ({Math.round(CRV_SERRADA * 100)}%)</span>
              <span className="tabular-nums">{m3(r.volume * CRV_SERRADA, 3)} m³</span>
            </div>
          )}

          <div className="mt-5 space-y-1.5 border-t pt-4 print:hidden">
            <Label htmlFor="preco">Preço por m³ (opcional)</Label>
            <Input id="preco" inputMode="decimal" placeholder="R$ 0,00" value={e.preco} onChange={ev => mudar('preco', ev.target.value.slice(0, 14))} />
            {(e.tipo === 'tora' ? e.toras : e.serradas).length > 1 && (
              <p className="text-[11px] text-slate-400">O preço da espécie, quando preenchido, vale no lugar deste.</p>
            )}
          </div>
          {r.valor !== null && (
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-slate-500">Valor</span>
              <span className="text-xl font-semibold tabular-nums" data-testid="cubagem-valor">{reais(r.valor)}</span>
            </div>
          )}
          {r.valor !== null && usadas.some(p => p.valor === null) && (
            <p className="mt-1 text-[11px] text-slate-400">Espécies sem preço ficam fora do valor.</p>
          )}

          {!r.volume && <p className="mt-3 text-xs text-slate-500">Preencha as medidas para calcular.</p>}

          <button
            type="button"
            onClick={baixarPdf}
            disabled={!doc || pdf === 'gerando'}
            data-testid="cubagem-pdf"
            className="mt-5 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {rotuloPdf}
          </button>
          {pdf === 'erro' && <p className="mt-1 text-[11px] text-red-600">Não deu para gerar o PDF. Verifique a conexão e tente de novo.</p>}
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={copiar} disabled={!r.volume} className="flex-1 rounded-md border px-3 py-2 text-sm hover:bg-slate-100 disabled:opacity-40">
              {copiado ? 'Copiado!' : 'Copiar texto'}
            </button>
            <button type="button" onClick={() => window.print()} disabled={!r.volume} className="flex-1 rounded-md border px-3 py-2 text-sm hover:bg-slate-100 disabled:opacity-40">
              Imprimir
            </button>
          </div>
          <button type="button" onClick={limpar} className="mt-2 w-full rounded-md px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100">
            Limpar {e.tipo === 'tora' ? 'toras' : 'madeira serrada'}
          </button>

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

        <ul className="list-disc space-y-1.5 pl-4 text-xs text-slate-500 print:hidden">
          <li>Aceita vírgula ou ponto. Dá para lançar tudo pelo teclado, sem mouse.</li>
          <li>No geométrico com duas medidas, vale a média das duas em cada ponta; a segunda pode ficar vazia.</li>
          <li>Volume de cada linha (ou peça, na largura aberta) arredondado em 4 casas, como nos romaneios.</li>
          <li>O romaneio fica salvo só neste navegador.</li>
        </ul>

        {/* No celular o painel do total fica depois dos blocos: barra fixa com o total enquanto digita. */}
        {r.volume > 0 && (
          <>
            <div className="h-14 lg:hidden print:hidden" />
            <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t bg-white/95 px-4 py-2 text-sm shadow-[0_-2px_8px_rgba(0,0,0,0.06)] backdrop-blur lg:hidden print:hidden">
              <div className="min-w-0 flex-1 leading-tight">
                <strong className="block tabular-nums text-slate-900">{m3(r.volume)} m³</strong>
                <span className="block truncate text-xs text-slate-500">{r.quantidade} {unidadeQtd(e.tipo === 'tora', r.quantidade)}{r.valor !== null && ` · ${reais(r.valor)}`}</span>
              </div>
              <button
                type="button"
                onClick={baixarPdf}
                disabled={!doc || pdf === 'gerando'}
                className="shrink-0 rounded-md bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-40"
              >
                {rotuloPdf}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
