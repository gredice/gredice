export const staticOpaqueSceneCacheMaximumBytes = 160 * 1024 * 1024;
export const staticOpaqueSceneCacheRequiredStableFrames = 1;
// RGBA8 cloud-response endpoint plus resolved RGBA8/D24 cache attachments.
const staticOpaqueSceneCacheResolvedBytesPerPixel = 12;
const staticOpaqueSceneCacheMultisampleBytesPerPixel = 8;

type StaticOpaqueSceneCacheMaterialCandidate = {
    alphaToCoverage: boolean;
    colorWrite: boolean;
    depthTest: boolean;
    depthWrite: boolean;
    opacity: number;
    stencilWrite: boolean;
    transmission?: number;
    transparent: boolean;
};

export function isStaticOpaqueSceneCacheMaterialEligible(
    material: StaticOpaqueSceneCacheMaterialCandidate,
) {
    return (
        !material.transparent &&
        material.opacity >= 1 &&
        material.colorWrite &&
        material.depthTest &&
        material.depthWrite &&
        !material.stencilWrite &&
        !material.alphaToCoverage &&
        (typeof material.transmission !== 'number' ||
            material.transmission <= 0)
    );
}

export type StaticOpaqueSceneCacheState =
    | 'bypass'
    | 'capturing'
    | 'cold'
    | 'disabled'
    | 'ready'
    | 'unsupported';

export type StaticOpaqueSceneCacheReason =
    | 'boundary-change'
    | 'camera-change'
    | 'disabled'
    | 'empty'
    | 'interaction'
    | 'lighting-change'
    | 'ready'
    | 'shadow-update'
    | 'target-budget'
    | 'target-resize'
    | 'unsupported'
    | 'weather'
    | 'wireframe';

export type StaticOpaqueSceneCacheAction =
    | 'capture'
    | 'hit'
    | 'live'
    | 'unsupported';

export type StaticOpaqueSceneCacheRuntime = {
    cacheValid: boolean;
    lastSignature: string | null;
    stableFrameCount: number;
};

export type StaticOpaqueSceneCacheTransitionInput = {
    bypassReason?: StaticOpaqueSceneCacheReason;
    enabled: boolean;
    signature: string;
    signatureChangeReason: StaticOpaqueSceneCacheReason;
    supported: boolean;
};

export type StaticOpaqueSceneCacheTransition = {
    action: StaticOpaqueSceneCacheAction;
    invalidated: boolean;
    reason: StaticOpaqueSceneCacheReason;
    runtime: StaticOpaqueSceneCacheRuntime;
    state: StaticOpaqueSceneCacheState;
};

export function createStaticOpaqueSceneCacheRuntime(): StaticOpaqueSceneCacheRuntime {
    return {
        cacheValid: false,
        lastSignature: null,
        stableFrameCount: 0,
    };
}

export function estimateStaticOpaqueSceneCacheBytes(
    width: number,
    height: number,
    sampleCount = 4,
) {
    const safeWidth = Number.isFinite(width)
        ? Math.max(0, Math.floor(width))
        : 0;
    const safeHeight = Number.isFinite(height)
        ? Math.max(0, Math.floor(height))
        : 0;
    const safeSampleCount = Number.isFinite(sampleCount)
        ? Math.max(0, Math.floor(sampleCount))
        : 0;

    return (
        safeWidth *
        safeHeight *
        (staticOpaqueSceneCacheResolvedBytesPerPixel +
            safeSampleCount * staticOpaqueSceneCacheMultisampleBytesPerPixel)
    );
}

export function resolveStaticOpaqueSceneCacheTarget({
    additionalBytes = 0,
    height,
    maximumBytes = staticOpaqueSceneCacheMaximumBytes,
    sampleCount = 4,
    width,
}: {
    additionalBytes?: number;
    height: number;
    maximumBytes?: number;
    sampleCount?: number;
    width: number;
}) {
    const safeAdditionalBytes = Number.isFinite(additionalBytes)
        ? Math.max(0, Math.floor(additionalBytes))
        : 0;
    const estimatedBytes =
        estimateStaticOpaqueSceneCacheBytes(width, height, sampleCount) +
        safeAdditionalBytes;
    const validSize =
        Number.isFinite(width) &&
        Number.isFinite(height) &&
        width > 0 &&
        height > 0;
    const withinBudget =
        validSize &&
        Number.isFinite(maximumBytes) &&
        maximumBytes > 0 &&
        estimatedBytes <= maximumBytes;

    return {
        estimatedBytes,
        height: validSize ? Math.floor(height) : 0,
        reason: validSize
            ? withinBudget
                ? ('ready' as const)
                : ('target-budget' as const)
            : ('unsupported' as const),
        supported: withinBudget,
        width: validSize ? Math.floor(width) : 0,
    };
}

export function transitionStaticOpaqueSceneCache(
    runtime: StaticOpaqueSceneCacheRuntime,
    input: StaticOpaqueSceneCacheTransitionInput,
): StaticOpaqueSceneCacheTransition {
    if (!input.enabled) {
        return {
            action: 'live',
            invalidated: runtime.cacheValid,
            reason: 'disabled',
            runtime: createStaticOpaqueSceneCacheRuntime(),
            state: 'disabled',
        };
    }

    if (!input.supported) {
        return {
            action: 'unsupported',
            invalidated: runtime.cacheValid,
            reason: input.bypassReason ?? 'unsupported',
            runtime: createStaticOpaqueSceneCacheRuntime(),
            state: 'unsupported',
        };
    }

    if (input.bypassReason) {
        return {
            action: 'live',
            invalidated: runtime.cacheValid,
            reason: input.bypassReason,
            runtime: {
                cacheValid: false,
                lastSignature: input.signature,
                stableFrameCount:
                    input.bypassReason === 'shadow-update' ? 1 : 0,
            },
            state: 'bypass',
        };
    }

    if (runtime.lastSignature !== input.signature) {
        return {
            action: 'live',
            invalidated: runtime.cacheValid || runtime.lastSignature !== null,
            reason: input.signatureChangeReason,
            runtime: {
                cacheValid: false,
                lastSignature: input.signature,
                stableFrameCount: 0,
            },
            state: 'cold',
        };
    }

    if (!runtime.cacheValid) {
        if (
            runtime.stableFrameCount <
            staticOpaqueSceneCacheRequiredStableFrames
        ) {
            return {
                action: 'live',
                invalidated: false,
                reason: input.signatureChangeReason,
                runtime: {
                    ...runtime,
                    stableFrameCount: runtime.stableFrameCount + 1,
                },
                state: 'cold',
            };
        }

        return {
            action: 'capture',
            invalidated: false,
            reason: 'ready',
            runtime: {
                ...runtime,
                cacheValid: true,
            },
            state: 'capturing',
        };
    }

    return {
        action: 'hit',
        invalidated: false,
        reason: 'ready',
        runtime,
        state: 'ready',
    };
}
