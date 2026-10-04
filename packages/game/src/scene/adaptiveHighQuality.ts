export type AdaptiveHighQualityLevel = 'L0' | 'L1' | 'L2' | 'L3';
export type AdaptiveHighQualityLoadSource = 'frame' | 'gpu';
export type AdaptiveHighQualityTransitionDirection = 'decline' | 'recover';
export type AdaptiveHighQualityTransitionReason =
    | 'headroom'
    | 'interaction'
    | 'overload';

export type AdaptiveHighQualityLevelProfile = {
    ambientFramesPerSecond: number;
    cloudShadowUpdateMs: number;
    dpr: number;
    factor: number;
};

export const adaptiveHighQualityLevelOrder = [
    'L0',
    'L1',
    'L2',
    'L3',
] as const satisfies readonly AdaptiveHighQualityLevel[];

function normalizeEffectiveDprCeiling(effectiveDprCeiling: number) {
    if (!Number.isFinite(effectiveDprCeiling)) {
        return 2;
    }

    return Math.min(2, Math.max(1, effectiveDprCeiling));
}

function roundDpr(dpr: number) {
    return Math.round(dpr * 1_000) / 1_000;
}

export function resolveAdaptiveHighQualityLevels(
    effectiveDprCeiling = 2,
): Record<AdaptiveHighQualityLevel, AdaptiveHighQualityLevelProfile> {
    const ceiling = normalizeEffectiveDprCeiling(effectiveDprCeiling);
    const firstDeclineDpr = roundDpr(Math.max(1, ceiling - 0.25));
    const secondDeclineDpr = roundDpr(Math.max(1, ceiling * 0.75));

    return {
        L0: {
            ambientFramesPerSecond: 30,
            cloudShadowUpdateMs: 96,
            dpr: roundDpr(ceiling),
            factor: 1,
        },
        L1: {
            ambientFramesPerSecond: 30,
            cloudShadowUpdateMs: 96,
            dpr: firstDeclineDpr,
            factor: 0.875,
        },
        L2: {
            ambientFramesPerSecond: 30,
            cloudShadowUpdateMs: 96,
            dpr: secondDeclineDpr,
            factor: 0.75,
        },
        L3: {
            ambientFramesPerSecond: 20,
            cloudShadowUpdateMs: 160,
            dpr: secondDeclineDpr,
            factor: 0.7,
        },
    };
}

export const adaptiveHighQualityLevels = resolveAdaptiveHighQualityLevels();

function hasSameRuntimeCost(
    first: AdaptiveHighQualityLevelProfile,
    second: AdaptiveHighQualityLevelProfile,
) {
    return (
        first.ambientFramesPerSecond === second.ambientFramesPerSecond &&
        first.cloudShadowUpdateMs === second.cloudShadowUpdateMs &&
        first.dpr === second.dpr
    );
}

export function resolveAdaptiveHighQualityLevelOrder(effectiveDprCeiling = 2) {
    const levels = resolveAdaptiveHighQualityLevels(effectiveDprCeiling);
    const resolvedOrder: AdaptiveHighQualityLevel[] = [];

    for (const level of adaptiveHighQualityLevelOrder) {
        const previousLevel = resolvedOrder.at(-1);
        if (
            previousLevel === undefined ||
            !hasSameRuntimeCost(levels[previousLevel], levels[level])
        ) {
            resolvedOrder.push(level);
        }
    }

    return resolvedOrder;
}

export const adaptiveHighQualityPolicy = {
    declineCooldownMs: 1_250,
    ewmaTimeConstantMs: 1_000,
    headroomLoad: 0.8,
    headroomSustainMs: 5_000,
    overloadLoad: 1.1,
    overloadMinimumSamples: 3,
    overloadSustainMs: 750,
    recoveryLockMs: 30_000,
    reversalLockCount: 3,
    reversalWindowMs: 60_000,
} as const;

type AdaptiveHighQualityEvidence = {
    samples: number;
    sinceMs: number | null;
};

export type AdaptiveHighQualityTransition = {
    atMs: number;
    direction: AdaptiveHighQualityTransitionDirection;
    from: AdaptiveHighQualityLevel;
    reason: AdaptiveHighQualityTransitionReason;
    to: AdaptiveHighQualityLevel;
};

export type AdaptiveHighQualityState = {
    declineCount: number;
    dwellMsByLevel: Record<AdaptiveHighQualityLevel, number>;
    effectiveDprCeiling: number;
    headroomEvidence: AdaptiveHighQualityEvidence;
    interactionActive: boolean;
    ewmaSampleCount: number;
    lastDeclineAtMs: number | null;
    lastSampleAtMs: number;
    lastTransition: AdaptiveHighQualityTransition | null;
    lastTransitionDirection: AdaptiveHighQualityTransitionDirection | null;
    level: AdaptiveHighQualityLevel;
    levelEnteredAtMs: number;
    loadSampleCount: number;
    normalizedLoad: number | null;
    normalizedLoadEwma: number | null;
    oscillationCount: number;
    overloadEvidence: AdaptiveHighQualityEvidence;
    recentReversalAtMs: number[];
    recoveryCount: number;
    recoveryLockedUntilMs: number;
    source: AdaptiveHighQualityLoadSource | null;
    transitionCount: number;
};

export type AdaptiveHighQualitySample = {
    interactionActive: boolean;
    normalizedLoad: number;
    nowMs: number;
    source: AdaptiveHighQualityLoadSource;
};

export type AdaptiveHighQualityUpdate = {
    state: AdaptiveHighQualityState;
    transition: AdaptiveHighQualityTransition | null;
};

export type AdaptiveHighQualitySnapshot = {
    currentLevelDwellMs: number;
    declineCount: number;
    dwellMsByLevel: Record<AdaptiveHighQualityLevel, number>;
    ewmaSampleCount: number;
    level: AdaptiveHighQualityLevel;
    loadSampleCount: number;
    normalizedLoad: number | null;
    normalizedLoadEwma: number | null;
    oscillationCount: number;
    profile: AdaptiveHighQualityLevelProfile;
    recoveryCount: number;
    recoveryLocked: boolean;
    recoveryLockedUntilMs: number;
    source: AdaptiveHighQualityLoadSource | null;
    transitionCount: number;
};

const emptyEvidence = (): AdaptiveHighQualityEvidence => ({
    samples: 0,
    sinceMs: null,
});

const emptyDwellMsByLevel = (): Record<AdaptiveHighQualityLevel, number> => ({
    L0: 0,
    L1: 0,
    L2: 0,
    L3: 0,
});

function normalizeNowMs(nowMs: number, minimum = 0) {
    if (!Number.isFinite(nowMs)) {
        return minimum;
    }

    return Math.max(minimum, nowMs);
}

export function createAdaptiveHighQualityState({
    effectiveDprCeiling = 2,
    level = 'L0',
    nowMs = 0,
    source = null,
}: {
    effectiveDprCeiling?: number;
    level?: AdaptiveHighQualityLevel;
    nowMs?: number;
    source?: AdaptiveHighQualityLoadSource | null;
} = {}): AdaptiveHighQualityState {
    const normalizedDprCeiling =
        normalizeEffectiveDprCeiling(effectiveDprCeiling);
    const normalizedNowMs = normalizeNowMs(nowMs);

    return {
        declineCount: 0,
        dwellMsByLevel: emptyDwellMsByLevel(),
        effectiveDprCeiling: normalizedDprCeiling,
        ewmaSampleCount: 0,
        headroomEvidence: emptyEvidence(),
        interactionActive: false,
        lastDeclineAtMs: null,
        lastSampleAtMs: normalizedNowMs,
        lastTransition: null,
        lastTransitionDirection: null,
        level: canonicalLevel(level, normalizedDprCeiling),
        levelEnteredAtMs: normalizedNowMs,
        loadSampleCount: 0,
        normalizedLoad: null,
        normalizedLoadEwma: null,
        oscillationCount: 0,
        overloadEvidence: emptyEvidence(),
        recentReversalAtMs: [],
        recoveryCount: 0,
        recoveryLockedUntilMs: 0,
        source,
        transitionCount: 0,
    };
}

export function resumeAdaptiveHighQualityState(
    currentState: AdaptiveHighQualityState,
    nowMs: number,
): AdaptiveHighQualityState {
    const normalizedNowMs = normalizeNowMs(nowMs, currentState.lastSampleAtMs);
    const currentLevelDwellMs = Math.max(
        0,
        currentState.lastSampleAtMs - currentState.levelEnteredAtMs,
    );

    return {
        ...currentState,
        ewmaSampleCount: 0,
        headroomEvidence: emptyEvidence(),
        interactionActive: false,
        lastSampleAtMs: normalizedNowMs,
        lastTransition: null,
        levelEnteredAtMs: normalizedNowMs - currentLevelDwellMs,
        normalizedLoad: null,
        normalizedLoadEwma: null,
        overloadEvidence: emptyEvidence(),
        source: null,
    };
}

function accrueDwell(
    state: AdaptiveHighQualityState,
    nowMs: number,
): AdaptiveHighQualityState {
    const elapsedMs = nowMs - state.lastSampleAtMs;
    if (elapsedMs === 0) {
        return state;
    }

    return {
        ...state,
        dwellMsByLevel: {
            ...state.dwellMsByLevel,
            [state.level]: state.dwellMsByLevel[state.level] + elapsedMs,
        },
        lastSampleAtMs: nowMs,
    };
}

function updateEvidence(
    evidence: AdaptiveHighQualityEvidence,
    condition: boolean,
    nowMs: number,
): AdaptiveHighQualityEvidence {
    if (!condition) {
        return emptyEvidence();
    }

    return {
        samples: evidence.samples + 1,
        sinceMs: evidence.sinceMs ?? nowMs,
    };
}

function evidenceDurationMs(
    evidence: AdaptiveHighQualityEvidence,
    nowMs: number,
) {
    return evidence.sinceMs === null ? 0 : nowMs - evidence.sinceMs;
}

function canonicalLevel(
    requestedLevel: AdaptiveHighQualityLevel,
    effectiveDprCeiling: number,
) {
    const levels = resolveAdaptiveHighQualityLevels(effectiveDprCeiling);
    const requestedIndex =
        adaptiveHighQualityLevelOrder.indexOf(requestedLevel);
    let canonicalIndex = requestedIndex;
    while (canonicalIndex > 0) {
        const currentLevel = adaptiveHighQualityLevelOrder[canonicalIndex];
        const previousLevel = adaptiveHighQualityLevelOrder[canonicalIndex - 1];
        if (
            currentLevel === undefined ||
            previousLevel === undefined ||
            !hasSameRuntimeCost(levels[currentLevel], levels[previousLevel])
        ) {
            break;
        }
        canonicalIndex -= 1;
    }

    return adaptiveHighQualityLevelOrder[canonicalIndex] ?? requestedLevel;
}

function adjacentLevel(
    state: AdaptiveHighQualityState,
    direction: AdaptiveHighQualityTransitionDirection,
) {
    const resolvedOrder = resolveAdaptiveHighQualityLevelOrder(
        state.effectiveDprCeiling,
    );
    const levelIndex = resolvedOrder.indexOf(state.level);
    const nextIndex = direction === 'decline' ? levelIndex + 1 : levelIndex - 1;
    return resolvedOrder[nextIndex] ?? null;
}

function transitionLevel(
    state: AdaptiveHighQualityState,
    to: AdaptiveHighQualityLevel,
    reason: AdaptiveHighQualityTransitionReason,
    nowMs: number,
): AdaptiveHighQualityUpdate {
    const fromIndex = adaptiveHighQualityLevelOrder.indexOf(state.level);
    const toIndex = adaptiveHighQualityLevelOrder.indexOf(to);
    const direction =
        toIndex > fromIndex ? ('decline' as const) : ('recover' as const);
    const transition = {
        atMs: nowMs,
        direction,
        from: state.level,
        reason,
        to,
    } satisfies AdaptiveHighQualityTransition;
    const reversal =
        state.lastTransitionDirection !== null &&
        state.lastTransitionDirection !== direction;
    const reversalWindowStartMs =
        nowMs - adaptiveHighQualityPolicy.reversalWindowMs;
    const recentReversalAtMs = state.recentReversalAtMs.filter(
        (reversalAtMs) => reversalAtMs >= reversalWindowStartMs,
    );
    const previousReversalCount = recentReversalAtMs.length;
    if (reversal) {
        recentReversalAtMs.push(nowMs);
    }
    const recoveryLockedUntilMs =
        reversal &&
        previousReversalCount < adaptiveHighQualityPolicy.reversalLockCount &&
        recentReversalAtMs.length >= adaptiveHighQualityPolicy.reversalLockCount
            ? Math.max(
                  state.recoveryLockedUntilMs,
                  nowMs + adaptiveHighQualityPolicy.recoveryLockMs,
              )
            : state.recoveryLockedUntilMs;

    return {
        state: {
            ...state,
            declineCount:
                state.declineCount + (direction === 'decline' ? 1 : 0),
            ewmaSampleCount: 0,
            headroomEvidence: emptyEvidence(),
            lastDeclineAtMs:
                direction === 'decline' ? nowMs : state.lastDeclineAtMs,
            lastTransition: transition,
            lastTransitionDirection: direction,
            level: to,
            levelEnteredAtMs: nowMs,
            normalizedLoadEwma: null,
            oscillationCount: state.oscillationCount + (reversal ? 1 : 0),
            overloadEvidence: emptyEvidence(),
            recentReversalAtMs,
            recoveryCount:
                state.recoveryCount + (direction === 'recover' ? 1 : 0),
            recoveryLockedUntilMs,
            transitionCount: state.transitionCount + 1,
        },
        transition,
    };
}

function updateNormalizedLoadEwma({
    elapsedMs,
    normalizedLoad,
    previousEwma,
}: {
    elapsedMs: number;
    normalizedLoad: number;
    previousEwma: number | null;
}) {
    if (previousEwma === null) {
        return normalizedLoad;
    }

    const alpha =
        1 - Math.exp(-elapsedMs / adaptiveHighQualityPolicy.ewmaTimeConstantMs);
    return previousEwma + alpha * (normalizedLoad - previousEwma);
}

export function updateAdaptiveHighQuality(
    currentState: AdaptiveHighQualityState,
    sample: AdaptiveHighQualitySample,
): AdaptiveHighQualityUpdate {
    if (!Number.isFinite(sample.normalizedLoad) || sample.normalizedLoad <= 0) {
        return { state: currentState, transition: null };
    }

    const nowMs = normalizeNowMs(sample.nowMs, currentState.lastSampleAtMs);
    const elapsedMs = nowMs - currentState.lastSampleAtMs;
    const sourceChanged = currentState.source !== sample.source;
    let state = accrueDwell(currentState, nowMs);
    const normalizedLoadEwma = updateNormalizedLoadEwma({
        elapsedMs,
        normalizedLoad: sample.normalizedLoad,
        previousEwma: sourceChanged ? null : currentState.normalizedLoadEwma,
    });

    state = {
        ...state,
        headroomEvidence: sourceChanged
            ? emptyEvidence()
            : state.headroomEvidence,
        interactionActive: sample.interactionActive,
        ewmaSampleCount: sourceChanged ? 1 : state.ewmaSampleCount + 1,
        lastTransition: null,
        loadSampleCount: state.loadSampleCount + 1,
        normalizedLoad: sample.normalizedLoad,
        normalizedLoadEwma,
        overloadEvidence: sourceChanged
            ? emptyEvidence()
            : state.overloadEvidence,
        source: sample.source,
    };

    if (sample.interactionActive && state.level === 'L0') {
        const interactionLevel = adjacentLevel(state, 'decline');
        if (interactionLevel !== null) {
            return transitionLevel(
                state,
                interactionLevel,
                'interaction',
                nowMs,
            );
        }
    }

    const overloadEvidence = updateEvidence(
        state.overloadEvidence,
        normalizedLoadEwma > adaptiveHighQualityPolicy.overloadLoad,
        nowMs,
    );
    const headroomEvidence = updateEvidence(
        state.headroomEvidence,
        !sample.interactionActive &&
            normalizedLoadEwma < adaptiveHighQualityPolicy.headroomLoad,
        nowMs,
    );
    state = {
        ...state,
        headroomEvidence,
        overloadEvidence,
    };

    const declineLevel = adjacentLevel(state, 'decline');
    const declineCooldownElapsed =
        state.lastDeclineAtMs === null ||
        nowMs - state.lastDeclineAtMs >=
            adaptiveHighQualityPolicy.declineCooldownMs;
    if (
        declineLevel !== null &&
        declineCooldownElapsed &&
        overloadEvidence.samples >=
            adaptiveHighQualityPolicy.overloadMinimumSamples &&
        evidenceDurationMs(overloadEvidence, nowMs) >=
            adaptiveHighQualityPolicy.overloadSustainMs
    ) {
        return transitionLevel(state, declineLevel, 'overload', nowMs);
    }

    const recoveryLevel = adjacentLevel(state, 'recover');
    if (
        recoveryLevel !== null &&
        !sample.interactionActive &&
        nowMs >= state.recoveryLockedUntilMs &&
        evidenceDurationMs(headroomEvidence, nowMs) >=
            adaptiveHighQualityPolicy.headroomSustainMs
    ) {
        return transitionLevel(state, recoveryLevel, 'headroom', nowMs);
    }

    return { state, transition: null };
}

export function getAdaptiveHighQualitySnapshot(
    state: AdaptiveHighQualityState,
    nowMs: number,
): AdaptiveHighQualitySnapshot {
    const normalizedNowMs = normalizeNowMs(nowMs, state.lastSampleAtMs);
    const dwellMsByLevel = {
        ...state.dwellMsByLevel,
        [state.level]:
            state.dwellMsByLevel[state.level] +
            (normalizedNowMs - state.lastSampleAtMs),
    };

    return {
        currentLevelDwellMs: normalizedNowMs - state.levelEnteredAtMs,
        declineCount: state.declineCount,
        dwellMsByLevel,
        ewmaSampleCount: state.ewmaSampleCount,
        level: state.level,
        loadSampleCount: state.loadSampleCount,
        normalizedLoad: state.normalizedLoad,
        normalizedLoadEwma: state.normalizedLoadEwma,
        oscillationCount: state.oscillationCount,
        profile: resolveAdaptiveHighQualityLevels(state.effectiveDprCeiling)[
            state.level
        ],
        recoveryCount: state.recoveryCount,
        recoveryLocked: normalizedNowMs < state.recoveryLockedUntilMs,
        recoveryLockedUntilMs: state.recoveryLockedUntilMs,
        source: state.source,
        transitionCount: state.transitionCount,
    };
}
