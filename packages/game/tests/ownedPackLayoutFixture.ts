import type { BlockData } from '@gredice/client';
import type { GardenPackLayout } from '@gredice/js/gardenPackLayouts';
import type { CurrentGarden } from '../src/hooks/useCurrentGarden';
import type { OwnedGardenPack } from '../src/hud/ownedGardenPackInventory';
import { getLocalSandboxBlockData } from '../src/localSandboxBlockData';

export const packLayoutFixtureAccountId =
    '50000000-0000-4000-8000-000000000001';
export const packLayoutFixtureUserId = 'layout-user';
export const packLayoutFixturePurchaseId =
    '50000000-0000-4000-8000-000000000002';
const names = ['FallenLog', 'LeafRake', 'EnamelGardenLamp', 'GardenTeaTable'];
export function createPackLayoutFixtureBlocks(): BlockData[] {
    return getLocalSandboxBlockData().map((block, index) => ({
        ...block,
        id: index + 1000,
        prices: { ...block.prices, sunflowers: 0 },
    }));
}
export function createPackLayoutFixturePack(
    blocks = createPackLayoutFixtureBlocks(),
): OwnedGardenPack {
    return {
        purchaseId: packLayoutFixturePurchaseId,
        productId: 'layout-fixture',
        productVersionId: 'layout-fixture:v1',
        name: { hr: 'Jesensko druženje' },
        description: { hr: 'Kupljeni predmeti.' },
        previews: [],
        purchasedAt: '2026-10-01T12:00:00Z',
        state: 'unopened',
        remainingQuantity: 4,
        totalQuantity: 4,
        lines: names.map((modelName, index) => ({
            lineId: `line-${index}`,
            entityId:
                blocks
                    .find((block) => block.information.name === modelName)
                    ?.id.toString() ?? '',
            modelName,
            variant: null,
            quantity: 1,
            remainingQuantity: 1,
            availableUnitOrdinals: [1],
        })),
    };
}
export function createPackLayoutFixtureLayout(
    pack = createPackLayoutFixturePack(),
): GardenPackLayout {
    return {
        id: 'layout-fixture',
        versionId: 'layout-fixture:v1',
        name: { hr: 'Jesensko druženje' },
        availableUnits: pack.lines.map((line) => ({
            lineId: line.lineId,
            unitOrdinal: 1,
        })),
        placements: pack.lines.map((line, index) => ({
            slotId: `slot-${index}`,
            lineId: line.lineId,
            entityId: line.entityId,
            modelName: line.modelName,
            variant: line.variant,
            offset: {
                x: index === 0 ? 0 : index === 1 ? 2 : index === 2 ? 0 : 2,
                y: index < 2 ? 0 : 2,
            },
            rotation: 0,
            footprint: { width: index === 0 ? 2 : 1, depth: 1 },
        })),
    };
}
export function createPackLayoutFixtureGarden(): CurrentGarden {
    return {
        id: 942,
        name: 'Privatni vrt',
        isSandbox: false,
        isPublic: false,
        homeCamera: null,
        backgroundPalette: 'golden',
        location: { lat: 45.8, lon: 16 },
        raisedBeds: [],
        stacks: Array.from({ length: 81 }, (_, index) => ({
            position: {
                x: (index % 9) - 4,
                y: 0,
                z: Math.floor(index / 9) - 4,
            },
            blocks: [
                { id: `ground-${index}`, name: 'Block_Grass', rotation: 0 },
            ],
        })),
    };
}
