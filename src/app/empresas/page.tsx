'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import TransportadoraDialog from '@/components/transportadora-dialog'
import { useTransportadoras } from '@/components/transportadora-context'
import { formatCnpj } from '@/lib/cnpj'
import { formatPercent } from '@/lib/calculo'
import type { Transportadora } from '@/lib/types'

export default function EmpresasPage() {
  const { transportadoras, ativa, setAtivaId, alternarAtiva, removerTransportadora, dares, carregando } = useTransportadoras()
  const [dialogAberto, setDialogAberto] = useState(false)
  const [editando, setEditando] = useState<Transportadora | null>(null)

  const daresPorTransportadora = useMemo(() => {
    const contagem = new Map<string, number>()
    dares.forEach(d => contagem.set(d.transportadoraId, (contagem.get(d.transportadoraId) ?? 0) + 1))
    return contagem
  }, [dares])

  const abrirNova = () => {
    setEditando(null)
    setDialogAberto(true)
  }

  const alternar = (t: Transportadora) => {
    alternarAtiva(t.id)
    toast.success(t.ativa ? 'Empresa desativada' : 'Empresa reativada')
  }

  const excluir = (t: Transportadora) => {
    const aviso = `Excluir ${t.razaoSocial}? As guias dela continuam no histórico. Para só esconder, use Desativar.`
    if (!window.confirm(aviso)) return
    removerTransportadora(t.id)
    toast.success('Empresa excluída')
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Empresas</h1>
          <p className="text-sm text-slate-500">
            Empresas em nome das quais as guias são geradas, em qualquer ferramenta. Ficam salvas neste navegador.
          </p>
        </div>
        <Button onClick={abrirNova}>Nova empresa</Button>
      </div>

      {carregando ? (
        <p className="text-slate-500">Carregando…</p>
      ) : transportadoras.length === 0 ? (
        <div className="bg-white border rounded-2xl p-10 text-center">
          <p className="text-slate-600 mb-4">Nenhuma empresa cadastrada ainda.</p>
          <Button onClick={abrirNova}>Cadastrar a primeira</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {transportadoras.map(t => (
            <div key={t.id} className={`bg-white border rounded-2xl p-5 shadow-sm ${t.ativa ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{t.nomeFantasia || t.razaoSocial}</div>
                  {t.nomeFantasia && <div className="text-sm text-slate-500 truncate">{t.razaoSocial}</div>}
                  <div className="text-sm text-slate-500">{formatCnpj(t.cnpj)}{t.inscricaoEstadual && ` · IE ${t.inscricaoEstadual}`}</div>
                  {t.municipio && <div className="text-sm text-slate-500">{t.municipio}{t.uf && ` - ${t.uf}`}</div>}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {ativa?.id === t.id && <span className="text-xs bg-sky-100 text-sky-800 rounded-full px-2 py-0.5">Em uso</span>}
                  {!t.ativa && <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">Inativa</span>}
                </div>
              </div>

              <div className="mt-3 text-sm text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                <span className="text-slate-400">ICMS Frete RO:</span>
                <span>ICMS {formatPercent(t.aliquotaIcms)}%</span>
                <span>Redução {formatPercent(t.percentualReducao)}%</span>
                <span>Receita {t.codigoReceita}</span>
                <span>{daresPorTransportadora.get(t.id) ?? 0} guia(s)</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {t.ativa && ativa?.id !== t.id && (
                  <Button size="sm" variant="secondary" onClick={() => setAtivaId(t.id)}>Usar esta</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => { setEditando(t); setDialogAberto(true) }}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => alternar(t)}>{t.ativa ? 'Desativar' : 'Reativar'}</Button>
                <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => excluir(t)}>Excluir</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TransportadoraDialog
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        transportadora={editando}
        onSaved={saved => {
          if (!editando) setAtivaId(saved.id)
        }}
      />
    </main>
  )
}
