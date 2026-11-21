'use client'

import { useRef, useState } from 'react'
import { lerNfe, type NotaNfe } from '@/lib/nfe'
import { cn } from '@/lib/utils'

const LIMITE_ARQUIVOS = 50
const LIMITE_BYTES = 2 * 1024 * 1024

interface Props {
  onCarregar: (notas: NotaNfe[], erros: string[]) => void
}

// Lê os XML no navegador. Nada sai da máquina da pessoa.
export default function ImportarNfe({ onCarregar }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [arrastando, setArrastando] = useState(false)
  const [lendo, setLendo] = useState(false)

  const ler = async (lista: FileList | null) => {
    const arquivos = Array.from(lista ?? []).slice(0, LIMITE_ARQUIVOS)
    if (!arquivos.length) return
    setLendo(true)
    const notas: NotaNfe[] = []
    const erros: string[] = []
    const chaves = new Set<string>()
    for (const arquivo of arquivos) {
      try {
        if (arquivo.size > LIMITE_BYTES) throw new Error('arquivo grande demais para uma NF-e')
        const nota = lerNfe(await arquivo.text())
        if (nota.chave && chaves.has(nota.chave)) continue
        if (nota.chave) chaves.add(nota.chave)
        notas.push(nota)
      } catch (error) {
        erros.push(`${arquivo.name}: ${(error as Error).message}`)
      }
    }
    if ((lista?.length ?? 0) > LIMITE_ARQUIVOS) erros.push(`Só os primeiros ${LIMITE_ARQUIVOS} arquivos foram lidos.`)
    setLendo(false)
    if (input.current) input.current.value = ''
    onCarregar(notas, erros)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setArrastando(true) }}
      onDragLeave={() => setArrastando(false)}
      onDrop={e => { e.preventDefault(); setArrastando(false); ler(e.dataTransfer.files) }}
      className={cn(
        'rounded-xl border-2 border-dashed p-4 text-center transition-colors',
        arrastando ? 'border-sky-500 bg-sky-50' : 'border-slate-200',
      )}
    >
      <input
        ref={input}
        type="file"
        accept=".xml,text/xml,application/xml"
        multiple
        className="hidden"
        onChange={e => ler(e.target.files)}
      />
      <button
        type="button"
        disabled={lendo}
        onClick={() => input.current?.click()}
        className="text-sm font-medium text-sky-700 hover:underline disabled:opacity-60"
      >
        {lendo ? 'Lendo…' : 'Carregar XML da NF-e'}
      </button>
      <p className="mt-1 text-xs text-slate-500">
        Ou arraste os arquivos aqui. Aceita várias notas. O XML é lido no seu navegador e não é enviado.
      </p>
    </div>
  )
}
