import { ImageResponse } from 'next/og'
import { GardenDisplay2D } from '../../../../components/GardenDisplay2D'
import { Logotype } from '../../../../components/Logotype';
import { client } from '@gredice/client';

export const dynamic = 'force-dynamic';

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

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
                    fontSize: 32,
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
                    background: '#FEFAF6',
                    borderRadius: 12,
                    overflow: 'hidden',
                    boxShadow: 'rgba(0, 0, 0, 0.25) 0px 25px 50px -12px'
                }}>
                    <GardenDisplay2D
                        garden={garden}
                        blockData={blockData}
                        viewportSize={1200}
                        viewportOffset={{ x: 24*2, y: 630/2 + 24*2 + 106 / 2 }}
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
                    justifyContent: 'space-between',
                }}>
                    <div>
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