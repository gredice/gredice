'use client';

import type { BlockData } from '@gredice/client';
import type { GardenBlockExpansionPlan } from '@gredice/js/gardenBlockExpansion';
import type { GardenBlockPlacementValidator } from '@gredice/js/gardenBlocks';
import { useMemo } from 'react';
import { useBlockData } from '../../hooks/useBlockData';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useGameState } from '../../useGameState';
import type { BlockExpandEditingState } from '../blockEditingState';
import {
    createBlockExpansionValidator,
    type ExpansionGarden,
    planBlockExpansion,
} from './expansionPlanInput';

// Single-entry caches shared by every caller (the scene preview and the HUD
// bar live in different React trees). The validator is built once per
// garden cache object, block data and block name; the plan once per corner
// cell.
let validatorCache: {
    blockData: BlockData[];
    blockName: string;
    garden: ExpansionGarden;
    validator: GardenBlockPlacementValidator;
} | null = null;
let planCache: {
    key: string;
    plan: GardenBlockExpansionPlan;
    validator: GardenBlockPlacementValidator;
} | null = null;

/**
 * Drops the cached validator and plan, which hold a garden snapshot. Called
 * when Expand ends; the next Expand builds them again.
 */
export function clearBlockExpansionPlanCache() {
    validatorCache = null;
    planCache = null;
}

function getCachedValidator(
    garden: ExpansionGarden,
    blockData: BlockData[],
    blockName: string,
) {
    if (
        validatorCache?.garden === garden &&
        validatorCache.blockData === blockData &&
        validatorCache.blockName === blockName
    ) {
        return validatorCache.validator;
    }

    const validator = createBlockExpansionValidator({
        blockData,
        blockName,
        garden,
    });
    validatorCache = { blockData, blockName, garden, validator };
    return validator;
}

function getPlanKey(editing: BlockExpandEditingState) {
    return [
        editing.blockId,
        editing.blockName,
        editing.rotation,
        editing.source.x,
        editing.source.z,
        editing.corner.x,
        editing.corner.z,
        editing.maxSide,
    ].join('|');
}

function getCachedPlan(
    editing: BlockExpandEditingState,
    validator: GardenBlockPlacementValidator,
) {
    const key = getPlanKey(editing);
    if (planCache?.validator === validator && planCache.key === key) {
        return planCache.plan;
    }

    const plan = planBlockExpansion({ editing, validator });
    planCache = { key, plan, validator };
    return plan;
}

/**
 * The live Expand plan for the current garden cache, or null when Expand is
 * not active or the garden or block data are not loaded. It changes only
 * when the corner cell, the garden cache or the block data change.
 */
export function useBlockExpansionPlan(): {
    editing: BlockExpandEditingState;
    plan: GardenBlockExpansionPlan;
} | null {
    const editing = useGameState((state) =>
        state.blockEditing?.mode === 'expand' ? state.blockEditing : null,
    );
    const { data: garden } = useCurrentGarden();
    const { data: blockData } = useBlockData();

    return useMemo(() => {
        if (!editing || !garden || !blockData) {
            return null;
        }

        const validator = getCachedValidator(
            garden,
            blockData,
            editing.blockName,
        );
        return { editing, plan: getCachedPlan(editing, validator) };
    }, [blockData, editing, garden]);
}
