import type { BlockData } from '@gredice/client';

export const outletDisplayTableBlockName = 'OutletDisplayTable';
export const outletDisplayTableHeight = 0.67;
export const outletDisplayTableSunflowerPrice = 40;
export const enamelGardenLampBlockName = 'EnamelGardenLamp';
export const enamelGardenLampHeight = 1.45;
export const doubleGardenLightPoleBlockName = 'DoubleGardenLightPole';
export const doubleGardenLightPoleHeight = 2.2;

const epoch = new Date(0).toISOString();
const outletDisplayTableBlockId = -10_001;
const enamelGardenLampBlockId = -10_002;
const doubleGardenLightPoleBlockId = -10_003;

const outletDisplayTableBlockData = {
    id: outletDisplayTableBlockId,
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

const enamelGardenLampBlockData = {
    id: enamelGardenLampBlockId,
    entityType: {
        id: 8,
        name: 'block',
        label: 'Blok',
    },
    slug: 'enamel-garden-lamp',
    information: {
        name: enamelGardenLampBlockName,
        label: 'Emajlirana vrtna lampa',
        shortDescription:
            'Visoka vrtna lampa s emajliranim sjenilom i toplim, mirnim svjetlom.',
        fullDescription:
            'Vrtna lampa s drvenim stupom i emajliranim sjenilom koja noću toplim svjetlom osvjetljava stazu i obližnje biljke.',
    },
    attributes: {
        height: enamelGardenLampHeight,
        hitboxDepth: 0.46,
        hitboxHeight: enamelGardenLampHeight,
        hitboxWidth: 0.52,
        nightOnlyPurchase: false,
        placeableOnWater: false,
        spanDepth: 1,
        spanWidth: 1,
        stackable: false,
        type: 'decoration',
    },
    prices: {
        sunflowers: 0,
    },
    functions: {
        recycler: false,
        raisedBed: false,
    },
    createdAt: epoch,
    updatedAt: epoch,
} satisfies BlockData;

const doubleGardenLightPoleBlockData = {
    id: doubleGardenLightPoleBlockId,
    entityType: {
        id: 8,
        name: 'block',
        label: 'Blok',
    },
    slug: 'double-garden-light-pole',
    information: {
        name: doubleGardenLightPoleBlockName,
        label: 'Dvostruki drveni rasvjetni stup',
        shortDescription:
            'Visoki drveni stup s dvije nasuprotne svjetiljke za osvjetljenje staza i biljaka.',
        fullDescription:
            'Vitki drveni rasvjetni stup s dvije nasuprotne svjetiljke usmjerene prema tlu. Postavi ga između stolova ili uz stazu kako bi noću osvijetlio prolaz i obližnje biljke.',
    },
    attributes: {
        height: doubleGardenLightPoleHeight,
        hitboxDepth: 0.38,
        hitboxHeight: doubleGardenLightPoleHeight,
        hitboxWidth: 0.94,
        nightOnlyPurchase: false,
        placeableOnWater: false,
        spanDepth: 1,
        spanWidth: 1,
        stackable: false,
        type: 'decoration',
    },
    prices: {
        sunflowers: 0,
    },
    functions: {
        recycler: false,
        raisedBed: false,
    },
    createdAt: epoch,
    updatedAt: epoch,
} satisfies BlockData;

const internalSceneBlockData = [
    outletDisplayTableBlockData,
    enamelGardenLampBlockData,
    doubleGardenLightPoleBlockData,
];
const internalSceneBlockIds = new Set(
    internalSceneBlockData.map((block) => block.id),
);

export function isInternalSceneBlockData(block: BlockData) {
    return internalSceneBlockIds.has(block.id);
}

export function getInternalSceneBlockData(): BlockData[] {
    return internalSceneBlockData;
}

export function withInternalSceneBlockData(
    blockData: BlockData[],
): BlockData[] {
    const directoryBlockNames = new Set(
        blockData.map((block) => block.information.name),
    );
    const missingInternalBlocks = internalSceneBlockData.filter(
        (block) => !directoryBlockNames.has(block.information.name),
    );

    if (missingInternalBlocks.length === 0) {
        return blockData;
    }

    return [...blockData, ...missingInternalBlocks];
}
