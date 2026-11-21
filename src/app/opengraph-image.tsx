import { ImageResponse } from 'next/og'

// Cartão que aparece quando o link é compartilhado (WhatsApp, redes sociais).
export const alt = 'GeraGuia: ICMS frete RO e FETHAB MT, guia pronta para pagar'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const runtime = 'edge'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '72px 80px', background: '#0f172a', color: '#f8fafc', fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 700 }}>G</div>
          <div style={{ fontSize: 44, fontWeight: 700 }}>GeraGuia</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>Guias de tributos estaduais, prontas para pagar</div>
          <div style={{ fontSize: 34, color: '#94a3b8' }}>ICMS frete em Rondônia · FETHAB em Mato Grosso</div>
        </div>
        <div style={{ fontSize: 30, color: '#38bdf8' }}>geraguia.com.br</div>
      </div>
    ),
    size,
  )
}
