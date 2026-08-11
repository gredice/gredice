import type { BlockData } from '@gredice/client';

export const outletDisplayTableBlockName = 'OutletDisplayTable';
export const outletDisplayTableHeight = 0.67;
export const outletDisplayTableSunflowerPrice = 40;

const epoch = new Date(0).toISOString();
const internalSceneBlockId = -10_001;

const outletDisplayTableBlockData = {
    id: internalSceneBlockId,
    entityType: {
        id: 8,
        name: 'block',
        label: 'Blok',
    },
    slug: 'outlet-display-table',
    information: {
        name: outletDisplayTableBlockName,
        label: 'Drveni izložbeni stol',
        shortDescription:
            'Čvrst drveni stol za izlaganje tegli, biljaka i vrtnih ukrasa.',
        fullDescription:
            'Izložbeni stol izrađen od toplih drvenih dasaka. Postavi ga uz gredice ili vrtnu stazu, a na njegovu plohu složi tegle i druge ukrase.',
    },
    attributes: {
        height: outletDisplayTableHeight,
        hitboxDepth: 0.75,
        hitboxHeight: outletDisplayTableHeight,
        hitboxWidth: 0.9,
        nightOnlyPurchase: false,
        spanDepth: 1,
        spanWidth: 1,
        stackable: true,
        type: 'decoration',
    },
    prices: {
        sunflowers: outletDisplayTableSunflowerPrice,
    },
    functions: {
        recycler: false,
        raisedBed: false,
    },
    createdAt: epoch,
    updatedAt: epoch,
} satisfies BlockData;

export function isInternalSceneBlockData(block: BlockData) {
    return block.id === internalSceneBlockId;
}

export function getInternalSceneBlockData(): BlockData[] {
    return [outletDisplayTableBlockData];
}

export function withInternalSceneBlockData(
    blockData: BlockData[],
): BlockData[] {
    if (
        blockData.some(
            (block) => block.information.name === outletDisplayTableBlockName,
        )
    ) {
        return blockData;
    }

    return [...blockData, outletDisplayTableBlockData];
}
