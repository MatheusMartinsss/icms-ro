import type { MetadataRoute } from 'next'
import { FERRAMENTAS, disponivel } from '@/lib/ferramentas'
import { PAGINAS_CONTEUDO, SITE_URL } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const ferramentas = FERRAMENTAS.filter(disponivel).map(f => ({
    url: `${SITE_URL}${f.href}`,
    changeFrequency: 'monthly' as const,
    priority: 0.9,
  }))
  const conteudo = PAGINAS_CONTEUDO.map(p => ({
    url: `${SITE_URL}${p.href}`,
    lastModified: p.atualizado,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))
  return [{ url: SITE_URL, changeFrequency: 'weekly', priority: 1 }, ...ferramentas, ...conteudo]
}
