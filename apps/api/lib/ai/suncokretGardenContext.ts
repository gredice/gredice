import {
    SUNFLOWER_DROP_BLOCK_NAME,
    SUNFLOWER_DROP_DAILY_LIMIT,
    SUNFLOWER_DROP_REWARD_AMOUNT,
} from '@gredice/storage';
import {
    getSunflowerDropSpawnChance,
    SUNFLOWER_DROP_BASE_SPAWN_CHANCE,
} from '../garden/sunflowerDropChance';
import {
    SUNFLOWER_DROP_MAX_CLOUD_COVER,
    SUNFLOWER_DROP_MAX_RAIN_MM,
} from '../garden/sunflowerDropWeather';

type GardenStack = {
    blocks: string[];
};

type GardenBlock = {
    id: string;
    name: string;
};

type BlockDirectoryEntry = {
    information: {
        fullDescription?: string;
        label: string;
        name: string;
        shortDescription?: string;
    };
    attributes?: {
        type?: string;
    };
    functions?: {
        raisedBed?: boolean;
        recycler?: boolean;
    };
};

type RaisedBedPlacement = {
    id: number;
    blockId: string | null;
};

type RaisedBedOperation = {
    raisedBedId: number | null;
};

function percent(value: number) {
    return Math.round(value * 10_000) / 100;
}

export function buildGardenCompositionContext({
    blockData,
    blocks,
    isSandbox,
    stacks,
}: {
    blockData: BlockDirectoryEntry[];
    blocks: GardenBlock[];
    isSandbox: boolean;
    stacks: GardenStack[];
}) {
    const blocksById = new Map(blocks.map((block) => [block.id, block]));
    const blockDataByName = new Map(
        blockData.map((block) => [block.information.name, block]),
    );
    const countsByName = new Map<string, number>();
    let unresolvedPlacedBlockCount = 0;

    for (const blockId of stacks.flatMap((stack) => stack.blocks)) {
        const block = blocksById.get(blockId);
        if (!block) {
            unresolvedPlacedBlockCount += 1;
            continue;
        }

        countsByName.set(block.name, (countsByName.get(block.name) ?? 0) + 1);
    }

    const items = [...countsByName.entries()]
        .map(([name, count]) => {
            const directoryEntry = blockDataByName.get(name);
            return {
                name,
                label: directoryEntry?.information.label ?? name,
                type: directoryEntry?.attributes?.type ?? 'unknown',
                count,
                shortDescription:
                    directoryEntry?.information.shortDescription || null,
                fullDescription:
                    directoryEntry?.information.fullDescription || null,
                functions: {
                    raisedBed: directoryEntry?.functions?.raisedBed ?? false,
                    recycler: directoryEntry?.functions?.recycler ?? false,
                },
            };
        })
        .sort(
            (left, right) =>
                right.count - left.count ||
                left.label.localeCompare(right.label, 'hr'),
        );

    const sunflowerCount = countsByName.get(SUNFLOWER_DROP_BLOCK_NAME) ?? 0;
    const chancePerEligibleVisit = getSunflowerDropSpawnChance(sunflowerCount);

    return {
        placedBlockCount: items.reduce((sum, item) => sum + item.count, 0),
        distinctBlockTypeCount: items.length,
        unresolvedPlacedBlockCount,
        items,
        specialRewards: {
            sunflowerDrop: {
                placedSunflowerCount: sunflowerCount,
                eligibleByGardenTypeAndContents:
                    !isSandbox && sunflowerCount > 0,
                baseChancePerSunflower: SUNFLOWER_DROP_BASE_SPAWN_CHANCE,
                chancePerEligibleVisit,
                chancePercentPerEligibleVisit: percent(chancePerEligibleVisit),
                chanceFormula:
                    '1 - (1 - baseChancePerSunflower) ^ placedSunflowerCount',
                rewardAmount: SUNFLOWER_DROP_REWARD_AMOUNT,
                dailyLimit: SUNFLOWER_DROP_DAILY_LIMIT,
                dailyLimitScope: 'account',
                requirements: {
                    realGardenRequired: true,
                    sunnyWeatherRequired: true,
                    maximumRainMillimeters: SUNFLOWER_DROP_MAX_RAIN_MM,
                    maximumCloudCover: SUNFLOWER_DROP_MAX_CLOUD_COVER,
                    fogRainSnowAndThunderMustBeAbsent: true,
                    currentWeatherMustBeCheckedSeparately: true,
                },
            },
        },
    };
}

export function visibleRaisedBedsForGarden<
    RaisedBed extends RaisedBedPlacement,
>({ raisedBeds, stacks }: { raisedBeds: RaisedBed[]; stacks: GardenStack[] }) {
    const visibleBlockIds = new Set(stacks.flatMap((stack) => stack.blocks));

    return raisedBeds.filter(
        (raisedBed) =>
            raisedBed.blockId !== null &&
            visibleBlockIds.has(raisedBed.blockId),
    );
}

export function visibleOperationsForGarden<
    RaisedBed extends RaisedBedPlacement,
    Operation extends RaisedBedOperation,
>(
    garden: { raisedBeds: RaisedBed[]; stacks: GardenStack[] },
    operations: Operation[],
) {
    const visibleRaisedBedIds = new Set(
        visibleRaisedBedsForGarden(garden).map((raisedBed) => raisedBed.id),
    );

    return operations.filter(
        (operation) =>
            operation.raisedBedId === null ||
            visibleRaisedBedIds.has(operation.raisedBedId),
    );
}
