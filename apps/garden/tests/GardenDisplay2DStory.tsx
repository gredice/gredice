import type { BlockData } from '@gredice/client';
import {
    GardenDisplay2D,
    getGardenDisplayBlockImageKey,
    getGardenDisplayViewportOffset,
} from '../components/GardenDisplay2D';

const blockData: BlockData[] = [
    {
        id: 1,
        entityType: {
            id: 8,
            name: 'block',
            label: 'Blok',
        },
        slug: 'block-grass',
        information: {
            name: 'Block_Grass',
            shortDescription: '',
            fullDescription: '',
            label: 'Trava',
        },
        attributes: {
            height: 1,
            stackable: true,
            type: 'decoration',
            nightOnlyPurchase: false,
        },
        prices: {
            sunflowers: 0,
        },
        functions: {
            recycler: false,
            raisedBed: false,
        },
        createdAt: '2026-07-05T00:00:00.000Z',
        updatedAt: '2026-07-05T00:00:00.000Z',
    },
];

const blockSize = 128;
const viewportSize = 600;
const focus = { x: 20, y: 20 };
const transparentPixel =
    'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';

export function GardenDisplay2DStory() {
    return (
        <GardenDisplay2D
            garden={{
                stacks: {
                    [focus.x.toString()]: {
                        [focus.y.toString()]: [
                            {
                                id: 'focused-stack-block',
                                name: 'Block_Grass',
                                rotation: 0,
                            },
                        ],
                    },
                },
            }}
            blockData={blockData}
            blockImageSrcByKey={
                new Map([
                    [
                        getGardenDisplayBlockImageKey('Block_Grass', 1),
                        transparentPixel,
                    ],
                ])
            }
            blockSize={blockSize}
            viewportSize={viewportSize}
            viewportOffset={getGardenDisplayViewportOffset({
                blockSize,
                focus,
                viewportCenter: {
                    x: viewportSize / 2,
                    y: viewportSize / 2,
                },
                viewportSize,
            })}
            style={{
                width: viewportSize,
                height: viewportSize,
            }}
        />
    );
}
