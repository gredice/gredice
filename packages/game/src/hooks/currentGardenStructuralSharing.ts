import type { Block } from '../types/Block';
import type { GardenStack } from '../types/Stack';
import type { CurrentGarden } from './useCurrentGarden';

function blockVariantsEqual(left: Block, right: Block) {
    return (left.variant ?? null) === (right.variant ?? null);
}

function blockMessagesEqual(left: Block, right: Block) {
    return (left.message ?? null) === (right.message ?? null);
}

function blocksEqual(left: Block, right: Block) {
    return (
        left === right ||
        (left.id === right.id &&
            left.name === right.name &&
            left.rotation === right.rotation &&
            blockVariantsEqual(left, right) &&
            blockMessagesEqual(left, right))
    );
}

function stackPositionsEqual(left: GardenStack, right: GardenStack) {
    return (
        left.position === right.position ||
        (left.position.x === right.position.x &&
            left.position.y === right.position.y &&
            left.position.z === right.position.z)
    );
}

function stackKey(stack: GardenStack) {
    return `${stack.position.x}|${stack.position.y}|${stack.position.z}`;
}

function shareBlocks(previousBlocks: Block[], nextBlocks: Block[]) {
    if (previousBlocks === nextBlocks) {
        return previousBlocks;
    }

    let changed = previousBlocks.length !== nextBlocks.length;
    const blocks = nextBlocks.map((nextBlock, index) => {
        const previousBlock = previousBlocks[index];
        if (previousBlock && blocksEqual(previousBlock, nextBlock)) {
            return previousBlock;
        }

        changed = true;
        return nextBlock;
    });

    return changed ? blocks : previousBlocks;
}

function shareStack(
    previousStack: GardenStack | undefined,
    nextStack: GardenStack,
) {
    if (!previousStack || !stackPositionsEqual(previousStack, nextStack)) {
        return nextStack;
    }

    const blocks = shareBlocks(previousStack.blocks, nextStack.blocks);
    if (blocks === previousStack.blocks) {
        return previousStack;
    }

    return {
        ...nextStack,
        position: previousStack.position,
        blocks,
    };
}

function shareStacks(previousStacks: GardenStack[], nextStacks: GardenStack[]) {
    if (previousStacks === nextStacks) {
        return previousStacks;
    }

    const previousStackByKey = new Map(
        previousStacks.map((stack) => [stackKey(stack), stack]),
    );
    let changed = previousStacks.length !== nextStacks.length;
    const stacks = nextStacks.map((nextStack, index) => {
        const sharedStack = shareStack(
            previousStackByKey.get(stackKey(nextStack)),
            nextStack,
        );
        if (sharedStack !== previousStacks[index]) {
            changed = true;
        }
        return sharedStack;
    });

    return changed ? stacks : previousStacks;
}

function shareStructures(
    previousStructures: CurrentGarden['structures'],
    nextStructures: CurrentGarden['structures'],
) {
    if (previousStructures === nextStructures) {
        return previousStructures;
    }

    const previousById = new Map(
        previousStructures.map((structure) => [structure.id, structure]),
    );
    let changed = previousStructures.length !== nextStructures.length;
    const structures = nextStructures.map((nextStructure, index) => {
        const previousStructure = previousById.get(nextStructure.id);
        const sharedStructure =
            previousStructure?.revision === nextStructure.revision
                ? previousStructure
                : nextStructure;
        if (sharedStructure !== previousStructures[index]) {
            changed = true;
        }
        return sharedStructure;
    });

    return changed ? structures : previousStructures;
}

function jsonValuesEqual(left: unknown, right: unknown): boolean {
    if (left === right) {
        return true;
    }

    if (Array.isArray(left) && Array.isArray(right)) {
        return (
            left.length === right.length &&
            left.every((leftValue, index) =>
                jsonValuesEqual(leftValue, right[index]),
            )
        );
    }

    if (
        !left ||
        !right ||
        typeof left !== 'object' ||
        typeof right !== 'object'
    ) {
        return false;
    }

    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    return (
        leftKeys.length === rightKeys.length &&
        leftKeys.every(
            (key) =>
                Object.hasOwn(rightRecord, key) &&
                jsonValuesEqual(leftRecord[key], rightRecord[key]),
        )
    );
}

function shareJsonValue<T>(previousValue: T, nextValue: T) {
    return jsonValuesEqual(previousValue, nextValue)
        ? previousValue
        : nextValue;
}

function shareLocation(
    previousLocation: CurrentGarden['location'],
    nextLocation: CurrentGarden['location'],
) {
    return previousLocation.lat === nextLocation.lat &&
        previousLocation.lon === nextLocation.lon
        ? previousLocation
        : nextLocation;
}

export function shareCurrentGardenData(
    previousGarden: CurrentGarden | null | undefined,
    nextGarden: CurrentGarden | null,
) {
    if (!previousGarden || !nextGarden) {
        return nextGarden;
    }

    if (
        previousGarden.id !== nextGarden.id ||
        previousGarden.name !== nextGarden.name ||
        previousGarden.isSandbox !== nextGarden.isSandbox ||
        previousGarden.isPublic !== nextGarden.isPublic ||
        previousGarden.backgroundPalette !== nextGarden.backgroundPalette ||
        previousGarden.farmId !== nextGarden.farmId ||
        previousGarden.gardenBuildingSystem?.enabled !==
            nextGarden.gardenBuildingSystem?.enabled ||
        previousGarden.previewSourceRevision !==
            nextGarden.previewSourceRevision
    ) {
        return nextGarden;
    }

    const homeCamera = shareJsonValue(
        previousGarden.homeCamera,
        nextGarden.homeCamera,
    );
    const stacks = shareStacks(previousGarden.stacks, nextGarden.stacks);
    const structures = shareStructures(
        previousGarden.structures,
        nextGarden.structures,
    );
    const location = shareLocation(
        previousGarden.location,
        nextGarden.location,
    );
    const raisedBeds = shareJsonValue(
        previousGarden.raisedBeds,
        nextGarden.raisedBeds,
    );
    const previewImage = shareJsonValue(
        previousGarden.previewImage,
        nextGarden.previewImage,
    );
    const previewImages = shareJsonValue(
        previousGarden.previewImages,
        nextGarden.previewImages,
    );

    if (
        homeCamera === previousGarden.homeCamera &&
        stacks === previousGarden.stacks &&
        structures === previousGarden.structures &&
        location === previousGarden.location &&
        raisedBeds === previousGarden.raisedBeds &&
        previewImage === previousGarden.previewImage &&
        previewImages === previousGarden.previewImages
    ) {
        return previousGarden;
    }

    return {
        ...nextGarden,
        homeCamera,
        stacks,
        structures,
        location,
        raisedBeds,
        previewImage,
        previewImages,
    };
}

export function shareCurrentGardenQueryData(
    previousGarden: unknown,
    nextGarden: unknown,
) {
    if (nextGarden === null || isCurrentGarden(nextGarden)) {
        return shareCurrentGardenData(
            isCurrentGarden(previousGarden) ? previousGarden : null,
            nextGarden,
        );
    }

    return nextGarden;
}

function isCurrentGarden(value: unknown): value is CurrentGarden {
    return (
        Boolean(value) &&
        typeof value === 'object' &&
        Array.isArray((value as CurrentGarden).stacks) &&
        Array.isArray((value as CurrentGarden).raisedBeds)
    );
}
