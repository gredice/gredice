import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

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
const oraclePrecision = 1e-10;
const receiptPrecision = 1e-9;
const referenceCommit = '54278326213053ce318c7ea071c8bb94cb6d5257';
const delayedPoseFunctions = new Set([
    'updateCowPose',
    'updateChickenPose',
    'updateGoatPose',
    'updatePigletPose',
    'updateSheepPose',
]);
const poseSourceNames = [
    'updateCowPose',
    'updateChickenPose',
    'updateGoatPose',
    'updatePigletPose',
    'updateSheepPose',
    'updateBirdLegPose',
    'updateGroundPeckPose',
    'updateDogWalkPose',
    'animateRabbitRig',
    'updateBeeRig',
    'updateButterflyRig',
    'updateLadybugRig',
    'updateRig',
];
const digest = (actors) =>
    createHash('sha256')
        .update(JSON.stringify(actors.map(({ id, pose }) => ({ id, pose }))))
        .digest('hex');

function finiteReceipt(value, context) {
    if (typeof value === 'number')
        assert.ok(Number.isFinite(value), `${context}: nonfinite receipt`);
    else if (Array.isArray(value))
        value.forEach((entry, index) => {
            finiteReceipt(entry, `${context}[${index}]`);
        });
    else if (value !== null && typeof value === 'object')
        for (const [key, entry] of Object.entries(value))
            finiteReceipt(entry, `${context}.${key}`);
}
function addManifest(manifest, key, value, context) {
    if (manifest.has(key))
        assert.deepEqual(
            manifest.get(key),
            value,
            `${context}: inconsistent manifest ${key}`,
        );
    else manifest.set(key, value);
}
function validateOracle(
    frame,
    capture,
    mode,
    previous,
    manifests,
    resumed = false,
) {
    const receipt = frame.poseOracle;
    assert.equal(receipt?.pass, true, 'Independent frozen pose replay failed');
    assert.ok(
        Number.isInteger(receipt.checks) && receipt.checks > 0,
        'Independent pose replay must check complete rigs',
    );
    assert.ok(
        Number.isFinite(receipt.maxError) &&
            receipt.maxError >= 0 &&
            receipt.maxError <= oraclePrecision,
        'Independent pose drift exceeds recurrence precision',
    );
    for (const key of [
        'checkedPoses',
        'sources',
        'clips',
        'calls',
        'mixers',
        'commands',
        'semanticWrites',
        'semanticInputs',
        'presences',
        'simulationSteps',
    ]) {
        assert.ok(Array.isArray(receipt[key]), `Missing oracle ${key}`);
        finiteReceipt(receipt[key], key);
    }
    const checked = new Set();
    for (const { actor, node } of receipt.checkedPoses) {
        assert.equal(typeof actor, 'string');
        assert.equal(typeof node, 'string');
        const key = `${actor}:${node}`;
        assert.ok(!checked.has(key), `Duplicate checked pose ${key}`);
        checked.add(key);
    }
    for (const actor of frame.actors)
        for (const joint of actor.pose)
            assert.ok(
                checked.has(`${actor.id}:${joint.name}`),
                `Unchecked complete pose ${actor.id}:${joint.name}`,
            );
    assert.ok(
        receipt.checks >= checked.size * 3,
        'Independent replay omitted transform channels',
    );
    assert.equal(
        receipt.poseHash,
        digest(frame.actors),
        'Independent pose drift or receipt mismatch',
    );
    for (const source of receipt.sources) {
        assert.equal(source.referenceCommit, referenceCommit);
        assert.ok(
            poseSourceNames.includes(source.name),
            'Unknown frozen pose source',
        );
        assert.equal(typeof source.file, 'string');
        assert.match(source.referenceHash, /^[0-9a-f]{64}$/);
        assert.match(source.actualHash, /^[0-9a-f]{64}$/);
        assert.ok(
            source.helperHashes && typeof source.helperHashes === 'object',
        );
        for (const hash of Object.values(source.helperHashes))
            assert.match(hash, /^[0-9a-f]{64}$/);
        if (mode === 'baseline' || source.name !== 'updateButterflyRig')
            assert.equal(
                source.actualHash,
                source.referenceHash,
                'Unexpected manual pose body change',
            );
        addManifest(
            manifests.sources,
            `${source.file}:${source.name}`,
            source,
            'Pose source',
        );
    }
    for (const clip of receipt.clips) {
        assert.equal(typeof clip.actor, 'string');
        assert.equal(typeof clip.name, 'string');
        assert.match(clip.hash, /^[0-9a-f]{64}$/);
        addManifest(
            manifests.clips,
            `${clip.actor}:${clip.name}`,
            clip.hash,
            'Native clip',
        );
    }
    const renderDelta = previous ? frame.time - previous.time : 0;
    const expectedSteps =
        mode === 'baseline'
            ? 0
            : resumed || capture.fps === 30 || frame.index % 2 === 0
              ? 1
              : 0;
    assert.equal(
        receipt.simulationSteps.length,
        expectedSteps,
        'Fixed simulation rate changed',
    );
    for (const step of receipt.simulationSteps) {
        assert.ok(
            Math.abs(step.now - frame.time) < receiptPrecision,
            'Fixed simulation phase changed',
        );
        const expectedDelta = !previous ? 0 : resumed ? renderDelta : 1 / 30;
        assert.ok(
            Math.abs(step.delta - expectedDelta) < receiptPrecision,
            'Fixed simulation delta changed',
        );
    }
    if (mode === 'candidate' && expectedSteps === 0)
        assert.equal(
            receipt.presences.length,
            0,
            'Presence changed between fixed steps',
        );
    for (const presence of receipt.presences) {
        assert.equal(typeof presence.id, 'string');
        assert.ok(faunaWitnessSpecies.includes(presence.species));
        assert.equal(typeof presence.behavior, 'string');
        assert.ok(Number.isFinite(presence.updatedAt));
        for (const axis of ['x', 'y', 'z'])
            assert.ok(Number.isFinite(presence.position?.[axis]));
        if (mode === 'candidate')
            assert.ok(
                Math.abs(presence.updatedAt - frame.time) < receiptPrecision,
                'Presence fixed-step timestamp changed',
            );
    }
    for (const call of receipt.calls) {
        const source = manifests.sources.get(call.sourceId);
        assert.ok(source, `Unregistered frozen pose call ${call.sourceId}`);
        assert.equal(typeof call.actor, 'string');
        const delayed =
            mode === 'candidate' && delayedPoseFunctions.has(source.name);
        const clock = call.clock;
        assert.equal(
            clock?.policy,
            delayed ? 'presentation' : 'render',
            'Pose clock policy changed',
        );
        assert.ok(
            Number.isFinite(clock.anchor) &&
                clock.anchor >= 0 &&
                clock.anchor <= frame.time + receiptPrecision,
            'Invalid pose clock anchor',
        );
        if (!delayed)
            assert.equal(clock.anchor, 0, 'Render clock anchor changed');
        const key = `${capture.scenario}:${capture.fps}:${call.actor}:${call.sourceId}`;
        const anchor = manifests.anchors.get(key);
        if (anchor !== undefined && !resumed)
            assert.equal(
                clock.anchor,
                anchor,
                'Presentation anchor changed without resume',
            );
        if (delayed) {
            assert.ok(
                Math.abs(clock.anchor * 30 - Math.round(clock.anchor * 30)) <
                    receiptPrecision || resumed,
                'Presentation anchor is not a fixed step',
            );
            manifests.anchors.set(key, clock.anchor);
        }
        const expectedTime = delayed
            ? Math.max(clock.anchor, frame.time - 1 / 30)
            : frame.time;
        const priorTime = delayed
            ? Math.max(clock.anchor, frame.time - renderDelta - 1 / 30)
            : frame.time - renderDelta;
        const snapped =
            delayed && Math.abs(clock.anchor - frame.time) < receiptPrecision;
        const expectedDelta = snapped
            ? Math.min(1 / 30, renderDelta)
            : Math.min(
                  delayed ? 0.064 : Number.POSITIVE_INFINITY,
                  Math.max(0, expectedTime - priorTime),
              );
        assert.ok(
            Math.abs(clock.time - expectedTime) < receiptPrecision,
            'Pose clock phase changed',
        );
        assert.ok(
            Math.abs(clock.delta - expectedDelta) < receiptPrecision,
            'Pose clock rate changed',
        );
        const suppliedTime = call.inputs.now ?? call.inputs.time;
        if (suppliedTime !== undefined)
            assert.ok(
                Math.abs(suppliedTime - expectedTime) < receiptPrecision,
                'Authoritative pose input phase changed',
            );
        if (call.inputs.delta !== undefined)
            assert.ok(
                Math.abs(call.inputs.delta - expectedDelta) < receiptPrecision,
                'Authoritative pose input rate changed',
            );
    }
    for (const mixer of receipt.mixers) {
        assert.equal(typeof mixer.actor, 'string');
        assert.ok(
            Math.abs(mixer.delta - renderDelta) < receiptPrecision,
            'Mixer clock rate changed',
        );
        const key = `${capture.scenario}:${capture.fps}:${mixer.actor}`;
        const old = manifests.mixers.get(key);
        if (old !== undefined)
            assert.ok(
                Math.abs(mixer.time - old - mixer.delta) < receiptPrecision,
                'Mixer accumulated clock changed',
            );
        manifests.mixers.set(key, mixer.time);
    }
    for (const command of receipt.commands) {
        assert.equal(typeof command.actor, 'string');
        assert.equal(typeof command.clip, 'string');
        assert.equal(typeof command.method, 'string');
        assert.ok(Array.isArray(command.args));
        assert.ok(
            Number.isFinite(command.at) &&
                command.at <= frame.time + receiptPrecision,
            'Native action timestamp changed',
        );
        assert.ok(
            command.at >= frame.time - renderDelta - receiptPrecision,
            'Native action receipt was delayed beyond its render window',
        );
        if (mode === 'candidate' && !resumed)
            assert.ok(
                Math.abs(command.at * 30 - Math.round(command.at * 30)) <
                    receiptPrecision,
                'Native action target changed between fixed steps',
            );
    }
    return receipt;
}

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
        Math.max(0, index - presentationSteps),
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
function comparePoses(actor, other, budgets, context) {
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
            const residual = channelResidual(joint[key], counterpart[key], key);
            const error = Math.hypot(...residual);
            // Root/gait presentation intentionally lags one fixed step. Damped
            // manual joints use current render time; bound their difference by
            // that joint's adjacent-step baseline motion at this sample, never
            // a whole-capture maximum. Locally static joints remain exact.
            const allowance = budgets.get(id) ?? residual.map(() => 0);
            for (let axis = 0; axis < residual.length; axis++)
                assert.ok(
                    Math.abs(residual[axis]) <= allowance[axis] + epsilon,
                    `${context}:${joint.name}:${key}[${axis}] pose drift ${residual[axis]} exceeds local step ${allowance[axis]}`,
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
    if (report.mode === 'baseline')
        assert.equal(
            report.sourceCommit,
            referenceCommit,
            'Baseline source must be the frozen reference',
        );
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
    const manifests = {
        sources: new Map(),
        clips: new Map(),
        anchors: new Map(),
        mixers: new Map(),
    };
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
        assert.equal(
            capture.suspension.hidden.submittedFrames,
            last.submittedFrames,
            'Hidden replay submitted GPU work',
        );
        assert.ok(
            capture.suspension.resumed.submittedFrames > last.submittedFrames,
        );
        let previousTime = null;
        let previousReceipt = null;
        let previousFrame = null;
        for (const [index, frame] of capture.frames.entries()) {
            assert.equal(frame.index, index, 'Frame index changed');
            if (index === 0)
                assert.equal(frame.time, 0, 'Replay must start at zero');
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
            validateOracle(
                frame,
                capture,
                report.mode,
                previousFrame,
                manifests,
            );
            previousFrame = frame;
        }
        // The resumed render is also independently replayed. Hidden work is
        // bounded by the canonical lifecycle harness, rather than manual RAF.
        const resumed = capture.suspension.resumed;
        for (const actor of resumed.actors) {
            for (const key of ['position', 'quaternion', 'scale'])
                assert.ok(
                    actor[key].every(Number.isFinite),
                    'Nonfinite resumed root',
                );
            for (const joint of actor.pose)
                for (const key of ['position', 'quaternion', 'scale'])
                    assert.ok(
                        joint[key].every(Number.isFinite),
                        'Nonfinite resumed joint',
                    );
        }
        validateOracle(resumed, capture, report.mode, last, manifests, true);
    }
    assert.deepEqual(
        [...manifests.sources.values()].map(({ name }) => name).sort(),
        [...poseSourceNames].sort(),
        'Every frozen manual pose source must be exercised',
    );
    assert.ok(
        manifests.clips.size > 0,
        'Native animation clips must be exercised',
    );
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

function coherentInputs(left, right, context) {
    if (typeof left === 'number' && typeof right === 'number') {
        assert.ok(
            Number.isFinite(left) &&
                Number.isFinite(right) &&
                Math.abs(left - right) < receiptPrecision,
            `${context}: authoritative pose input changed`,
        );
    } else if (Array.isArray(left) && Array.isArray(right)) {
        assert.equal(
            left.length,
            right.length,
            `${context}: input shape changed`,
        );
        left.forEach((value, index) => {
            coherentInputs(value, right[index], `${context}[${index}]`);
        });
    } else if (
        typeof left === 'object' &&
        left !== null &&
        typeof right === 'object' &&
        right !== null
    ) {
        assert.deepEqual(
            Object.keys(left).sort(),
            Object.keys(right).sort(),
            `${context}: input fields changed`,
        );
        for (const key of Object.keys(left))
            coherentInputs(left[key], right[key], `${context}.${key}`);
    } else
        assert.equal(
            left,
            right,
            `${context}: authoritative pose input changed`,
        );
}

function comparePoseInputs(left, right, context) {
    const calls = (receipt) =>
        receipt.calls.map(({ actor, sourceId, inputs }) => ({
            actor,
            sourceId,
            inputs: Object.fromEntries(
                Object.entries(inputs).filter(([key]) => key !== 'delta'),
            ),
        }));
    coherentInputs(calls(left), calls(right), `${context}:pose targets`);
    coherentInputs(
        left.semanticInputs,
        right.semanticInputs,
        `${context}:semantic targets`,
    );
    coherentInputs(
        left.semanticWrites,
        right.semanticWrites,
        `${context}:semantic joint writes`,
    );
}

function compareActionPlans(ambient, interactive) {
    function plan(capture) {
        const result = new Map();
        for (const frame of capture.frames)
            for (const command of frame.poseOracle.commands) {
                const key = `${command.actor}:${command.clip}`;
                const commands = result.get(key) ?? [];
                commands.push(command);
                result.set(key, commands);
            }
        return result;
    }
    const left = plan(ambient),
        right = plan(interactive);
    assert.deepEqual(
        [...left.keys()].sort(),
        [...right.keys()].sort(),
        'Native action identities changed with render cadence',
    );
    for (const [key, commands] of left)
        coherentInputs(
            commands,
            right.get(key),
            `${key}:native action targets`,
        );
}

function compareMidpointInputs(previous, next, half) {
    const calls = (frame) =>
        new Map(
            frame.poseOracle.calls.map((call) => [
                `${call.actor}:${call.sourceId}`,
                call,
            ]),
        );
    const preceding = calls(previous),
        following = calls(next);
    const middle = calls(half);
    const precedingActors = new Set(previous.actors.map(({ id }) => id));
    for (const key of preceding.keys())
        if (following.has(key))
            assert.ok(middle.has(key), `${key}: skipped midpoint pose helper`);
    const mixerActors = (frame) =>
        new Set(frame.poseOracle.mixers.map(({ actor }) => actor));
    const followingMixers = mixerActors(next),
        middleMixers = mixerActors(half);
    for (const actor of mixerActors(previous))
        if (followingMixers.has(actor))
            assert.ok(
                middleMixers.has(actor),
                `${actor}: skipped midpoint mixer`,
            );
    for (const call of half.poseOracle.calls) {
        const key = `${call.actor}:${call.sourceId}`;
        const left = preceding.get(key);
        const right = following.get(key);
        const start =
            left ?? (!precedingActors.has(call.actor) ? right : undefined);
        assert.ok(start, `${key}: unwitnessed midpoint pose target`);
        const expected = structuredClone(start.inputs);
        const name = call.sourceId.slice(call.sourceId.lastIndexOf(':') + 1);
        delete expected.delta;
        if ('now' in expected) expected.now = call.clock.time;
        if ('time' in expected) expected.time = call.clock.time;
        if (name === 'updateBirdLegPose')
            expected.walkElapsed = expected.walking
                ? expected.walkElapsed + half.time - previous.time
                : 0;
        if (
            delayedPoseFunctions.has(name) &&
            'walkDistance' in expected &&
            left &&
            right
        ) {
            const cycle =
                name === 'updateCowPose'
                    ? expected.behavior === 'trot' && expected.moving
                        ? 0.78
                        : 0.92
                    : {
                          updateChickenPose: 0.48,
                          updatePigletPose: 0.62,
                          updateGoatPose: 0.82,
                          updateSheepPose: 0.74,
                      }[name];
            let difference =
                right.inputs.walkDistance - left.inputs.walkDistance;
            if (difference < 0)
                difference =
                    ((((difference + cycle / 2) % cycle) + cycle) % cycle) -
                    cycle / 2;
            expected.walkDistance = left.inputs.walkDistance + difference / 2;
        }
        if (name === 'updateLadybugRig') {
            const sample = expected.__poseProgress;
            assert.ok(
                sample &&
                    Number.isFinite(sample.progress) &&
                    Number.isFinite(sample.at) &&
                    Number.isFinite(sample.duration) &&
                    sample.duration > 0,
                'Missing Ladybug fixed progress receipt',
            );
            expected.progress = Math.min(
                1,
                Math.max(
                    0,
                    sample.progress + (half.time - sample.at) / sample.duration,
                ),
            );
        }
        const actual = Object.fromEntries(
            Object.entries(call.inputs).filter(([key]) => key !== 'delta'),
        );
        coherentInputs(expected, actual, `${key}:midpoint discrete targets`);
    }
}

/** Candidate60 retains the30Hz event schedule; independent clones prove all render poses. */
export function compareFaunaRenderCadences(ambient, interactive) {
    assert.equal(ambient.fps, 30);
    assert.equal(interactive.fps, 60);
    assert.equal(ambient.scenario, interactive.scenario);
    assert.equal(
        interactive.frames.length,
        (ambient.frames.length - 1) * 2 + 1,
        'Cadence duration changed',
    );
    const metrics = {
        endpoints: 0,
        halfSteps: 0,
        movingSpecies: new Set(),
        maxEndpointError: 0,
        maxHalfStepError: 0,
    };
    for (let index = 0; index < ambient.frames.length; index++) {
        const frame = ambient.frames[index];
        const twice = interactive.frames[index * 2];
        assert.ok(twice, 'Missing60Hz endpoint');
        const counterparts = matchingActors(
            frame,
            twice,
            `${ambient.scenario}:${index}`,
        );
        comparePoseInputs(
            frame.poseOracle,
            twice.poseOracle,
            `${ambient.scenario}:${index}`,
        );
        coherentInputs(
            frame.poseOracle.presences,
            twice.poseOracle.presences,
            `${ambient.scenario}:${index}:presence targets`,
        );
        coherentInputs(
            frame.poseOracle.simulationSteps,
            twice.poseOracle.simulationSteps,
            `${ambient.scenario}:${index}:fixed schedule`,
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
            metrics.endpoints += 1;
        }
        const next = ambient.frames[index + 1];
        const half = interactive.frames[index * 2 + 1];
        if (!next || !half) continue;
        const nextActors = new Map(
            next.actors.map((actor) => [actor.id, actor]),
        );
        const permitted = new Set(
            [...frame.actors, ...next.actors].map(({ id }) => id),
        );
        for (const actor of half.actors)
            assert.ok(
                permitted.has(actor.id),
                `${actor.id}: unscheduled midpoint birth`,
            );
        for (const actor of frame.actors) {
            const end = nextActors.get(actor.id);
            if (!end) continue;
            const middle = half.actors.find(({ id }) => id === actor.id);
            assert.ok(middle, `${actor.id}: midpoint population loss`);
            assert.equal(
                middle.visible,
                actor.visible,
                `${actor.id}: visibility changed between fixed steps`,
            );
        }
        assert.equal(
            half.poseOracle.semanticWrites.length,
            0,
            'Authoritative joint writes occurred between fixed steps',
        );
        assert.equal(
            half.poseOracle.semanticInputs.length,
            0,
            'Authoritative pose targets changed between fixed steps',
        );
        assert.equal(
            half.poseOracle.presences.length,
            0,
            'Presence changed between fixed steps',
        );
        assert.equal(
            half.poseOracle.simulationSteps.length,
            0,
            'Fixed simulation ran between steps',
        );
        compareMidpointInputs(frame, next, half);
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
            if (travel < epsilon) continue;
            metrics.movingSpecies.add(actor.species);
            metrics.halfSteps += 1;
        }
    }
    compareActionPlans(ambient, interactive);
    const clipManifest = (capture) =>
        new Map(
            capture.frames
                .flatMap(({ poseOracle }) => poseOracle.clips)
                .map(({ actor, name, hash }) => [`${actor}:${name}`, hash]),
        );
    assert.deepEqual(
        [...clipManifest(ambient)].sort(),
        [...clipManifest(interactive)].sort(),
        'Candidate native clip manifest changed with render cadence',
    );
    const decisions = (capture) =>
        [...transitions(capture)]
            .map(([id, history]) => [
                id,
                history.map(({ signature }) => signature),
            ])
            .sort();
    assert.deepEqual(
        decisions(ambient),
        decisions(interactive),
        'Candidate decision/target path changed with render cadence',
    );
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

/** Preserve normative legacy30 populations/decisions/TQS; legacy60 is a measured cadence-drift witness. */
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
    const sources = (report) =>
        new Map(
            report.captures
                .flatMap(({ frames }) =>
                    frames.flatMap(({ poseOracle }) => poseOracle.sources),
                )
                .map((source) => [`${source.file}:${source.name}`, source]),
        );
    const originalSources = sources(baseline),
        currentSources = sources(candidate);
    assert.deepEqual(
        [...originalSources.keys()].sort(),
        [...currentSources.keys()].sort(),
        'Frozen pose function coverage changed',
    );
    for (const [id, source] of originalSources) {
        assert.equal(
            currentSources.get(id).referenceHash,
            source.referenceHash,
            `${id}: frozen pose body changed`,
        );
        assert.deepEqual(
            currentSources.get(id).helperHashes,
            source.helperHashes,
            `${id}: frozen pose helpers changed`,
        );
    }
    const clips = (report) =>
        new Map(
            report.captures
                .filter(({ fps }) => fps === 30)
                .flatMap(({ frames }) =>
                    frames.flatMap(({ poseOracle }) => poseOracle.clips),
                )
                .map(({ actor, name, hash }) => [`${actor}:${name}`, hash]),
        );
    assert.deepEqual(
        [...clips(baseline)].sort(),
        [...clips(candidate)].sort(),
        'Frozen native clip manifest changed',
    );
    const results = [];
    for (const old of baseline.captures.filter(
        (capture) => capture.fps === 30,
    )) {
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

/** Diagnostics only: legacy render-cadenced decisions are not a60Hz acceptance allowance. */
export function analyzeLegacyFaunaCadence(baseline) {
    validateFaunaTrajectoryReport(baseline);
    assert.equal(baseline.mode, 'baseline');
    return baseline.captures
        .filter(({ fps }) => fps === 30)
        .map((ambient) => {
            const interactive = baseline.captures.find(
                ({ scenario, fps }) =>
                    scenario === ambient.scenario && fps === 60,
            );
            let firstPopulationDifference = null,
                maxRootDrift = 0;
            for (const frame of ambient.frames) {
                const other = interactive.frames[frame.index * 2];
                assert.ok(other, 'Missing legacy cadence endpoint');
                const current = new Map(
                    other.actors.map((actor) => [actor.id, actor]),
                );
                const ids = frame.actors
                    .map(({ id, visible }) => `${id}:${visible}`)
                    .sort();
                const otherIds = other.actors
                    .map(({ id, visible }) => `${id}:${visible}`)
                    .sort();
                if (
                    !firstPopulationDifference &&
                    (JSON.stringify(frame.counts) !==
                        JSON.stringify(other.counts) ||
                        JSON.stringify(ids) !== JSON.stringify(otherIds))
                )
                    firstPopulationDifference = {
                        at: frame.time,
                        ambientCounts: frame.counts,
                        interactiveCounts: other.counts,
                        ambientIds: ids,
                        interactiveIds: otherIds,
                    };
                for (const actor of frame.actors) {
                    const counterpart = current.get(actor.id);
                    if (counterpart)
                        maxRootDrift = Math.max(
                            maxRootDrift,
                            distance(actor.position, counterpart.position),
                        );
                }
            }
            const left = transitions(ambient),
                right = transitions(interactive);
            let firstTargetDifference = null;
            for (const [id, history] of left) {
                const other = right.get(id) ?? [];
                for (
                    let index = 0;
                    index < Math.max(history.length, other.length);
                    index++
                ) {
                    const a = history[index],
                        b = other[index];
                    if (
                        a?.signature !== b?.signature ||
                        Math.abs((a?.at ?? 0) - (b?.at ?? 0)) > receiptPrecision
                    ) {
                        const difference = {
                            actor: id,
                            index,
                            ambient: a ?? null,
                            interactive: b ?? null,
                        };
                        if (
                            !firstTargetDifference ||
                            Math.min(a?.at ?? Infinity, b?.at ?? Infinity) <
                                Math.min(
                                    firstTargetDifference.ambient?.at ??
                                        Infinity,
                                    firstTargetDifference.interactive?.at ??
                                        Infinity,
                                )
                        )
                            firstTargetDifference = difference;
                        break;
                    }
                }
            }
            return {
                scenario: ambient.scenario,
                diagnosticOnly: true,
                maxRootDrift,
                firstPopulationDifference,
                firstTargetDifference,
            };
        });
}
