import type { Metadata } from 'next'

export const SITE_URL = 'https://geraguia.com.br'
export const SITE_NOME = 'GeraGuia'

export interface PaginaConteudo {
  href: string
  titulo: string
  resumo: string
  atualizado: string // AAAA-MM-DD, vai para o sitemap
}

// Páginas de tabela e passo a passo. A home, o rodapé e o sitemap leem daqui.
export const PAGINAS_CONTEUDO: PaginaConteudo[] = [
  {
    href: '/cubagem-madeira/como-calcular',
    titulo: 'Como calcular a cubagem de madeira',
    resumo: 'Fórmulas do método geométrico (Smalian), do Francon e da madeira serrada, com exemplos, romaneio e rendimento tora → serrada.',
    atualizado: '2026-11-21',
  },
  {
    href: '/piso-minimo-frete/tabela',
    titulo: 'Tabela de frete ANTT 2026: pisos mínimos A, B, C e D',
    resumo: 'Coeficientes CCD e CC dos 12 tipos de carga, de 2 a 9 eixos, com a fórmula e um exemplo com retorno vazio.',
    atualizado: '2026-11-21',
  },
  {
    href: '/ro/icms-frete/tabela',
    titulo: 'Tabela do ICMS frete em Rondônia (ANTT 2026)',
    resumo: 'Coeficientes CCD e CC por tipo de carga e eixos, a fórmula da base de cálculo e um exemplo.',
    atualizado: '2026-11-21',
  },
  {
    href: '/mt/fethab/tabela',
    titulo: 'Tabela do FETHAB 2026: valores e códigos de receita',
    resumo: 'Valor por tonelada, cabeça ou m³ de cada produto, com os códigos do FETHAB e da entidade.',
    atualizado: '2026-11-21',
  },
  {
    href: '/mt/fethab/como-emitir',
    titulo: 'Como emitir o DAR do FETHAB, passo a passo',
    resumo: 'Do XML da NF-e ao PDF da SEFAZ-MT com código de barras e PIX.',
    atualizado: '2026-11-21',
  },
]

// Metadados de uma página: título, descrição, canonical e cartão de
// compartilhamento (WhatsApp, redes sociais).
export function metadataPagina({ titulo, descricao, caminho }: { titulo: string; descricao: string; caminho: string }): Metadata {
  return {
    title: { absolute: `${titulo} · ${SITE_NOME}` },
    description: descricao,
    alternates: { canonical: caminho },
    openGraph: {
      title: `${titulo} · ${SITE_NOME}`,
      description: descricao,
      url: caminho,
      siteName: SITE_NOME,
      locale: 'pt_BR',
      type: 'website',
      images: ['/opengraph-image'],
    },
    twitter: { card: 'summary_large_image', title: `${titulo} · ${SITE_NOME}`, description: descricao, images: ['/opengraph-image'] },
  }
}
