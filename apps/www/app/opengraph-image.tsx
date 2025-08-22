import { ImageResponse } from 'next/og'
import { Logotype } from '../components/Logotype'

export const alt = 'Gredice'
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: '#FEFAF6',
          width: '100%',
          height: '100%',
          display: 'flex',
          textAlign: 'center',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Logotype width={800} />
      </div>
    ),
    {
      ...size
    }
  )
}