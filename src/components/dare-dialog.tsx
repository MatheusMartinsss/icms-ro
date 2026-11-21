'use client'

import { FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTransportadoras } from '@/components/transportadora-context'
import { TransportadoraForm } from '@/components/transportadora-dialog'
import { currentMonthYear, defaultDueDate } from '@/lib/datas'
import { formatCnpj } from '@/lib/cnpj'
import { PADRAO_DARE } from '@/lib/transportadora-schema'
import type { DareForm, Transportadora } from '@/lib/types'

export type DareInicial = Partial<DareForm> & { transportadoraId?: string }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  inicial: DareInicial | null
  onEmitido?: () => void
}

type Campos = Omit<DareForm, 'valorIcms' | 'valorBase'> & { valor: string }

const valorParaTexto = (v?: number | null) => (v ? v.toFixed(2).replace('.', ',') : '')
const textoParaValor = (v: string) => {
  const s = v.replace(/[^\d,.]/g, '')
  return Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s)
}

export default function DareDialog({ open, onOpenChange, inicial, onEmitido }: Props) {
  const { carregando, transportadoras, ativas, ativa, setAtivaId, emitir } = useTransportadoras()
  const [transportadoraId, setTransportadoraId] = useState('')
  const [campos, setCampos] = useState<Campos | null>(null)
  const [emitindo, setEmitindo] = useState(false)
  const [erro, setErro] = useState('')
  const [novaAberta, setNovaAberta] = useState(false)

  const transportadora = ativas.find(t => t.id === transportadoraId) ?? null
  // Sem nenhuma transportadora ativa, pede os dados antes do DARE.
  const cadastrando = !carregando && (ativas.length === 0 || novaAberta)

  useEffect(() => {
    if (!open || !inicial) return
    const t = ativas.find(x => x.id === inicial.transportadoraId) ?? ativa
    setTransportadoraId(t?.id ?? '')
    setErro('')
    setNovaAberta(false)
    setCampos({
      notaFiscal: inicial.notaFiscal ?? '',
      destinatario: inicial.destinatario ?? '',
      origem: (inicial.origem ?? '').toLocaleUpperCase('pt-BR'),
      destino: (inicial.destino ?? '').toLocaleUpperCase('pt-BR'),
      produto: inicial.produto || t?.produtoDare || PADRAO_DARE.produtoDare,
      baseCalculoTexto: inicial.baseCalculoTexto ?? '',
      valor: valorParaTexto(inicial.valorIcms),
      codigoReceita: inicial.codigoReceita || t?.codigoReceita || PADRAO_DARE.codigoReceita,
      dataVencimento: inicial.dataVencimento || defaultDueDate(),
      mesReferencia: inicial.mesReferencia || currentMonthYear(),
    })
    // Só reinicia quando o diálogo abre com outro conteúdo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, inicial])

  // Troca a empresa e acompanha o produto e a receita dela, a menos que o
  // usuário já tenha mudado esses campos à mão.
  const usarTransportadora = (nova: Transportadora) => {
    const antiga = transportadora
    setTransportadoraId(nova.id)
    setCampos(c => c && {
      ...c,
      produto: !antiga || c.produto === antiga.produtoDare ? nova.produtoDare : c.produto,
      codigoReceita: !antiga || c.codigoReceita === antiga.codigoReceita ? nova.codigoReceita : c.codigoReceita,
    })
  }

  const trocarTransportadora = (id: string) => {
    const nova = ativas.find(t => t.id === id)
    if (nova) usarTransportadora(nova)
  }

  const set = (field: keyof Campos) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCampos(s => (s ? { ...s, [field]: e.target.value } : s))

  const enviar = async (event: FormEvent) => {
    event.preventDefault()
    if (!campos || !transportadora) return
    const valorIcms = textoParaValor(campos.valor)
    if (!valorIcms || valorIcms <= 0) {
      setErro('Informe o valor do DARE')
      return
    }
    setErro('')
    setEmitindo(true)
    const { valor, ...resto } = campos
    void valor
    const result = await emitir(transportadora, { ...resto, valorIcms, valorBase: inicial?.valorBase ?? null })
    setEmitindo(false)
    if (!result.ok) {
      setErro(result.error)
      toast.error(`DARE da NF ${campos.notaFiscal} não foi emitido`, { description: result.error })
      return
    }
    toast.success(`DARE da NF ${campos.notaFiscal} emitido`)
    onEmitido?.()
    onOpenChange(false)
  }

  const campo = (field: keyof Campos, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <Label className="text-xs" htmlFor={`dare-${field}`}>{label}</Label>
      <Input id={`dare-${field}`} value={campos?.[field] ?? ''} onChange={set(field)} {...props} />
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={o => !emitindo && onOpenChange(o)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cadastrando ? 'Dados da transportadora' : 'Emitir DARE'}</DialogTitle>
          <DialogDescription>
            {cadastrando
              ? 'Informe a transportadora que vai pagar o DARE. Depois é só conferir a guia.'
              : 'Confira e ajuste os dados antes de enviar para a SEFIN-RO.'}
          </DialogDescription>
        </DialogHeader>

        {cadastrando ? (
          <div className="space-y-3">
            {ativas.length === 0 && transportadoras.length > 0 && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
                Suas transportadoras estão desativadas. Reative uma na página Transportadoras ou cadastre outra aqui.
              </p>
            )}
            <TransportadoraForm
              textoSalvar="Salvar e continuar"
              onCancel={ativas.length > 0 ? () => setNovaAberta(false) : () => onOpenChange(false)}
              onSaved={t => {
                setAtivaId(t.id)
                usarTransportadora(t)
                setNovaAberta(false)
              }}
            />
          </div>
        ) : campos && (
          <form onSubmit={enviar} className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Transportadora (contribuinte do DARE)</Label>
                <button
                  type="button"
                  className="text-xs text-sky-700 hover:underline"
                  onClick={() => setNovaAberta(true)}
                  disabled={emitindo}
                >
                  + Outra transportadora
                </button>
              </div>
              <Select value={transportadoraId} onValueChange={trocarTransportadora}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {ativas.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nomeFantasia || t.razaoSocial} · {formatCnpj(t.cnpj)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3">
              {campo('notaFiscal', 'Nota fiscal', { required: true })}
              {campo('destinatario', 'Destinatário')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {campo('origem', 'Origem')}
              {campo('destino', 'Destino')}
            </div>
            {campo('produto', 'Produto')}
            {campo('baseCalculoTexto', 'Base de cálculo (texto da guia)')}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {campo('valor', 'Valor (R$)', { inputMode: 'decimal', required: true })}
              {campo('codigoReceita', 'Receita', { inputMode: 'numeric', required: true })}
              {campo('dataVencimento', 'Vencimento', { placeholder: 'dd/mm/aaaa', required: true })}
              {campo('mesReferencia', 'Referência', { placeholder: 'mm/aaaa', required: true })}
            </div>

            {erro && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{erro}</div>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" disabled={emitindo} onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={emitindo || !transportadora}>
                {emitindo ? 'Emitindo na SEFIN…' : 'Emitir e baixar PDF'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
