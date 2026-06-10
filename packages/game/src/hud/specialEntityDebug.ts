import type { Stack } from '../types/Stack';

export const SUNFLOWER_SPECIAL_ENTITY_REWARD_AMOUNT = 1000;

export type SpecialEntityBlockData = {
    attributes?: {
        height?: number | null;
    };
    information: {
        label?: string | null;
        name: string;
    };
};

export type SpecialEntityDebugEntry = {
    blockId: string;
    blockName: string;
    id: string;
    kind: 'sunflower';
    label: string;
    position: {
        x: number;
        y: number;
        z: number;
    };
};

const explicitSunflowerEntityNames = new Set([
    'SpecialSunflower',
    'Special_Sunflower',
    'Sunflower',
    'SunflowerReward',
    'Sunflower_Reward',
]);

function matchesSunflowerEntityText(value: string | null | undefined) {
    const normalized = value?.toLowerCase();
    return (
        Boolean(normalized?.includes('sunflower')) ||
        Boolean(normalized?.includes('suncokret'))
    );
}

function isSunflowerSpecialEntity({
    blockData,
    blockName,
}: {
    blockData: SpecialEntityBlockData | undefined;
    blockName: string;
}) {
    return (
        explicitSunflowerEntityNames.has(blockName) ||
        matchesSunflowerEntityText(blockName) ||
        matchesSunflowerEntityText(blockData?.information.label)
    );
}

function resolveBlockDataByName(blockData: SpecialEntityBlockData[] | null) {
    const blockDataByName = new Map<string, SpecialEntityBlockData>();

    for (const block of blockData ?? []) {
        blockDataByName.set(block.information.name, block);
    }

    return blockDataByName;
}

function resolveBlockHeight(blockData: SpecialEntityBlockData | undefined) {
    const height = blockData?.attributes?.height;
    return typeof height === 'number' && Number.isFinite(height) ? height : 0;
}

function resolveSpecialEntityPositionY({
    blockDataByName,
    blockIndex,
    stack,
}: {
    blockDataByName: Map<string, SpecialEntityBlockData>;
    blockIndex: number;
    stack: Stack;
}) {
    let y = 0;

    for (let index = 0; index < blockIndex; index += 1) {
        const block = stack.blocks[index];
        if (!block) {
            continue;
        }
        y += resolveBlockHeight(blockDataByName.get(block.name));
    }

    const block = stack.blocks[blockIndex];
    const blockHeight = block
        ? resolveBlockHeight(blockDataByName.get(block.name))
        : 0;

    return y + Math.max(blockHeight, 0.8) / 2;
}

export function getSpecialEntityDebugEntries({
    blockData,
    stacks,
}: {
    blockData?: SpecialEntityBlockData[] | null;
    stacks: Stack[] | undefined;
}) {
    const blockDataByName = resolveBlockDataByName(blockData ?? null);
    const entries: SpecialEntityDebugEntry[] = [];

    for (const stack of stacks ?? []) {
        stack.blocks.forEach((block, blockIndex) => {
            const blockDataEntry = blockDataByName.get(block.name);
            if (
                !isSunflowerSpecialEntity({
                    blockData: blockDataEntry,
                    blockName: block.name,
                })
            ) {
                return;
            }

            entries.push({
                blockId: block.id,
                blockName: block.name,
                id: `sunflower:${block.id}`,
                kind: 'sunflower',
                label: blockDataEntry?.information.label ?? 'Sunflower',
                position: {
                    x: stack.position.x,
                    y: resolveSpecialEntityPositionY({
                        blockDataByName,
                        blockIndex,
                        stack,
                    }),
                    z: stack.position.z,
                },
            });
        });
    }

    return entries.sort((left, right) => {
        const labelComparison = left.label.localeCompare(right.label);
        return labelComparison || left.blockId.localeCompare(right.blockId);
    });
}
