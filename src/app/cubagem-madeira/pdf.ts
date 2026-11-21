// PDF do romaneio com jsPDF + autotable (tabelas de verdade: arquivo leve e
// texto nítido). As bibliotecas só são baixadas quando há romaneio para enviar.

import type { jsPDF as JsPDF } from 'jspdf'
import type { Documento, TabelaDoc } from './documento'

type Modulos = { jsPDF: typeof JsPDF; autoTable: typeof import('jspdf-autotable').default }

let promessa: Promise<Modulos> | null = null
let modulos: Modulos | null = null

export function carregarPdf(): Promise<Modulos> {
  promessa ??= Promise.all([import('jspdf'), import('jspdf-autotable')])
    .then(([a, b]) => (modulos = { jsPDF: a.jsPDF, autoTable: b.default }))
    .catch(err => { promessa = null; throw err })
  return promessa
}

export const pdfPronto = () => modulos

// Fontes padrão do PDF só têm Latin-1: troca os espaços especiais do pt-BR.
const t = (s: string) => s.replace(/[  ]/g, ' ')

const A4 = { w: 210, h: 297 }
const M = 12
const TOPO = 14
const BASE = 14
const GAP = 4
const CINZA: [number, number, number] = [71, 85, 105]

export function gerarPdf({ jsPDF, autoTable }: Modulos, d: Documento): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const largura = A4.w - 2 * M
  const fim = A4.h - BASE
  let y = TOPO + 4

  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(15, 23, 42)
  doc.text(t(d.titulo), M, y)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...CINZA)
  doc.text(d.data, A4.w - M, y, { align: 'right' })
  y += 2
  doc.setLineWidth(0.5).setDrawColor(15, 23, 42).line(M, y, A4.w - M, y)
  y += 5

  const novaPagina = () => { doc.addPage(); y = TOPO }
  const altura = (tb: TabelaDoc) => (tb.linhas.length + 1 + (tb.rodape ? 1 : 0)) * 4.6 + (tb.titulo ? 4.5 : 0)

  for (const s of d.secoes) {
    if (s.titulo) {
      if (y + 20 > fim) novaPagina()
      doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(15, 23, 42)
      doc.text(t(s.titulo), M, y + 3.5)
      doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...CINZA)
      if (s.resumo) doc.text(t(s.resumo), A4.w - M, y + 3.5, { align: 'right' })
      doc.setLineWidth(0.2).setDrawColor(203, 213, 225).line(M, y + 5, A4.w - M, y + 5)
      y += 7.5
    }

    const colW = (largura - GAP * (s.porLinha - 1)) / s.porLinha
    for (let i = 0; i < s.tabelas.length; i += s.porLinha) {
      const fila = s.tabelas.slice(i, i + s.porLinha)
      // Fila curta que não cabe no fim da folha começa na próxima.
      const maior = Math.max(...fila.map(altura))
      if (y + maior > fim && maior < fim - TOPO) novaPagina()
      const pagina = doc.getCurrentPageInfo().pageNumber
      const fins: { pagina: number; y: number }[] = []

      fila.forEach((tb, k) => {
        doc.setPage(pagina)
        const x = M + k * (colW + GAP)
        let ty = y
        if (tb.titulo || tb.resumo) {
          doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(15, 23, 42)
          if (tb.titulo) doc.text(t(tb.titulo), x, ty + 3)
          doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...CINZA)
          if (tb.resumo) doc.text(t(tb.resumo), x + colW, ty + 3, { align: 'right' })
          ty += 4.5
        }
        const ult = tb.cabecalho.length - 1
        autoTable(doc, {
          startY: ty,
          margin: { left: x, right: A4.w - x - colW, top: TOPO, bottom: BASE },
          tableWidth: colW,
          head: [tb.cabecalho.map(t)],
          body: tb.linhas.map(l => l.map(t)),
          foot: tb.rodape ? [tb.rodape.map(t)] : undefined,
          showFoot: 'lastPage',
          theme: 'grid',
          rowPageBreak: 'avoid',
          styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 0.9, bottom: 0.9, left: 1.3, right: 1.3 }, textColor: [15, 23, 42], lineColor: [203, 213, 225], lineWidth: 0.15 },
          headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
          footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold' },
          didParseCell: c => { if (c.column.index === ult) c.cell.styles.halign = 'right' },
        })
        fins.push({ pagina: doc.getCurrentPageInfo().pageNumber, y: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY })
      })

      const ultima = Math.max(...fins.map(f => f.pagina))
      doc.setPage(ultima)
      y = Math.max(...fins.filter(f => f.pagina === ultima).map(f => f.y)) + GAP
    }
    y += 2
  }

  if (y + 10 > fim) novaPagina()
  doc.setLineWidth(0.5).setDrawColor(15, 23, 42).line(M, y, A4.w - M, y)
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(15, 23, 42)
  let x = A4.w - M
  for (const total of [...d.totais].reverse()) {
    doc.text(t(total), x, y + 5, { align: 'right' })
    x -= doc.getTextWidth(t(total)) + 8
  }

  const paginas = doc.getNumberOfPages()
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(148, 163, 184)
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    doc.text('geraguia.com.br/cubagem-madeira', M, A4.h - 7)
    if (paginas > 1) doc.text(`${p}/${paginas}`, A4.w - M, A4.h - 7, { align: 'right' })
  }
  return doc.output('blob')
}

// No celular abre o menu de compartilhar (WhatsApp etc.); no computador baixa o arquivo.
export async function enviarPdf(d: Documento): Promise<'compartilhado' | 'baixado' | 'cancelado'> {
  const blob = gerarPdf(pdfPronto() ?? (await carregarPdf()), d)
  const arquivo = new File([blob], d.arquivo, { type: 'application/pdf' })
  const toque = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  if (toque && navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: d.titulo })
      return 'compartilhado'
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return 'cancelado'
      // Sem permissão (o gesto expirou, por exemplo): cai para o download.
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = d.arquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return 'baixado'
}
