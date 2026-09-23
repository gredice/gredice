'use client';

import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { useState } from 'react';
import {
    type PublicGardenDetail,
    PublicGardenViewer,
} from '../../../packages/game/src/viewers/PublicGardenViewer';

function switchGarden(
    id: number,
    detailBlockName: 'BirdHouse' | 'Tree',
): PublicGardenDetail {
    return {
        backgroundPalette: 'current',
        farmId: 1,
        homeCamera: null,
        id,
        isPublic: true,
        isSandbox: false,
        latitude: 45.815,
        longitude: 15.982,
        name: `Vrt ${id.toString()}`,
        raisedBeds: [],
        stacks: {
            '0': {
                '0': [
                    {
                        id: `grass-${id.toString()}-0-0`,
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                    {
                        id: `detail-${id.toString()}`,
                        name: detailBlockName,
                        rotation: 0,
                    },
                ],
                '1': [
                    {
                        id: `grass-${id.toString()}-0-1`,
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
            },
            '1': {
                '0': [
                    {
                        id: `grass-${id.toString()}-1-0`,
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
                '1': [
                    {
                        id: `grass-${id.toString()}-1-1`,
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
            },
        },
        updatedAt: `2026-08-${id === 1 ? '27' : '28'}T12:00:00.000Z`,
    };
}

const firstGarden = switchGarden(1, 'Tree');
const secondGarden = switchGarden(2, 'BirdHouse');

export function PublicGardenSwitchFixture() {
    const [selectedGarden, setSelectedGarden] = useState(firstGarden);

    return (
        <NuqsTestingAdapter>
            <div
                className="relative h-[480px] w-[720px] overflow-hidden"
                data-garden-id={selectedGarden.id}
                data-testid="public-garden-switch-fixture"
            >
                <button
                    className="absolute top-3 left-3 z-20"
                    onClick={() =>
                        setSelectedGarden((current) =>
                            current.id === firstGarden.id
                                ? secondGarden
                                : firstGarden,
                        )
                    }
                    type="button"
                >
                    Promijeni vrt
                </button>
                <PublicGardenViewer
                    appBaseUrl=""
                    className="size-full"
                    deferDetails={false}
                    garden={selectedGarden}
                    noControls
                    noSound
                    noWeather
                    renderDetails={false}
                    spriteBaseUrl=""
                />
            </div>
        </NuqsTestingAdapter>
    );
}
