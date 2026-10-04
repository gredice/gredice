import { ImageResponse } from 'next/og';
import { PublicOgCard } from './api/og/public/PublicOgCard';

export const alt = 'Digitalni vrt Gredice s podignutom gredicom';
export const size = {
    width: 1200,
    height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
    return new ImageResponse(
        <PublicOgCard
            title="Gredice - vrt po tvom"
            description="Postavi gredice, zasadi omiljeno povrće i prati svoj pravi vrt iz digitalnog svijeta."
            eyebrow="Tvoj digitalni vrt"
            imageUrl="https://www.gredice.com/seo-fallback.png"
        />,
        {
            ...size,
        },
    );
}
