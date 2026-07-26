import assert from 'node:assert/strict';
import test from 'node:test';
import {
    type AdaptiveHighQualityLoadSource,
    type AdaptiveHighQualityState,
    adaptiveHighQualityLevelOrder,
    adaptiveHighQualityLevels,
    createAdaptiveHighQualityState,
    getAdaptiveHighQualitySnapshot,
    resolveAdaptiveHighQualityLevelOrder,
    resolveAdaptiveHighQualityLevels,
    resumeAdaptiveHighQualityState,
    updateAdaptiveHighQuality,
} from './adaptiveHighQuality';

function sample(
    state: AdaptiveHighQualityState,
    {
        interactionActive = false,
        load,
        nowMs,
        source = 'gpu',
    }: {
        interactionActive?: boolean;
        load: number;
        nowMs: number;
        source?: AdaptiveHighQualityLoadSource;
    },
) {
    return updateAdaptiveHighQuality(state, {
        interactionActive,
        normalizedLoad: load,
        nowMs,
        source,
    });
}

function settleEwma(
    state: AdaptiveHighQualityState,
    {
        durationMs,
        intervalMs = 250,
        load,
        source = 'gpu',
        startMs,
    }: {
        durationMs: number;
        intervalMs?: number;
        load: number;
        source?: AdaptiveHighQualityLoadSource;
        startMs: number;
    },
) {
    let nextState = state;
    for (
        let nowMs = startMs;
        nowMs <= startMs + durationMs;
        nowMs += intervalMs
    ) {
        nextState = sample(nextState, {
            load,
            nowMs,
            source,
        }).state;
    }
    return nextState;
}

function forceDecline(state: AdaptiveHighQualityState, startMs: number) {
    let nextState = state;
    for (let nowMs = startMs; nowMs <= startMs + 10_000; nowMs += 250) {
        const update = sample(nextState, {
            load: 2,
            nowMs,
        });
        nextState = update.state;
        if (update.transition?.direction === 'decline') {
            return nextState;
        }
    }
    throw new Error('Expected a decline transition');
}

function forceRecovery(state: AdaptiveHighQualityState, startMs: number) {
    let nextState = state;
    for (let nowMs = startMs; nowMs <= startMs + 15_000; nowMs += 250) {
        const update = sample(nextState, {
            load: 0.2,
            nowMs,
        });
        nextState = update.state;
        if (update.transition?.direction === 'recover') {
            return nextState;
        }
    }
    throw new Error('Expected a recovery transition');
}

test('adaptive High level order exposes the staged visual ceiling', () => {
    assert.deepEqual(adaptiveHighQualityLevelOrder, ['L0', 'L1', 'L2', 'L3']);
    assert.deepEqual(adaptiveHighQualityLevels, {
        L0: {
            ambientFramesPerSecond: 30,
            cloudShadowUpdateMs: 96,
            dpr: 2,
            factor: 1,
        },
        L1: {
            ambientFramesPerSecond: 30,
            cloudShadowUpdateMs: 96,
            dpr: 1.75,
            factor: 0.875,
        },
        L2: {
            ambientFramesPerSecond: 30,
            cloudShadowUpdateMs: 96,
            dpr: 1.5,
            factor: 0.75,
        },
        L3: {
            ambientFramesPerSecond: 20,
            cloudShadowUpdateMs: 160,
            dpr: 1.5,
            factor: 0.7,
        },
    });
});

test('level DPR reductions derive from the effective display ceiling', () => {
    assert.deepEqual(
        Object.fromEntries(
            Object.entries(resolveAdaptiveHighQualityLevels(1.5)).map(
                ([level, profile]) => [level, profile.dpr],
            ),
        ),
        {
            L0: 1.5,
            L1: 1.25,
            L2: 1.125,
            L3: 1.125,
        },
    );
    assert.deepEqual(
        Object.fromEntries(
            Object.entries(resolveAdaptiveHighQualityLevels(0.5)).map(
                ([level, profile]) => [level, profile.dpr],
            ),
        ),
        {
            L0: 1,
            L1: 1,
            L2: 1,
            L3: 1,
        },
    );
    assert.equal(resolveAdaptiveHighQualityLevels(3).L0.dpr, 2);
    assert.deepEqual(resolveAdaptiveHighQualityLevelOrder(1), ['L0', 'L3']);
    assert.deepEqual(resolveAdaptiveHighQualityLevelOrder(1.25), [
        'L0',
        'L1',
        'L3',
    ]);
});

test('governor skips duplicate runtime stages at a constrained DPR ceiling', () => {
    let state = createAdaptiveHighQualityState({
        effectiveDprCeiling: 1,
        level: 'L2',
    });
    assert.equal(state.level, 'L0');

    state = sample(state, {
        interactionActive: true,
        load: 1,
        nowMs: 10,
    }).state;
    assert.equal(state.level, 'L3');

    state = forceRecovery(state, 260);
    assert.equal(state.level, 'L0');
});

test('EWMA has a one-second time constant over normalized load', () => {
    let state = sample(createAdaptiveHighQualityState(), {
        load: 1,
        nowMs: 0,
    }).state;
    state = sample(state, { load: 2, nowMs: 1_000 }).state;

    assert.ok(state.normalizedLoadEwma !== null);
    assert.ok(Math.abs(state.normalizedLoadEwma - 1.6321) < 0.001);
});

test('interaction immediately declines L0 once and blocks recovery while held', () => {
    let state = createAdaptiveHighQualityState();
    const firstUpdate = sample(state, {
        interactionActive: true,
        load: 0.2,
        nowMs: 10,
    });
    state = firstUpdate.state;

    assert.deepEqual(firstUpdate.transition, {
        atMs: 10,
        direction: 'decline',
        from: 'L0',
        reason: 'interaction',
        to: 'L1',
    });
    assert.equal(state.declineCount, 1);

    state = settleEwma(state, {
        durationMs: 10_000,
        load: 0.2,
        startMs: 260,
    });
    assert.equal(state.level, 'L0');

    let heldState = sample(createAdaptiveHighQualityState(), {
        interactionActive: true,
        load: 0.2,
        nowMs: 10,
    }).state;
    for (let nowMs = 260; nowMs <= 10_260; nowMs += 250) {
        heldState = sample(heldState, {
            interactionActive: true,
            load: 0.2,
            nowMs,
        }).state;
    }
    assert.equal(heldState.level, 'L1');
    assert.equal(heldState.transitionCount, 1);
});

test('overload requires threshold hysteresis, duration, samples, and cooldown', () => {
    let state = sample(createAdaptiveHighQualityState(), {
        load: 1.11,
        nowMs: 0,
    }).state;
    state = sample(state, { load: 1.11, nowMs: 500 }).state;
    state = sample(state, { load: 1.11, nowMs: 749 }).state;
    assert.equal(state.level, 'L0');

    state = sample(state, { load: 1.11, nowMs: 750 }).state;
    assert.equal(state.level, 'L1');
    assert.equal(state.lastTransition?.reason, 'overload');

    state = sample(state, { load: 1.4, nowMs: 1_000 }).state;
    state = sample(state, { load: 1.4, nowMs: 1_500 }).state;
    state = sample(state, { load: 1.4, nowMs: 1_749 }).state;
    assert.equal(state.level, 'L1');

    state = sample(state, { load: 1.4, nowMs: 2_000 }).state;
    assert.equal(state.level, 'L2');
    assert.equal(state.declineCount, 2);
});

test('loads inside the hysteresis band neither decline nor recover', () => {
    let state = createAdaptiveHighQualityState({ level: 'L2' });
    state = settleEwma(state, {
        durationMs: 20_000,
        load: 0.95,
        startMs: 0,
    });

    assert.equal(state.level, 'L2');
    assert.equal(state.transitionCount, 0);
    assert.equal(state.oscillationCount, 0);
});

test('headroom recovers exactly one level after five sustained seconds', () => {
    let state = createAdaptiveHighQualityState({ level: 'L3' });
    state = sample(state, { load: 0.75, nowMs: 0 }).state;
    state = sample(state, { load: 0.75, nowMs: 4_999 }).state;
    assert.equal(state.level, 'L3');

    state = sample(state, { load: 0.75, nowMs: 5_000 }).state;
    assert.equal(state.level, 'L2');
    assert.equal(state.recoveryCount, 1);
    assert.equal(state.lastTransition?.reason, 'headroom');

    state = sample(state, { load: 0.75, nowMs: 5_001 }).state;
    state = sample(state, { load: 0.75, nowMs: 10_000 }).state;
    assert.equal(state.level, 'L2');
    state = sample(state, { load: 0.75, nowMs: 10_001 }).state;
    assert.equal(state.level, 'L1');
});

test('source changes reset EWMA and sustained evidence', () => {
    let state = sample(createAdaptiveHighQualityState(), {
        load: 1.5,
        nowMs: 0,
        source: 'gpu',
    }).state;
    state = sample(state, {
        load: 1.5,
        nowMs: 500,
        source: 'gpu',
    }).state;
    state = sample(state, {
        load: 1.5,
        nowMs: 749,
        source: 'gpu',
    }).state;

    state = sample(state, {
        load: 1.2,
        nowMs: 750,
        source: 'frame',
    }).state;
    assert.equal(state.level, 'L0');
    assert.equal(state.normalizedLoadEwma, 1.2);
    assert.deepEqual(state.overloadEvidence, {
        samples: 1,
        sinceMs: 750,
    });

    state = sample(state, {
        load: 1.2,
        nowMs: 1_499,
        source: 'frame',
    }).state;
    assert.equal(state.level, 'L0');
    state = sample(state, {
        load: 1.2,
        nowMs: 1_500,
        source: 'frame',
    }).state;
    assert.equal(state.level, 'L1');
});

test('three direction reversals lock recovery for 30 seconds without locking decline', () => {
    let state = createAdaptiveHighQualityState();
    state = forceDecline(state, 0);
    assert.equal(state.level, 'L1');
    state = forceRecovery(state, state.lastSampleAtMs + 250);
    assert.equal(state.level, 'L0');
    state = forceDecline(state, state.lastSampleAtMs + 250);
    assert.equal(state.level, 'L1');
    state = forceRecovery(state, state.lastSampleAtMs + 250);
    assert.equal(state.level, 'L0');
    assert.equal(state.oscillationCount, 3);
    const recoveryLockedUntilMs = state.lastSampleAtMs + 30_000;
    assert.equal(state.recoveryLockedUntilMs, recoveryLockedUntilMs);

    state = forceDecline(state, state.lastSampleAtMs + 250);
    assert.equal(state.level, 'L1');
    assert.equal(state.declineCount, 3);
    assert.equal(state.recoveryLockedUntilMs, recoveryLockedUntilMs);

    state = settleEwma(state, {
        durationMs: 10_000,
        load: 0.2,
        startMs: state.lastSampleAtMs + 250,
    });
    assert.equal(state.level, 'L1');
    assert.equal(state.recoveryCount, 2);

    state = forceRecovery(state, recoveryLockedUntilMs);
    assert.equal(state.level, 'L0');
    assert.equal(state.recoveryCount, 3);
});

test('transition telemetry counts dwell by level without mutating snapshots', () => {
    let state = createAdaptiveHighQualityState({ nowMs: 100 });
    state = sample(state, {
        interactionActive: true,
        load: 1,
        nowMs: 600,
    }).state;
    state = sample(state, { load: 0.9, nowMs: 1_600 }).state;

    const snapshot = getAdaptiveHighQualitySnapshot(state, 2_600);
    assert.deepEqual(snapshot.dwellMsByLevel, {
        L0: 500,
        L1: 2_000,
        L2: 0,
        L3: 0,
    });
    assert.equal(snapshot.currentLevelDwellMs, 2_000);
    assert.equal(snapshot.transitionCount, 1);
    assert.equal(snapshot.declineCount, 1);
    assert.equal(snapshot.recoveryCount, 0);
    assert.equal(snapshot.oscillationCount, 0);
    assert.equal(snapshot.loadSampleCount, 2);
    assert.equal(snapshot.ewmaSampleCount, 1);
    assert.equal(snapshot.normalizedLoad, 0.9);
    assert.equal(snapshot.normalizedLoadEwma, state.normalizedLoadEwma);
    assert.deepEqual(snapshot.profile, adaptiveHighQualityLevels.L1);
    assert.deepEqual(state.dwellMsByLevel, {
        L0: 500,
        L1: 1_000,
        L2: 0,
        L3: 0,
    });
});

test('snapshot resolves the active profile against the state DPR ceiling', () => {
    let state = createAdaptiveHighQualityState({
        effectiveDprCeiling: 1.5,
    });
    state = sample(state, {
        interactionActive: true,
        load: 1,
        nowMs: 10,
    }).state;

    assert.equal(getAdaptiveHighQualitySnapshot(state, 10).profile.dpr, 1.25);
});

test('scene resume clears timed evidence without counting suspended dwell', () => {
    let state = createAdaptiveHighQualityState({ nowMs: 100 });
    state = sample(state, {
        interactionActive: true,
        load: 1,
        nowMs: 600,
    }).state;
    state = sample(state, {
        load: 0.75,
        nowMs: 1_600,
    }).state;

    const beforeResume = getAdaptiveHighQualitySnapshot(state, 1_600);
    const resumed = resumeAdaptiveHighQualityState(state, 11_600);
    const afterResume = getAdaptiveHighQualitySnapshot(resumed, 11_600);

    assert.equal(resumed.level, 'L1');
    assert.equal(resumed.transitionCount, 1);
    assert.equal(resumed.declineCount, 1);
    assert.equal(resumed.recoveryCount, 0);
    assert.equal(resumed.lastSampleAtMs, 11_600);
    assert.equal(resumed.normalizedLoad, null);
    assert.equal(resumed.normalizedLoadEwma, null);
    assert.equal(resumed.ewmaSampleCount, 0);
    assert.equal(resumed.source, null);
    assert.deepEqual(resumed.headroomEvidence, {
        samples: 0,
        sinceMs: null,
    });
    assert.deepEqual(resumed.overloadEvidence, {
        samples: 0,
        sinceMs: null,
    });
    assert.deepEqual(afterResume.dwellMsByLevel, beforeResume.dwellMsByLevel);
    assert.equal(
        afterResume.currentLevelDwellMs,
        beforeResume.currentLevelDwellMs,
    );

    const firstResumedSample = sample(resumed, {
        load: 0.75,
        nowMs: 11_850,
    }).state;
    assert.deepEqual(firstResumedSample.headroomEvidence, {
        samples: 1,
        sinceMs: 11_850,
    });
    assert.equal(firstResumedSample.level, 'L1');
});
