'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import DareDialog, { DareInicial } from '@/components/dare-dialog'
import { useTransportadoras } from '@/components/transportadora-context'
import { FERRAMENTAS, ferramentaPorId, nomeFerramenta } from '@/lib/ferramentas'
import type { DareRegistro, DareStatus } from '@/lib/types'

const STATUS_LABEL: Record<DareStatus, { label: string; className: string }> = {
  EMITIDO: { label: 'Emitido', className: 'bg-emerald-100 text-emerald-800' },
  ERRO: { label: 'Erro', className: 'bg-red-100 text-red-800' },
}

const TODAS = 'todas'

const ehFethab = (d: DareRegistro) => d.ferramenta === 'fethab-mt'

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function HistoricoPage() {
  const { transportadoras, dares, carregando, limparHistorico } = useTransportadoras()
  const [filtroTransportadora, setFiltroTransportadora] = useState(TODAS)
  const [filtroStatus, setFiltroStatus] = useState(TODAS)
  const [filtroFerramenta, setFiltroFerramenta] = useState(TODAS)
  const [busca, setBusca] = useState('')
  const [reemitir, setReemitir] = useState<DareInicial | null>(null)

  const filtrados = useMemo(() => {
    const q = semAcento(busca.trim())
    return dares.filter(d =>
      (filtroTransportadora === TODAS || d.transportadoraId === filtroTransportadora) &&
      (filtroStatus === TODAS || d.status === filtroStatus) &&
      (filtroFerramenta === TODAS || (d.ferramenta ?? 'icms-frete-ro') === filtroFerramenta) &&
      (!q || semAcento(`${d.notaFiscal} ${d.destinatario ?? ''} ${d.produto ?? ''}`).includes(q)),
    )
  }, [dares, filtroTransportadora, filtroStatus, filtroFerramenta, busca])

  // O filtro de ferramenta só aparece quando o histórico tem guias de mais de uma.
  const ferramentasNoHistorico = useMemo(
    () => FERRAMENTAS.filter(f => dares.some(d => (d.ferramenta ?? 'icms-frete-ro') === f.id)),
    [dares],
  )

  const copiarLinha = async (linha: string) => {
    try {
      await navigator.clipboard.writeText(linha.replace(/\D/g, ''))
      toast.success('Linha digitável copiada')
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  const limpar = () => {
    if (!window.confirm(`Apagar o histórico de ${dares.length} guia(s) deste navegador? As guias emitidas continuam valendo na secretaria.`)) return
    limparHistorico()
    toast.success('Histórico apagado')
  }

  const tentarDeNovo = (d: DareRegistro) => setReemitir({
    transportadoraId: d.transportadoraId,
    notaFiscal: d.notaFiscal,
    destinatario: d.destinatario ?? '',
    origem: d.origem ?? '',
    destino: d.destino ?? '',
    produto: d.produto ?? '',
    baseCalculoTexto: d.baseCalculoTexto ?? '',
    valorBase: d.valorBase,
    valorIcms: d.valorIcms,
    codigoReceita: d.codigoReceita,
  })

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Histórico de guias</h1>
          <p className="text-sm text-slate-500">
            Histórico salvo neste navegador. O PDF é baixado na hora da emissão. Guarde o arquivo.
          </p>
        </div>
        {dares.length > 0 && (
          <Button variant="ghost" className="text-red-600 hover:text-red-700" onClick={limpar}>Limpar histórico</Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <Input className="w-full sm:w-64" placeholder="Buscar NF, destinatário ou produto" value={busca} onChange={e => setBusca(e.target.value)} />
        {ferramentasNoHistorico.length > 1 && (
          <Select value={filtroFerramenta} onValueChange={setFiltroFerramenta}>
            <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas as ferramentas</SelectItem>
              {ferramentasNoHistorico.map(f => (
                <SelectItem key={f.id} value={f.id}>{nomeFerramenta(f)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={filtroTransportadora} onValueChange={setFiltroTransportadora}>
          <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas as empresas</SelectItem>
            {transportadoras.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.nomeFantasia || t.razaoSocial}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todos os status</SelectItem>
            <SelectItem value="EMITIDO">Emitidos</SelectItem>
            <SelectItem value="ERRO">Com erro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b">
              <th className="py-3 px-3">Data</th>
              <th className="py-3 px-3">Guia</th>
              <th className="py-3 px-3">NF</th>
              <th className="py-3 px-3">Empresa</th>
              <th className="py-3 px-3">Detalhes</th>
              <th className="py-3 px-3">Valor</th>
              <th className="py-3 px-3">Vencimento</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={9} className="py-10 text-center text-slate-500">
                  {carregando ? 'Carregando…' : dares.length ? 'Nenhuma guia com esses filtros.' : 'Nenhuma guia emitida neste navegador ainda.'}
                </td>
              </tr>
            )}
            {filtrados.map(d => (
              <tr key={d.id} className="border-b last:border-0 align-top">
                <td className="py-3 px-3 whitespace-nowrap">
                  <div>{new Date(d.createdAt).toLocaleDateString('pt-BR')}</div>
                  <div className="text-xs text-slate-400">{new Date(d.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                </td>
                <td className="py-3 px-3 whitespace-nowrap">
                  <div>{ferramentaPorId(d.ferramenta)?.titulo ?? 'Guia'}</div>
                  <div className="text-xs text-slate-400">{ferramentaPorId(d.ferramenta)?.guia}</div>
                </td>
                <td className="py-3 px-3 font-medium">{d.notaFiscal || '—'}</td>
                <td className="py-3 px-3">{d.transportadora.nomeFantasia || d.transportadora.razaoSocial}</td>
                <td className="py-3 px-3">
                  {ehFethab(d) ? (
                    <>
                      <div>{d.produto}</div>
                      <div className="text-xs text-slate-400">
                        {[d.baseCalculoTexto, d.mesReferencia && `ref. ${d.mesReferencia}`, d.origem].filter(Boolean).join(' · ')}
                      </div>
                    </>
                  ) : (
                    <>
                      <div>{d.destinatario}</div>
                      {(d.origem || d.destino) && <div className="text-xs text-slate-400">{d.origem} para {d.destino}</div>}
                    </>
                  )}
                </td>
                <td className="py-3 px-3 whitespace-nowrap">{brl(d.valorIcms)}</td>
                <td className="py-3 px-3">{d.dataVencimento}</td>
                <td className="py-3 px-3">
                  <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_LABEL[d.status].className}`}>{STATUS_LABEL[d.status].label}</span>
                  {d.erro && <div className="text-xs text-red-700 mt-1 max-w-xs">{d.erro}</div>}
                </td>
                <td className="py-3 px-3">
                  <div className="flex flex-col items-end gap-1 whitespace-nowrap">
                    {d.linhaDigitavel && (
                      <Button size="sm" variant="outline" onClick={() => copiarLinha(d.linhaDigitavel!)}>Copiar linha</Button>
                    )}
                    {d.status !== 'EMITIDO' && !ehFethab(d) && (
                      <Button size="sm" variant="secondary" onClick={() => tentarDeNovo(d)}>Tentar de novo</Button>
                    )}
                    {d.status !== 'EMITIDO' && ehFethab(d) && (
                      <Button size="sm" variant="secondary" asChild><Link href="/mt/fethab">Abrir FETHAB</Link></Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DareDialog
        open={!!reemitir}
        onOpenChange={open => !open && setReemitir(null)}
        inicial={reemitir}
      />
    </main>
  )
}
