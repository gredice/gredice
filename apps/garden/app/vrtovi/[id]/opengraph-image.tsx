import { ImageResponse } from 'next/og'
import { GardenDisplay2D } from '../../../components/GardenDisplay2D'
import { Logotype } from '../../../components/Logotype';
import { client } from '@gredice/client';

type BlockData = {
    id: string,
    information: {
        name: string,
        label: string,
        shortDescription: string,
        fullDescription: string,
    },
    attributes: {
        height: number,
        stackable?: boolean
    },
    prices: {
        sunflowers: number
    }
}

export const size = {
    width: 1200,
    height: 630,
};
export const dynamic = 'force-dynamic';
export const contentType = 'image/png';
export const maxDuration = 10;

export default async function GardenOgImage({ params }: { params: Promise<{ id: string }> }) {
    const { id: gardenId } = await params;
    if (!gardenId) {
        return new Response('Garden ID is required', { status: 400 });
    }

    const gardenResponse = await client().api.gardens[":gardenId"].public.$get({
        param: {
            gardenId: gardenId.toString()
        }
    });
    if (gardenResponse.status === 400 || gardenResponse.status === 404) {
        console.error(`Garden with ID ${gardenId} not found`);
        return null;
    }
    const garden = await gardenResponse.json();

    const blockDataResponse = await client().api.directories.entities[":entityType"].$get({ param: { entityType: 'block' } });
    const blockData = await blockDataResponse.json() as BlockData[];

    return new ImageResponse(
        (
            <div
                style={{
                    fontSize: 36,
                    background: '#2E6F40',
                    color: 'white',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    position: 'relative',
                }}
            >
                <div style={{
                    position: 'absolute',
                    left: 24,
                    right: 24,
                    top: 24,
                    bottom: 106,
                    display: 'flex',
                    border: '1px solid #f0e9e2',
                    background: '#E7E2CC',
                    borderRadius: 32,
                    overflow: 'hidden',
                    boxShadow: '0px 18px 32px 0px rgba(0,0,0,0.2)'
                }}>
                    <GardenDisplay2D
                        garden={garden}
                        blockData={blockData}
                        viewportSize={1200}
                        viewportOffset={{ x: 24, y: 630 / 2 + 24 * 2 + 106 / 2 }}
                        style={{
                            marginLeft: 0,
                            display: 'flex',
                            width: 1200,
                            height: 630,
                        }} />
                </div>
                <div style={{
                    position: 'absolute',
                    bottom: 24,
                    left: 32,
                    right: 32,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 32,
                    justifyContent: 'space-between',
                }}>
                    <div style={{
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden'
                    }}>
                        {garden.name}
                    </div>
                    <Logotype width={220} color={'white'} />
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
        }
    )
}