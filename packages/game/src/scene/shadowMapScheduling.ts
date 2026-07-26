import type { Stack } from '../types/Stack';

type ShadowLightPosition = {
    x: number;
    y: number;
    z: number;
};

type ShadowMapRefreshTarget = {
    enabled: boolean;
    needsUpdate: boolean;
};

export function requestPrimaryShadowMapRefresh(
    shadowMap: ShadowMapRefreshTarget,
    enabled: boolean,
    refreshCount: number,
) {
    if (!enabled) {
        return refreshCount;
    }

    shadowMap.enabled = true;
    shadowMap.needsUpdate = true;
    return refreshCount + 1;
}

function formatShadowSignatureValue(value: number) {
    return Number.isFinite(value) ? value.toFixed(4) : '0';
}

export function buildGardenShadowGeometrySignature(
    stacks: Stack[] | undefined,
) {
    return (stacks ?? [])
        .map((stack) => {
            const blocks = stack.blocks
                .map(
                    (block) =>
                        `${block.name}:${block.rotation}:${block.variant ?? ''}`,
                )
                .join(',');

            return `${formatShadowSignatureValue(stack.position.x)},${formatShadowSignatureValue(stack.position.y)},${formatShadowSignatureValue(stack.position.z)}:${blocks}`;
        })
        .sort()
        .join('|');
}

export function buildDirectionalShadowDepthSignature({
    lightPosition,
    shadowCameraSize,
    shadowMapSize,
    shadows,
}: {
    lightPosition: ShadowLightPosition;
    shadowCameraSize: number;
    shadowMapSize: number;
    shadows: boolean;
}) {
    return [
        shadows ? 'shadows' : 'no-shadows',
        shadowMapSize,
        formatShadowSignatureValue(shadowCameraSize),
        formatShadowSignatureValue(lightPosition.x),
        formatShadowSignatureValue(lightPosition.y),
        formatShadowSignatureValue(lightPosition.z),
    ].join('|');
}

export type DeferredShadowRefreshState = {
    activePlacementCount: number;
    dirty: boolean;
    placementCyclePending: boolean;
};

export type DeferredShadowRefreshTransition = {
    deferredChangeCountDelta: number;
    shouldInvalidate: boolean;
    state: DeferredShadowRefreshState;
};

function normalizeActivePlacementCount(activePlacementCount: number) {
    return Number.isFinite(activePlacementCount)
        ? Math.max(0, Math.floor(activePlacementCount))
        : 0;
}

export function createDeferredShadowRefreshState(
    activePlacementCount = 0,
): DeferredShadowRefreshState {
    const normalizedActivePlacementCount =
        normalizeActivePlacementCount(activePlacementCount);
    const placementActive = normalizedActivePlacementCount > 0;

    return {
        activePlacementCount: normalizedActivePlacementCount,
        dirty: placementActive,
        placementCyclePending: placementActive,
    };
}

export function transitionDeferredShadowRefresh(
    state: DeferredShadowRefreshState,
    {
        activePlacementCount,
        forceDirty = false,
        geometryChanged = false,
    }: {
        activePlacementCount: number;
        forceDirty?: boolean;
        geometryChanged?: boolean;
    },
): DeferredShadowRefreshTransition {
    const nextActivePlacementCount =
        normalizeActivePlacementCount(activePlacementCount);
    const placementStarted =
        state.activePlacementCount === 0 && nextActivePlacementCount > 0;
    const placementCompleted =
        state.activePlacementCount > 0 && nextActivePlacementCount === 0;
    const dirtyEvent = forceDirty || geometryChanged || placementStarted;
    const dirty = state.dirty || dirtyEvent;

    return {
        deferredChangeCountDelta:
            nextActivePlacementCount > 0 && dirtyEvent ? 1 : 0,
        shouldInvalidate:
            nextActivePlacementCount === 0 &&
            dirty &&
            (dirtyEvent || placementCompleted),
        state: {
            activePlacementCount: nextActivePlacementCount,
            dirty,
            placementCyclePending:
                state.placementCyclePending || placementStarted,
        },
    };
}

export function consumeDeferredShadowRefresh(
    state: DeferredShadowRefreshState,
) {
    if (state.activePlacementCount > 0 || !state.dirty) {
        return {
            placementFlush: false,
            shouldRefresh: false,
            state,
        };
    }

    return {
        placementFlush: state.placementCyclePending,
        shouldRefresh: true,
        state: {
            ...state,
            dirty: false,
            placementCyclePending: false,
        },
    };
}
