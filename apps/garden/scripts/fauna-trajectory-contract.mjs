import assert from 'node:assert/strict';

export const faunaWitnessSpecies = [
    'Cow',
    'Cat',
    'Dog',
    'Bird',
    'Bee',
    'Bat',
    'Butterfly',
    'Ladybug',
    'Frog',
    'Horse',
    'Rabbit',
    'Squirrel',
    'Slug',
    'Chicken',
    'Goat',
    'Piglet',
    'Sheep',
];
const epsilon = 1e-5;

function orientationDistance(left, right) {
    return Math.min(
        distance(left, right),
        distance(
            left,
            right.map((value) => -value),
        ),
    );
}
function channelResidual(left, right, key) {
    const dot =
        key === 'quaternion'
            ? left.reduce((sum, value, axis) => sum + value * right[axis], 0)
            : 1;
    return left.map(
        (value, axis) => value - (dot < 0 ? -right[axis] : right[axis]),
    );
}
function orientationMidpoint(left, right) {
    const dot = left.reduce((sum, value, axis) => sum + value * right[axis], 0);
    const sameHemisphere = dot < 0 ? right.map((value) => -value) : right;
    // At alpha1/2, normalized quaternion addition is exactly SLERP's midpoint.
    const sum = left.map((value, axis) => value + sameHemisphere[axis]);
    const length = Math.hypot(...sum);
    return sum.map((value) => value / length);
}
function poseMotionBudgets(capture, index) {
    const budgets = new Map();
    const current = new Map();
    for (const actor of capture.frames[index].actors)
        for (const joint of actor.pose)
            for (const key of ['position', 'quaternion', 'scale'])
                current.set(`${actor.id}:${joint.name}:${key}`, joint[key]);
    // Compensation is local to this sample. A later fast animation must never
    // authorize a drift during an earlier stationary interval.
    const presentationSteps = capture.fps / 30;
    for (const neighbor of [
        index - presentationSteps,
        index + presentationSteps,
    ]) {
        const frame = capture.frames[neighbor];
        if (!frame) continue;
        for (const actor of frame.actors)
            for (const joint of actor.pose) {
                for (const key of ['position', 'quaternion', 'scale']) {
                    const id = `${actor.id}:${joint.name}:${key}`;
                    const old = current.get(id);
                    const residual = old
                        ? channelResidual(old, joint[key], key)
                        : joint[key].map(() => 0);
                    const previous = budgets.get(id) ?? residual.map(() => 0);
                    budgets.set(
                        id,
                        residual.map((value, axis) =>
                            Math.max(previous[axis], Math.abs(value)),
                        ),
                    );
                }
            }
    }
    return budgets;
}
function comparePoses(actor, other, budgets, context, offsets = new Map()) {
    assert.deepEqual(
        actor.pose.map((joint) => joint.name),
        other.pose.map((joint) => joint.name),
        `${context}: complete joint identity`,
    );
    let samples = 0;
    let maxError = 0;
    for (let index = 0; index < actor.pose.length; index++) {
        const joint = actor.pose[index],
            counterpart = other.pose[index];
        for (const key of ['position', 'quaternion', 'scale']) {
            const id = `${actor.id}:${joint.name}:${key}`;
            let residual = channelResidual(joint[key], counterpart[key], key);
            const hemisphere = offsets.get(`${id}:hemisphere`);
            if (
                hemisphere &&
                joint[key].reduce(
                    (sum, value, axis) => sum + value * hemisphere[axis],
                    0,
                ) < 0
            )
                residual = residual.map((value) => -value);
            const expected = offsets.get(id) ?? residual.map(() => 0);
            const error = Math.hypot(...residual);
            // Root/gait presentation intentionally lags one fixed step. Damped
            // manual joints use current render time; bound their difference by
            // that joint's adjacent-step baseline motion at this sample, never
            // a whole-capture maximum. Locally static joints remain exact.
            const allowance = budgets.get(id) ?? residual.map(() => 0);
            for (let axis = 0; axis < residual.length; axis++)
                assert.ok(
                    Math.abs(residual[axis] - expected[axis]) <=
                        allowance[axis] + epsilon,
                    `${context}:${joint.name}:${key}[${axis}] signed pose drift ${residual[axis]} differs from legacy cadence ${expected[axis]} beyond local step ${allowance[axis]}`,
                );
            maxError = Math.max(maxError, error);
            samples += 1;
        }
    }
    return { samples, maxError };
}

function distance(left, right) {
    return Math.hypot(...left.map((value, index) => value - right[index]));
}

export function validateFaunaTrajectoryReport(report) {
    assert.equal(report?.schemaVersion, 1);
    assert.match(report.sourceCommit, /^[0-9a-f]{40}$/);
    assert.match(report.fixtureHash, /^[0-9a-f]{64}$/);
    assert.match(report.runtimeHash, /^[0-9a-f]{64}$/);
    assert.match(report.configHash, /^[0-9a-f]{64}$/);
    assert.equal(report.environment.browserProject, 'chromium-webgl');
    assert.ok(['baseline', 'candidate'].includes(report.mode));
    assert.ok(Array.isArray(report.captures));
    const expectedGrid = ['day', 'night', 'autumn-post-rain'].flatMap(
        (scenario) => [30, 60].map((fps) => `${scenario}:${fps}`),
    );
    assert.deepEqual(
        report.captures
            .map((capture) => `${capture.scenario}:${capture.fps}`)
            .sort(),
        expectedGrid.sort(),
        'Exact scenario/cadence matrix is required',
    );
    const seen = new Set();
    for (const capture of report.captures) {
        assert.ok(
            ['day', 'night', 'autumn-post-rain'].includes(capture.scenario),
        );
        assert.ok([30, 60].includes(capture.fps));
        assert.ok(
            capture.frames.length >= capture.fps * 20,
            'A trajectory needs at least twenty seconds of real actor frames',
        );
        assert.equal(capture.suspension.pass, true);
        assert.equal(capture.suspension.scope, 'manual-replay');
        assert.equal(capture.suspension.automaticHiddenAdvances, 0);
        const last = capture.frames.at(-1);
        assert.equal(capture.suspension.hidden.visible, false);
        assert.equal(capture.suspension.resumed.visible, true);
        assert.equal(capture.suspension.hidden.time, last.time);
        assert.ok(
            capture.suspension.resumed.time >= last.time &&
                capture.suspension.resumed.time - last.time <=
                    1 / capture.fps + 1e-8,
            'Resume must not advance the hidden backlog',
        );
        assert.deepEqual(capture.suspension.hidden.actors, last.actors);
        assert.ok(
            capture.suspension.resumed.submittedFrames > last.submittedFrames,
        );
        let previousTime = null;
        let previousReceipt = null;
        for (const frame of capture.frames) {
            assert.ok(Number.isFinite(frame.time));
            assert.equal(frame.visible, true);
            if (previousTime !== null)
                assert.ok(
                    Math.abs(frame.time - previousTime - 1 / capture.fps) <
                        1e-8,
                );
            if (previousReceipt !== null)
                assert.ok(
                    frame.submittedFrames > previousReceipt,
                    'Each sample needs a real root GPU receipt',
                );
            previousTime = frame.time;
            previousReceipt = frame.submittedFrames;
            assert.equal(
                new Set(frame.actors.map((actor) => actor.id)).size,
                frame.actors.length,
            );
            for (const species of faunaWitnessSpecies) {
                assert.equal(
                    frame.counts[species],
                    frame.actors.filter(
                        (actor) => actor.species === species && actor.visible,
                    ).length,
                );
                if (frame.counts[species] > 0) seen.add(species);
            }
            for (const actor of frame.actors) {
                assert.ok(faunaWitnessSpecies.includes(actor.species));
                for (const [key, length] of [
                    ['position', 3],
                    ['quaternion', 4],
                    ['scale', 3],
                ]) {
                    assert.equal(actor[key].length, length);
                    assert.ok(actor[key].every(Number.isFinite));
                }
                assert.ok(
                    Array.isArray(actor.pose) && actor.pose.length > 0,
                    'A mounted actor needs complete joint samples',
                );
                assert.equal(
                    new Set(actor.pose.map((joint) => joint.name)).size,
                    actor.pose.length,
                );
                for (const joint of actor.pose) {
                    assert.equal(typeof joint.name, 'string');
                    for (const [key, length] of [
                        ['position', 3],
                        ['quaternion', 4],
                        ['scale', 3],
                    ]) {
                        assert.equal(joint[key].length, length);
                        assert.ok(
                            joint[key].every(Number.isFinite),
                            `Nonfinite ${actor.id}:${joint.name}:${key}`,
                        );
                    }
                }
            }
        }
    }
    assert.deepEqual(
        [...seen].sort(),
        [...faunaWitnessSpecies].sort(),
        'Every migrated species must be observed in at least one appropriate scenario',
    );
    return report;
}

function matchingActors(left, right, context) {
    assert.deepEqual(
        left.counts,
        right.counts,
        `${context}: species cardinality`,
    );
    assert.deepEqual(
        left.actors.map(({ id, species, visible }) => ({
            id,
            species,
            visible,
        })),
        right.actors.map(({ id, species, visible }) => ({
            id,
            species,
            visible,
        })),
        `${context}: retained actor identities/visibility`,
    );
    return new Map(right.actors.map((actor) => [actor.id, actor]));
}

/** Candidate 60 Hz must retain the same actual actor endpoints as candidate30. */
export function compareFaunaRenderCadences(ambient, interactive, legacy) {
    assert.equal(ambient.fps, 30);
    assert.equal(interactive.fps, 60);
    assert.equal(ambient.scenario, interactive.scenario);
    const metrics = {
        endpoints: 0,
        halfSteps: 0,
        movingSpecies: new Set(),
        maxEndpointError: 0,
        maxHalfStepError: 0,
    };
    for (let index = 0; index < ambient.frames.length; index++) {
        const poseBudgets = poseMotionBudgets(ambient, index);
        const legacyContexts = new Map();
        function poseContext(actor) {
            if (!legacy) return { budgets: poseBudgets, offsets: new Map() };
            const delayed = [
                'Cow',
                'Chicken',
                'Goat',
                'Piglet',
                'Sheep',
            ].includes(actor.species);
            let at = Math.max(0, index - (delayed ? 1 : 0));
            if (
                !legacy.ambient.frames[at].actors.some(
                    ({ id }) => id === actor.id,
                )
            )
                at = index;
            if (!legacyContexts.has(at)) {
                const old30 = legacy.ambient.frames[at];
                const old60 = legacy.interactive.frames[at * 2];
                const actors60 = new Map(
                    old60.actors.map((actor) => [actor.id, actor]),
                );
                const offsets = new Map();
                for (const left of old30.actors) {
                    const right = actors60.get(left.id);
                    if (!right) continue;
                    const joints = new Map(
                        right.pose.map((joint) => [joint.name, joint]),
                    );
                    for (const joint of left.pose) {
                        const counterpart = joints.get(joint.name);
                        if (!counterpart) continue;
                        for (const key of ['position', 'quaternion', 'scale'])
                            offsets.set(
                                `${left.id}:${joint.name}:${key}`,
                                channelResidual(
                                    joint[key],
                                    counterpart[key],
                                    key,
                                ),
                            );
                        offsets.set(
                            `${left.id}:${joint.name}:quaternion:hemisphere`,
                            joint.quaternion,
                        );
                    }
                }
                legacyContexts.set(at, {
                    budgets: poseMotionBudgets(legacy.ambient, at),
                    offsets,
                });
            }
            return legacyContexts.get(at);
        }
        const frame = ambient.frames[index];
        const twice = interactive.frames[index * 2];
        assert.ok(twice, 'Missing60Hz endpoint');
        const counterparts = matchingActors(
            frame,
            twice,
            `${ambient.scenario}:${index}`,
        );
        for (const actor of frame.actors) {
            const other = counterparts.get(actor.id);
            const error = distance(actor.position, other.position);
            metrics.maxEndpointError = Math.max(
                metrics.maxEndpointError,
                error,
            );
            assert.ok(
                error < epsilon,
                `${actor.id} 30/60 endpoint drift ${error} at${index}`,
            );
            assert.ok(
                distance(actor.scale, other.scale) < epsilon,
                `${actor.id}: scale changed with render cadence`,
            );
            // Quaternion signs describe the same orientation.
            const orientationError = Math.min(
                distance(actor.quaternion, other.quaternion),
                distance(
                    actor.quaternion,
                    other.quaternion.map((value) => -value),
                ),
            );
            assert.ok(
                orientationError < epsilon,
                `${actor.id}: orientation changed with render cadence`,
            );
            const pose = poseContext(actor);
            comparePoses(
                actor,
                other,
                pose.budgets,
                `cadence:${actor.id}:${index}`,
                pose.offsets,
            );
            metrics.endpoints += 1;
        }
        const next = ambient.frames[index + 1];
        const half = interactive.frames[index * 2 + 1];
        if (!next || !half) continue;
        const nextActors = new Map(
            next.actors.map((actor) => [actor.id, actor]),
        );
        const halfActors = new Map(
            half.actors.map((actor) => [actor.id, actor]),
        );
        for (const actor of frame.actors) {
            const end = nextActors.get(actor.id);
            const middle = halfActors.get(actor.id);
            if (!actor.visible || !end?.visible || !middle?.visible) continue;
            const travel = distance(actor.position, end.position);
            // Large semantic teleports deliberately snap rather than glide.
            if (travel > 2) continue;
            assert.ok(
                orientationDistance(
                    orientationMidpoint(actor.quaternion, end.quaternion),
                    middle.quaternion,
                ) < epsilon,
                `${actor.id}: quaternion interpolation mismatch at${index}`,
            );
            assert.ok(
                distance(
                    actor.scale.map(
                        (value, axis) => (value + end.scale[axis]) / 2,
                    ),
                    middle.scale,
                ) < epsilon,
                `${actor.id}: scale interpolation mismatch at${index}`,
            );
            if (travel < epsilon) continue;
            const expected = actor.position.map(
                (value, axis) => (value + end.position[axis]) / 2,
            );
            const error = distance(expected, middle.position);
            metrics.maxHalfStepError = Math.max(
                metrics.maxHalfStepError,
                error,
            );
            assert.ok(
                error < epsilon,
                `${actor.id} interpolation mismatch ${error} at${index}`,
            );
            metrics.movingSpecies.add(actor.species);
            metrics.halfSteps += 1;
        }
    }
    assert.ok(metrics.endpoints > 0);
    assert.ok(
        metrics.halfSteps > 0,
        'A cadence witness must contain actual locomotion',
    );
    return { ...metrics, movingSpecies: [...metrics.movingSpecies].sort() };
}

function transitions(capture) {
    const state = new Map();
    const result = new Map();
    for (const frame of capture.frames)
        for (const entry of frame.debug) {
            const signature = JSON.stringify([
                entry.species,
                entry.phase,
                entry.behavior,
                entry.targetId,
                entry.pathfinding?.status,
                entry.pathfinding?.targetCell,
            ]);
            if (state.get(entry.id) === signature) continue;
            state.set(entry.id, signature);
            const timeline = result.get(entry.id) ?? [];
            timeline.push({ signature, at: entry.updatedAt });
            result.set(entry.id, timeline);
        }
    return result;
}

/** Exact population/decisions plus baseline movement shifted by the designed one-step presentation latency. */
export function compareFaunaBaseline(baseline, candidate) {
    validateFaunaTrajectoryReport(baseline);
    validateFaunaTrajectoryReport(candidate);
    assert.equal(baseline.mode, 'baseline');
    assert.equal(candidate.mode, 'candidate');
    assert.equal(
        baseline.fixtureHash,
        candidate.fixtureHash,
        'Baseline and candidate must use the identical frozen fixture/driver',
    );
    assert.equal(
        baseline.configHash,
        candidate.configHash,
        'Browser configuration changed',
    );
    assert.deepEqual(
        baseline.environment,
        candidate.environment,
        'Asset server/browser environment changed',
    );
    const results = [];
    for (const old of baseline.captures) {
        const current = candidate.captures.find(
            (capture) =>
                capture.scenario === old.scenario && capture.fps === old.fps,
        );
        assert.ok(current);
        assert.equal(current.frames.length, old.frames.length);
        let maxPositionError = 0;
        let maxPoseError = 0;
        let poseSamples = 0;
        let samples = 0;
        for (let index = 0; index < current.frames.length; index++) {
            const poseBudgets = poseMotionBudgets(old, index);
            const frame = current.frames[index];
            matchingActors(
                old.frames[index],
                frame,
                `legacy:${old.scenario}:${index}`,
            );
            const presentActors = new Map(
                old.frames[index].actors.map((actor) => [actor.id, actor]),
            );
            const oldActors = new Map(
                old.frames[Math.max(0, index - old.fps / 30)].actors.map(
                    (actor) => [actor.id, actor],
                ),
            );
            for (const actor of frame.actors) {
                const previous = oldActors.get(actor.id);
                if (!actor.visible) continue;
                const present = presentActors.get(actor.id);
                const expected =
                    !previous ||
                    distance(previous.position, present.position) > 2
                        ? present
                        : previous;
                // First mounted actors and semantic teleports snap to the
                // current authoritative pose. Ordinary locomotion presents
                // the preceding fixed step at the 30 Hz boundary.
                const error = distance(actor.position, expected.position);
                if (old.fps === 30)
                    assert.ok(
                        orientationDistance(
                            actor.quaternion,
                            expected.quaternion,
                        ) < epsilon,
                        `${actor.id}: legacy orientation changed`,
                    );
                if (old.fps === 30)
                    assert.ok(
                        distance(actor.scale, expected.scale) < epsilon,
                        `${actor.id}: legacy scale changed`,
                    );
                const pose = comparePoses(
                    actor,
                    present,
                    poseBudgets,
                    `${old.scenario}:${actor.id}:${index}`,
                );
                maxPoseError = Math.max(maxPoseError, pose.maxError);
                poseSamples += pose.samples;
                maxPositionError = Math.max(maxPositionError, error);
                if (old.fps === 30)
                    assert.ok(
                        error < epsilon,
                        `${old.scenario}:${actor.id} legacy trajectory drift ${error} at${index}`,
                    );
                samples += 1;
            }
        }
        const oldTransitions = transitions(old);
        const currentTransitions = transitions(current);
        assert.deepEqual(
            [...oldTransitions.keys()].sort(),
            [...currentTransitions.keys()].sort(),
            'Actual debug actor coverage changed',
        );
        let decisions = 0;
        for (const [id, history] of oldTransitions) {
            const next = currentTransitions.get(id);
            assert.deepEqual(
                history.map(({ signature }) => signature),
                next.map(({ signature }) => signature),
                `${id}: actual behavior/target path changed`,
            );
            for (let index = 0; index < history.length; index++) {
                // Existing debug reports sample at0.5s. Their phase may be
                // observed one simulation tick apart at a sampling boundary.
                assert.ok(
                    Math.abs(history[index].at - next[index].at) <=
                        1 / 30 + 1e-8,
                    `${id}: actual decision timeline changed`,
                );
                decisions += 1;
            }
        }
        results.push({
            scenario: old.scenario,
            fps: old.fps,
            samples,
            decisions,
            maxPositionError,
            poseSamples,
            maxPoseError,
        });
    }
    return results;
}
