import { ImageResponse } from 'next/og'
import { Logotype } from '../../components/Logotype'
 
export async function GET() {
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
      width: 1200,
      height: 630,
    }
  )
}