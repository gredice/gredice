import type { BlockData } from '@gredice/client';
import {
    type GardenBlockExpansionIneligibleReason,
    type GardenBlockExpansionPlan,
    getGardenBlockExpansionClientMaxSide,
    getGardenBlockExpansionEligibility,
    getGardenBlockExpansionSource,
    planGardenBlockExpansion,
} from '@gredice/js/gardenBlockExpansion';
import {
    createGardenBlockPlacementValidator,
    type GardenBlockPlacementValidator,
    normalizeGardenBlockRotation,
} from '@gredice/js/gardenBlocks';
import { instancedBlockNames } from '../../entities/EntityInstances';
import {
    createBlockDataByName,
    createBlockNameById,
    createBlockRotationById,
    createPlacementStacks,
} from '../../hooks/optimisticBlockPlacement';
import { isInternalSceneBlockData } from '../../internalSceneBlockData';
import type { GardenStack } from '../../types/Stack';
import type {
    BlockExpandEditingState,
    BlockExpandStartInput,
} from '../blockEditingState';
import {
    findBlockEditingTarget,
    isUnsavedBlockId,
} from '../blockEditingTarget';

/** The part of the garden cache Expand plans against. */
export type ExpansionGarden = {
    stacks: GardenStack[];
};

const instancedBlockNameSet: ReadonlySet<string> = new Set(instancedBlockNames);

/**
 * Corner clamp per side for Expand (OPEN-1): instanced block types add one
 * instance per copy and get 10; every other type mounts a full entity per
 * copy and gets 5.
 */
export function getBlockExpansionMaxSide(blockName: string) {
    return getGardenBlockExpansionClientMaxSide({
        instanced: instancedBlockNameSet.has(blockName),
    });
}

/** One placement validator for `blockName` over the garden's stacks. */
export function createBlockExpansionValidator({
    blockData,
    blockName,
    garden,
}: {
    blockData: BlockData[];
    blockName: string;
    garden: ExpansionGarden;
}): GardenBlockPlacementValidator {
    return createGardenBlockPlacementValidator({
        blockName,
        stacks: createPlacementStacks(garden.stacks),
        blockNameById: createBlockNameById(garden.stacks),
        blockRotationById: createBlockRotationById(garden.stacks),
        blockDataByName: createBlockDataByName(blockData),
    });
}

export type BlockExpandStartUnavailableReason =
    | GardenBlockExpansionIneligibleReason
    | 'missing-block'
    | 'missing-data'
    | 'internal-block'
    | 'unsaved-block'
    | 'missing-source';

export type BlockExpandStartResult =
    | { ok: true; start: BlockExpandStartInput }
    | { ok: false; reason: BlockExpandStartUnavailableReason };

/**
 * What `startBlockExpand` needs for a placed block, read from the live
 * garden: its quarter-turn rotation, its cell, the surface it stands on
 * (from the same validator the planner uses, so collapsed water and
 * zero-height blocks agree) and the client corner clamp.
 */
export function resolveBlockExpandStart({
    blockData,
    blockId,
    garden,
}: {
    blockData: BlockData[] | null | undefined;
    blockId: string;
    garden: ExpansionGarden | null | undefined;
}): BlockExpandStartResult {
    const target = findBlockEditingTarget(garden, blockId);
    if (!garden || !target) {
        return { ok: false, reason: 'missing-block' };
    }
    if (!blockData) {
        return { ok: false, reason: 'missing-data' };
    }
    if (isUnsavedBlockId(blockId)) {
        return { ok: false, reason: 'unsaved-block' };
    }

    const { block, stack } = target;
    const data = blockData.find(
        (candidate) => candidate.information.name === block.name,
    );
    if (data && isInternalSceneBlockData(data)) {
        return { ok: false, reason: 'internal-block' };
    }

    const eligibility = getGardenBlockExpansionEligibility({
        blockName: block.name,
        blockData: data,
        rotation: block.rotation,
    });
    if (!eligibility.eligible) {
        return { ok: false, reason: eligibility.reason };
    }

    const validator = createBlockExpansionValidator({
        blockData,
        blockName: block.name,
        garden,
    });
    const source = getGardenBlockExpansionSource({
        validator,
        position: { x: stack.position.x, y: stack.position.z },
        blockId,
    });
    if (!source) {
        return { ok: false, reason: 'missing-source' };
    }

    return {
        ok: true,
        start: {
            rotation: normalizeGardenBlockRotation(block.rotation),
            source: { x: stack.position.x, z: stack.position.z },
            sourceBaseHeight: source.baseHeight,
            maxSide: getBlockExpansionMaxSide(block.name),
        },
    };
}

/** Plans the Expand rectangle of the editing state against a validator. */
export function planBlockExpansion({
    editing,
    validator,
}: {
    editing: BlockExpandEditingState;
    validator: GardenBlockPlacementValidator;
}): GardenBlockExpansionPlan {
    return planGardenBlockExpansion({
        blockName: editing.blockName,
        rotation: editing.rotation,
        source: { x: editing.source.x, y: editing.source.z },
        sourceBlockId: editing.blockId,
        corner: { x: editing.corner.x, y: editing.corner.z },
        validator,
        isPendingBlockId: isUnsavedBlockId,
        maxSide: editing.maxSide,
    });
}

/**
 * Plans the Expand rectangle against a garden snapshot, for example the
 * latest query cache right before a batch is sent. Null until the garden and
 * block data are loaded.
 */
export function planBlockExpansionForGarden({
    blockData,
    editing,
    garden,
}: {
    blockData: BlockData[] | null | undefined;
    editing: BlockExpandEditingState;
    garden: ExpansionGarden | null | undefined;
}): GardenBlockExpansionPlan | null {
    if (!garden || !blockData) {
        return null;
    }

    return planBlockExpansion({
        editing,
        validator: createBlockExpansionValidator({
            blockData,
            blockName: editing.blockName,
            garden,
        }),
    });
}
