import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Aurum — Physical Gold, Digitally Owned';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #0a0f1a 0%, #111827 60%, #1f2937 100%)',
          position: 'relative',
        }}
      >
        {/* Gold glow accent */}
        <div
          style={{
            position: 'absolute',
            top: '-200px',
            right: '-100px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0) 70%)',
          }}
        />

        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '48px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #fbbf24, #b45309)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '30px',
              fontWeight: 700,
            }}
          >
            Au
          </div>
          <span style={{ color: 'white', fontSize: '40px', fontWeight: 700 }}>Aurum</span>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: 'white', fontSize: '76px', fontWeight: 700, lineHeight: 1.1 }}>
            Own real gold.
          </span>
          <span style={{ color: '#fbbf24', fontSize: '76px', fontWeight: 700, lineHeight: 1.1 }}>
            No vault needed.
          </span>
        </div>

        {/* Subline */}
        <span style={{ color: '#9ca3af', fontSize: '32px', marginTop: '36px' }}>
          From GH₵15 · Backed by Goldbod vault holdings · Pay with Mobile Money
        </span>

        {/* Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginTop: '44px',
            padding: '12px 28px',
            borderRadius: '999px',
            border: '1px solid rgba(245,158,11,0.4)',
            background: 'rgba(245,158,11,0.12)',
            color: '#fbbf24',
            fontSize: '24px',
            alignSelf: 'flex-start',
          }}
        >
          ● 100% backed by physical gold
        </div>
      </div>
    ),
    { ...size },
  );
}
