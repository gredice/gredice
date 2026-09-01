'use client';

import {
    createGardenStructureTemplateSeed,
    getGardenStructureWorldFootprintCells,
} from '@gredice/js/gardenStructures';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { useState } from 'react';
import type { GardenVisitorPresenceController } from '../../../packages/game/src/entities/avatar/gardenVisitorPresence';
import {
    type PublicGardenDetail,
    PublicGardenViewer,
} from '../../../packages/game/src/viewers/PublicGardenViewer';

const structureSeed = createGardenStructureTemplateSeed('house');
const visitorPresence = {
    localVisitorId: 'public-garden-switch-fixture',
    onLocalPresenceChange: () => {},
    visitors: [],
} satisfies GardenVisitorPresenceController;

function switchGarden(
    id: number,
    detailBlockName: 'BirdHouse' | 'Tree',
): PublicGardenDetail {
    const structure: PublicGardenDetail['structures'][number] = {
        anchorX: 0,
        anchorY: 0,
        document: structureSeed.document,
        id: `structure-${id.toString()}`,
        isDeleted: false,
        kitKey: structureSeed.kitKey,
        kitVersion: structureSeed.kitVersion,
        revision: id,
        rotation: id === 1 ? 0 : 1,
        templateKey: structureSeed.templateKey,
    };
    const footprint = getGardenStructureWorldFootprintCells(
        structure.document,
        structure,
    );
    const stacks: Record<
        string,
        Record<string, Array<{ id: string; name: string; rotation: number }>>
    > = {};
    for (const cell of footprint) {
        const x = cell.x.toString();
        const y = cell.y.toString();
        const rows = stacks[x] ?? {};
        rows[y] = [
            {
                id: `grass-${id.toString()}-${x}-${y}`,
                name: 'Block_Grass',
                rotation: 0,
            },
        ];
        stacks[x] = rows;
    }
    for (const z of [4, 5]) {
        const rows = stacks['1'] ?? {};
        rows[z.toString()] = [
            {
                id: `grass-${id.toString()}-1-${z.toString()}`,
                name: 'Block_Grass',
                rotation: 0,
            },
        ];
        stacks['1'] = rows;
    }
    const detailX =
        Math.max(...footprint.map((cell) => cell.x)) + (id === 1 ? 2 : 3);
    stacks[detailX.toString()] = {
        '0': [
            {
                id: `grass-${id.toString()}-detail`,
                name: 'Block_Grass',
                rotation: 0,
            },
            {
                id: `detail-${id.toString()}`,
                name: detailBlockName,
                rotation: 0,
            },
        ],
    };

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
        structures: [structure],
        stacks,
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
                    localVisitorSpawnPoint={{ x: 1, z: 3.25 }}
                    noControls
                    noSound
                    noWeather
                    renderDetails={false}
                    spriteBaseUrl=""
                    visitorPresence={visitorPresence}
                />
            </div>
        </NuqsTestingAdapter>
    );
}
