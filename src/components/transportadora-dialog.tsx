'use client'

import { FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTransportadoras } from '@/components/transportadora-context'
import { formatCnpj, isValidCnpj, onlyDigits } from '@/lib/cnpj'
import { PADRAO_DARE, transportadoraSchema } from '@/lib/transportadora-schema'
import type { Transportadora } from '@/lib/types'

type FormState = {
  cnpj: string
  razaoSocial: string
  nomeFantasia: string
  inscricaoEstadual: string
  email: string
  telefone: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  municipio: string
  codigoMunicipio: string
  uf: string
  aliquotaIcms: string
  percentualReducao: string
  codigoReceita: string
  produtoDare: string
}

const VAZIO: FormState = {
  cnpj: '', razaoSocial: '', nomeFantasia: '', inscricaoEstadual: '', email: '', telefone: '', cep: '',
  logradouro: '', numero: '', complemento: '', bairro: '', municipio: '', codigoMunicipio: '', uf: '',
  aliquotaIcms: String(PADRAO_DARE.aliquotaIcms),
  percentualReducao: String(PADRAO_DARE.percentualReducao),
  codigoReceita: PADRAO_DARE.codigoReceita,
  produtoDare: PADRAO_DARE.produtoDare,
}

const fromTransportadora = (t: Transportadora): FormState => ({
  cnpj: formatCnpj(t.cnpj),
  razaoSocial: t.razaoSocial,
  nomeFantasia: t.nomeFantasia ?? '',
  inscricaoEstadual: t.inscricaoEstadual ?? '',
  email: t.email ?? '',
  telefone: t.telefone ?? '',
  cep: t.cep ?? '',
  logradouro: t.logradouro ?? '',
  numero: t.numero ?? '',
  complemento: t.complemento ?? '',
  bairro: t.bairro ?? '',
  municipio: t.municipio ?? '',
  codigoMunicipio: t.codigoMunicipio ?? '',
  uf: t.uf ?? '',
  aliquotaIcms: String(t.aliquotaIcms).replace('.', ','),
  percentualReducao: String(t.percentualReducao).replace('.', ','),
  codigoReceita: t.codigoReceita,
  produtoDare: t.produtoDare,
})

const numero = (v: string) => Number(v.replace(',', '.'))

interface FormProps {
  transportadora?: Transportadora | null
  onSaved: (t: Transportadora) => void
  onCancel?: () => void
  textoSalvar?: string
}

// Formulário usado na página de transportadoras e dentro do diálogo do DARE,
// quando a pessoa tenta emitir sem ter cadastrado nenhuma.
export function TransportadoraForm({ transportadora, onSaved, onCancel, textoSalvar = 'Salvar' }: FormProps) {
  const { transportadoras, salvarTransportadora } = useTransportadoras()
  const editando = !!transportadora
  const [form, setForm] = useState<FormState>(() => (transportadora ? fromTransportadora(transportadora) : VAZIO))
  const [buscando, setBuscando] = useState(false)
  const [consultado, setConsultado] = useState(editando)

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(s => ({ ...s, [field]: e.target.value }))

  const buscarCnpj = async () => {
    const cnpj = onlyDigits(form.cnpj)
    if (!isValidCnpj(cnpj)) {
      toast.error('CNPJ inválido')
      return
    }
    if (transportadoras.some(t => t.cnpj === cnpj)) {
      toast.warning('Esta empresa já está cadastrada neste navegador')
      return
    }
    setBuscando(true)
    try {
      const res = await fetch(`/api/cnpj/${cnpj}`)
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Se a consulta falhar (sem crédito, fora do ar, limite), ainda dá
        // para cadastrar digitando os dados. Só o 404 encerra.
        const manual = res.status !== 404
        toast.error(body.error || 'Falha na consulta do CNPJ', {
          description: manual ? 'Preencha os dados à mão.' : undefined,
        })
        setForm(s => ({ ...s, cnpj: formatCnpj(cnpj) }))
        if (manual) setConsultado(true)
        return
      }
      setForm(s => ({
        ...s,
        cnpj: formatCnpj(cnpj),
        razaoSocial: body.razaoSocial ?? '',
        nomeFantasia: body.nomeFantasia ?? '',
        inscricaoEstadual: body.inscricaoEstadual ?? '',
        email: body.email ?? '',
        telefone: body.telefone ?? '',
        cep: body.cep ?? '',
        logradouro: body.logradouro ?? '',
        numero: body.numero ?? '',
        complemento: body.complemento ?? '',
        bairro: body.bairro ?? '',
        municipio: body.municipio ?? '',
        codigoMunicipio: body.codigoMunicipio ?? '',
        uf: body.uf ?? '',
      }))
      setConsultado(true)
      if (body.fonte === 'brasilapi') toast.info('Dados da BrasilAPI. Confira a inscrição estadual.')
    } catch {
      toast.error('Falha na consulta do CNPJ', { description: 'Preencha os dados à mão.' })
      setForm(s => ({ ...s, cnpj: formatCnpj(cnpj) }))
      setConsultado(true)
    } finally {
      setBuscando(false)
    }
  }

  const salvar = (event: FormEvent) => {
    event.preventDefault()
    const parsed = transportadoraSchema.safeParse({
      ...form,
      cnpj: editando ? transportadora!.cnpj : form.cnpj,
      aliquotaIcms: numero(form.aliquotaIcms),
      percentualReducao: numero(form.percentualReducao),
    })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }
    const result = salvarTransportadora(parsed.data, transportadora?.id)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(editando ? 'Empresa atualizada' : 'Empresa cadastrada')
    onSaved(result.transportadora)
  }

  const campo = (field: keyof FormState, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <Label className="text-xs" htmlFor={`t-${field}`}>{label}</Label>
      <Input id={`t-${field}`} value={form[field]} onChange={set(field)} {...props} />
    </div>
  )

  return (
    <form onSubmit={salvar} className="space-y-5">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs" htmlFor="t-cnpj">CNPJ</Label>
          <Input
            id="t-cnpj"
            value={form.cnpj}
            disabled={editando}
            placeholder="00.000.000/0000-00"
            onChange={set('cnpj')}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                buscarCnpj()
              }
            }}
          />
        </div>
        {!editando && (
          <Button type="button" variant="outline" onClick={buscarCnpj} disabled={buscando}>
            {buscando ? 'Buscando…' : 'Buscar'}
          </Button>
        )}
      </div>

      {consultado && (
        <>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium mb-2">Dados cadastrais</legend>
            {campo('razaoSocial', 'Razão social', { required: true })}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {campo('nomeFantasia', 'Nome fantasia')}
              {campo('inscricaoEstadual', 'Inscrição estadual')}
              {campo('email', 'E-mail', { type: 'email' })}
              {campo('telefone', 'Telefone')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_1fr] gap-3">
              {campo('cep', 'CEP')}
              {campo('logradouro', 'Logradouro')}
              {campo('numero', 'Número')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_1fr] gap-3">
              {campo('bairro', 'Bairro')}
              {campo('municipio', 'Município')}
              {campo('uf', 'UF', { maxLength: 2 })}
            </div>
          </fieldset>

          <fieldset className="space-y-3 border-t pt-4">
            <legend className="text-sm font-medium mb-2">ICMS Frete RO (DARE)</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {campo('aliquotaIcms', 'Alíquota ICMS (%)', { inputMode: 'decimal', required: true })}
              {campo('percentualReducao', 'Redução da base (%)', { inputMode: 'decimal', required: true })}
              {campo('codigoReceita', 'Código de receita', { inputMode: 'numeric', required: true })}
            </div>
            {campo('produtoDare', 'Produto informado no DARE', { required: true })}
            <p className="text-xs text-slate-400">
              Padrão: 12% com redução de 20% e receita 1414. Só vale para transportadoras. Mude aqui quando a empresa tiver outra regra.
            </p>
          </fieldset>
        </>
      )}

      <p className="text-xs text-slate-400">
        Os dados ficam salvos só neste navegador. Em outro computador ou navegador será preciso cadastrar de novo.
      </p>

      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>}
        <Button type="submit" disabled={!consultado}>{textoSalvar}</Button>
      </div>
    </form>
  )
}

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transportadora?: Transportadora | null
  onSaved?: (t: Transportadora) => void
}

export default function TransportadoraDialog({ open, onOpenChange, transportadora, onSaved }: DialogProps) {
  const editando = !!transportadora
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar empresa' : 'Nova empresa'}</DialogTitle>
          <DialogDescription>
            {editando ? 'O CNPJ não pode ser alterado.' : 'Digite o CNPJ e clique em Buscar para preencher os dados.'}
          </DialogDescription>
        </DialogHeader>
        {/* Só monta aberto, e a key recria o formulário com os dados certos. */}
        {open && (
          <TransportadoraForm
            key={transportadora?.id ?? 'nova'}
            transportadora={transportadora}
            onCancel={() => onOpenChange(false)}
            onSaved={t => {
              onSaved?.(t)
              onOpenChange(false)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
