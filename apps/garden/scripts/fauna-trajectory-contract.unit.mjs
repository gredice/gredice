import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import {
    analyzeLegacyFaunaCadence,
    compareFaunaBaseline,
    compareFaunaRenderCadences,
    faunaWitnessSpecies,
    validateFaunaTrajectoryReport,
} from './fauna-trajectory-contract.mjs';

const referenceCommit = '54278326213053ce318c7ea071c8bb94cb6d5257';
const manualSources = [
    ['updateCowPose', 'Cow'],
    ['updateChickenPose', 'Chicken'],
    ['updateGoatPose', 'Goat'],
    ['updatePigletPose', 'Piglet'],
    ['updateSheepPose', 'Sheep'],
    ['updateBirdLegPose', 'Bird'],
    ['updateGroundPeckPose', 'Bird'],
    ['updateDogWalkPose', 'Dog'],
    ['animateRabbitRig', 'Rabbit'],
    ['updateBeeRig', 'Bee'],
    ['updateButterflyRig', 'Butterfly'],
    ['updateLadybugRig', 'Ladybug'],
    ['updateRig', 'Slug'],
].map(([name, species]) => ({
    file: `packages/game/src/entities/${name}.tsx`,
    name,
    species,
    referenceCommit,
    referenceHash: '1'.repeat(64),
    actualHash: '1'.repeat(64),
    helperHashes: { shared: '2'.repeat(64) },
}));
const delayed = new Set(manualSources.slice(0, 5).map(({ name }) => name));
const sourceId = ({ file, name }) => `${file}:${name}`;
function bindPose(frame) {
    frame.poseOracle.poseHash = createHash('sha256')
        .update(
            JSON.stringify(frame.actors.map(({ id, pose }) => ({ id, pose }))),
        )
        .digest('hex');
    frame.poseOracle.checkedPoses = frame.actors.flatMap(({ id, pose }) =>
        pose.map(({ name }) => ({ actor: id, node: name })),
    );
    frame.poseOracle.checks = frame.poseOracle.checkedPoses.length * 3;
}
function oracle(frame, fps, mode, resume = false) {
    const delta = frame.index === 0 ? 0 : 1 / fps;
    const fixedTime =
        mode === 'candidate'
            ? Math.floor(frame.time * 30 + 1e-8) / 30
            : frame.time;
    const result = {
        pass: true,
        checks: 0,
        maxError: 0,
        checkedPoses: [],
        poseHash: '',
        sources:
            frame.index === 0
                ? manualSources.map(({ species, ...source }) =>
                      structuredClone(source),
                  )
                : [],
        clips:
            frame.index === 0
                ? [{ actor: 'Cat:0', name: 'Walk', hash: '3'.repeat(64) }]
                : [],
        calls: manualSources.map((source) => {
            const presentation =
                mode === 'candidate' && delayed.has(source.name);
            const anchor = presentation && resume ? frame.time : 0;
            const time = presentation
                ? Math.max(anchor, frame.time - 1 / 30)
                : frame.time;
            const previousTime = presentation
                ? Math.max(anchor, frame.time - delta - 1 / 30)
                : frame.time - delta;
            const poseDelta =
                presentation && Math.abs(anchor - frame.time) < 1e-9
                    ? Math.min(1 / 30, delta)
                    : Math.min(
                          presentation ? 0.064 : Infinity,
                          Math.max(0, time - previousTime),
                      );
            const inputs = {
                now: time,
                delta: poseDelta,
                behavior: 'walk',
                moving: true,
                seed: 1,
                target: { id: 'home' },
            };
            if (delayed.has(source.name)) inputs.walkDistance = time;
            if (source.name === 'updateBirdLegPose') {
                inputs.walking = true;
                inputs.walkElapsed = frame.time;
            }
            if (source.name === 'updateLadybugRig') {
                const at = mode === 'candidate' ? fixedTime : frame.time;
                inputs.__poseProgress = { progress: 0.2, at, duration: 100 };
                inputs.progress = Math.min(
                    1,
                    Math.max(0, 0.2 + (frame.time - at) / 100),
                );
            }
            return {
                actor: `${source.species}:0`,
                sourceId: sourceId(source),
                inputs,
                clock: {
                    policy: presentation ? 'presentation' : 'render',
                    anchor,
                    time,
                    delta: poseDelta,
                },
            };
        }),
        mixers: [{ actor: 'Cat:0', delta, time: frame.time }],
        commands:
            frame.index === 0
                ? [
                      {
                          actor: 'Cat:0',
                          clip: 'Walk',
                          method: 'setLoop',
                          args: [2201, { number: 'Infinity' }],
                          at: 0,
                      },
                  ]
                : [],
        semanticWrites: [],
        semanticInputs: [],
        presences:
            mode === 'baseline' || fps === 30 || frame.index % 2 === 0 || resume
                ? [
                      {
                          id: 'Cow:0',
                          species: 'Cow',
                          behavior: 'walk',
                          position: { x: frame.time, y: 0, z: 0 },
                          updatedAt: frame.time,
                      },
                  ]
                : [],
        simulationSteps:
            mode === 'candidate' &&
            (fps === 30 || frame.index % 2 === 0 || resume)
                ? [
                      {
                          now: frame.time,
                          delta:
                              frame.index === 0 ? 0 : resume ? delta : 1 / 30,
                      },
                  ]
                : [],
    };
    return result;
}
function capture(scenario, fps, mode) {
    const frames = Array.from({ length: fps * 20 + 1 }, (_, index) => {
        const time = index / fps;
        const presented =
            mode === 'baseline' ? time : Math.max(0, time - 1 / 30);
        const fixedTime =
            mode === 'baseline' ? time : Math.floor(time * 30 + 1e-8) / 30;
        const frame = {
            index,
            time,
            visible: true,
            submittedFrames: index + 1,
            counts: Object.fromEntries(
                faunaWitnessSpecies.map((species) => [species, 1]),
            ),
            actors: faunaWitnessSpecies.map((species) => ({
                id: `${species}:0`,
                species,
                visible: true,
                position: [presented, 0, 0],
                quaternion: [0, 0, 0, 1],
                scale: [1, 1, 1],
                pose: [
                    {
                        name: '@model',
                        position: [0, 0, 0],
                        quaternion: [0, 0, 0, 1],
                        scale: [1, 1, 1],
                    },
                ],
            })),
            debug: faunaWitnessSpecies.map((species) => ({
                id: `${species}:0`,
                species,
                phase: fixedTime < 10 ? 'idle' : 'moving',
                behavior: 'walk',
                targetId: 'home',
                updatedAt: fixedTime,
            })),
        };
        frame.poseOracle = oracle(frame, fps, mode);
        bindPose(frame);
        return frame;
    });
    const resumed = structuredClone(frames.at(-1));
    resumed.index += 1;
    resumed.time += 1 / fps;
    resumed.submittedFrames += 1;
    resumed.poseOracle = oracle(resumed, fps, mode, true);
    bindPose(resumed);
    return {
        scenario,
        fps,
        frames,
        suspension: {
            pass: true,
            scope: 'manual-replay',
            automaticHiddenAdvances: 0,
            hidden: { ...frames.at(-1), visible: false },
            resumed,
        },
    };
}
function report(mode) {
    return {
        schemaVersion: 1,
        mode,
        sourceCommit: mode === 'baseline' ? referenceCommit : 'a'.repeat(40),
        fixtureHash: 'b'.repeat(64),
        runtimeHash: 'd'.repeat(64),
        configHash: 'e'.repeat(64),
        environment: { browserProject: 'chromium-webgl' },
        captures: ['day', 'night', 'autumn-post-rain'].flatMap((scenario) =>
            [30, 60].map((fps) => capture(scenario, fps, mode)),
        ),
    };
}
function rebind(report) {
    for (const trace of report.captures) {
        for (const frame of trace.frames) bindPose(frame);
        trace.suspension.hidden.actors = trace.frames.at(-1).actors;
        bindPose(trace.suspension.resumed);
    }
    return report;
}
const cadences = (candidate) =>
    compareFaunaRenderCadences(candidate.captures[0], candidate.captures[1]);

test('accepts all three normative legacy30 traces and independently clocked candidate60', () => {
    const baseline = report('baseline'),
        candidate = report('candidate');
    assert.equal(compareFaunaBaseline(baseline, candidate).length, 3);
    assert.ok(cadences(candidate).halfSteps > 0);
});

test('compensates only one local startup pose step and rejects a second delay or new axis', () => {
    const baseline = report('baseline'),
        candidate = report('candidate');
    for (const old of baseline.captures) {
        let angle = 0;
        for (const frame of old.frames) {
            if (frame.index > 0) {
                const target = Math.sin(frame.time * 5.7 + 2.2) * 0.025;
                angle += (target - angle) * (1 - Math.exp(-8 / old.fps));
            }
            frame.actors[0].pose[0].quaternion = [
                0,
                0,
                Math.sin(angle / 2),
                Math.cos(angle / 2),
            ];
        }
        const current = candidate.captures.find(
            (trace) => trace.scenario === old.scenario && trace.fps === old.fps,
        );
        for (const frame of current.frames)
            frame.actors[0].pose[0].quaternion = [
                ...old.frames[Math.max(0, frame.index - old.fps / 30)].actors[0]
                    .pose[0].quaternion,
            ];
    }
    rebind(baseline);
    rebind(candidate);
    assert.equal(compareFaunaBaseline(baseline, candidate).length, 3);
    const newAxis = structuredClone(candidate);
    newAxis.captures[0].frames[1].actors[0].pose[0].position[1] = 0.001;
    rebind(newAxis);
    assert.throws(() => compareFaunaBaseline(baseline, newAxis), /pose drift/);
    const extraStep = structuredClone(candidate);
    for (const current of extraStep.captures) {
        const old = baseline.captures.find(
            (trace) =>
                trace.scenario === current.scenario &&
                trace.fps === current.fps,
        );
        for (const frame of current.frames)
            frame.actors[0].pose[0].quaternion = [
                ...old.frames[Math.max(0, frame.index - (2 * old.fps) / 30)]
                    .actors[0].pose[0].quaternion,
            ];
    }
    rebind(extraStep);
    assert.throws(
        () => compareFaunaBaseline(baseline, extraStep),
        /pose drift/,
    );
});

test('rejects reduced population, nonfinite roots and missing submitted-frame receipts', () => {
    for (const alter of [
        (frame) => {
            frame.counts.Cow = 0;
        },
        (frame) => {
            frame.actors[0].position[0] = Number.NaN;
        },
        (frame) => {
            frame.submittedFrames = 1;
        },
    ]) {
        const candidate = report('candidate');
        alter(candidate.captures[0].frames[1]);
        assert.throws(() => validateFaunaTrajectoryReport(candidate));
    }
});

test('rejects changed frozen fixture/source provenance and actual behavior targets', () => {
    const baseline = report('baseline');
    const changed = report('candidate');
    changed.fixtureHash = 'c'.repeat(64);
    assert.throws(
        () => compareFaunaBaseline(baseline, changed),
        /identical frozen fixture/,
    );
    const source = report('baseline');
    source.sourceCommit = 'a'.repeat(40);
    assert.throws(
        () => validateFaunaTrajectoryReport(source),
        /frozen reference/,
    );
    const target = report('candidate');
    target.captures[0].frames[200].debug[0].targetId = 'different';
    assert.throws(
        () => compareFaunaBaseline(baseline, target),
        /behavior\/target path changed/,
    );
});

test('rejects endpoint drift, stepped roots and stationary midpoint-only drift', () => {
    for (const alter of [
        (frames) => {
            frames[40].actors[0].position[0] += 0.02;
        },
        (frames) => {
            frames[41].actors[0].position[0] = frames[40].actors[0].position[0];
        },
    ]) {
        const candidate = report('candidate');
        alter(candidate.captures[1].frames);
        assert.throws(
            () => cadences(candidate),
            /endpoint drift|interpolation mismatch/,
        );
    }
    const stationary = report('candidate');
    for (const trace of stationary.captures)
        for (const frame of trace.frames) frame.actors[0].position = [0, 0, 0];
    stationary.captures[1].frames[41].actors[0].position[1] = 0.001;
    assert.throws(() => cadences(stationary), /interpolation mismatch/);
});

test('rejects backlog replay, resumed oracle failure and hidden automatic work', () => {
    for (const alter of [
        (suspension) => {
            suspension.resumed.time += 10;
        },
        (suspension) => {
            suspension.resumed.poseOracle.pass = false;
        },
        (suspension) => {
            suspension.automaticHiddenAdvances = 1;
        },
    ]) {
        const candidate = report('candidate');
        alter(candidate.captures[0].suspension);
        assert.throws(() => validateFaunaTrajectoryReport(candidate));
    }
});

test('rejects incomplete grid and finite-checks every joint channel before hashing', () => {
    const duplicate = report('candidate');
    duplicate.captures = [
        duplicate.captures[0],
        duplicate.captures[0],
        duplicate.captures[0],
    ];
    assert.throws(
        () => validateFaunaTrajectoryReport(duplicate),
        /Exact scenario\/cadence/,
    );
    for (const key of ['position', 'quaternion', 'scale']) {
        const invalid = report('candidate');
        invalid.captures[0].frames[1].actors[0].pose[0][key][0] = Number.NaN;
        assert.throws(
            () => validateFaunaTrajectoryReport(invalid),
            /Nonfinite/,
        );
    }
});

test('rejects common pi yaw, doubled scale and altered static joints even with matching digests', () => {
    const baseline = report('baseline');
    for (const alter of [
        (actor) => {
            actor.quaternion = [0, 1, 0, 0];
        },
        (actor) => {
            actor.scale = [2, 2, 2];
        },
        (actor) => {
            actor.pose[0].quaternion = [0, 1, 0, 0];
        },
        (actor) => {
            actor.pose[0].position = [1, 0, 0];
        },
        (actor) => {
            actor.pose[0].scale = [2, 2, 2];
        },
    ]) {
        const candidate = report('candidate');
        for (const trace of candidate.captures)
            for (const frame of trace.frames) alter(frame.actors[0]);
        rebind(candidate);
        assert.throws(
            () => compareFaunaBaseline(baseline, candidate),
            /orientation changed|scale changed|pose drift/,
        );
    }
});

test('rejects stationary drift despite later fast motion without a global pose budget', () => {
    const baseline = report('baseline'),
        candidate = report('candidate');
    for (const trace of [...baseline.captures, ...candidate.captures])
        for (const frame of trace.frames) {
            frame.actors[0].pose[0].position[0] =
                Math.max(0, frame.time - 10) +
                (candidate.captures.includes(trace) ? 0.01 : 0);
        }
    rebind(baseline);
    rebind(candidate);
    assert.throws(
        () => compareFaunaBaseline(baseline, candidate),
        /pose drift/,
    );
});

test('accepts orientation-equivalent quaternion signs without channel allowances', () => {
    const baseline = report('baseline'),
        candidate = report('candidate');
    for (const trace of candidate.captures)
        for (const frame of trace.frames) {
            frame.actors[0].quaternion = frame.actors[0].quaternion.map(
                (value) => -value,
            );
            frame.actors[0].pose[0].quaternion =
                frame.actors[0].pose[0].quaternion.map((value) => -value);
        }
    rebind(candidate);
    assert.equal(compareFaunaBaseline(baseline, candidate).length, 3);
    assert.ok(cadences(candidate).endpoints > 0);
});

test('rejects forged digest, omitted rig coverage, missing channels and nonfinite oracle residual', () => {
    for (const alter of [
        (frame) => {
            frame.actors[0].pose[0].position[0] += 0.001;
        },
        (frame) => {
            frame.poseOracle.checkedPoses.shift();
        },
        (frame) => {
            frame.poseOracle.checks = 1;
        },
        (frame) => {
            frame.poseOracle.maxError = Number.NaN;
        },
    ]) {
        const candidate = report('candidate');
        alter(candidate.captures[0].frames[1]);
        assert.throws(
            () => validateFaunaTrajectoryReport(candidate),
            /receipt mismatch|Unchecked complete pose|omitted transform|precision/,
        );
    }
});

test('rejects phase, rate, anchor and fixed-schedule counterexamples independently of poses', () => {
    for (const alter of [
        (frame) => {
            frame.poseOracle.calls[0].inputs.now += 0.01;
        },
        (frame) => {
            frame.poseOracle.calls[0].inputs.delta += 0.01;
        },
        (frame) => {
            frame.poseOracle.calls[0].clock.time += 0.01;
        },
        (frame) => {
            frame.poseOracle.calls[0].clock.anchor = 1 / 30;
        },
        (frame) => {
            frame.poseOracle.mixers[0].delta *= 2;
        },
        (frame) => {
            frame.poseOracle.mixers[0].time += 0.01;
        },
        (frame) => {
            frame.poseOracle.simulationSteps[0].delta = 1 / 60;
        },
    ]) {
        const candidate = report('candidate');
        alter(candidate.captures[0].frames[2]);
        assert.throws(
            () => validateFaunaTrajectoryReport(candidate),
            /phase changed|rate changed|anchor changed|accumulated clock changed|delta changed/,
        );
    }
    const extra = report('candidate');
    extra.captures[1].frames[1].poseOracle.simulationSteps.push({
        now: 1 / 60,
        delta: 1 / 60,
    });
    assert.throws(
        () => validateFaunaTrajectoryReport(extra),
        /simulation rate changed/,
    );
});

test('rejects wrong endpoint and midpoint discrete targets, presence and action commands', () => {
    for (const alter of [
        (frame) => {
            frame.poseOracle.calls[9].inputs.target.id = 'different';
        },
        (frame) => {
            frame.poseOracle.calls[0].inputs.behavior = 'trot';
        },
        (frame) => {
            frame.poseOracle.presences.push({
                id: 'Cow:0',
                species: 'Cow',
                behavior: 'eat',
                position: { x: 0, y: 0, z: 0 },
                updatedAt: frame.time,
            });
        },
        (frame) => {
            frame.poseOracle.commands.push({
                actor: 'Cat:0',
                clip: 'Walk',
                method: 'stop',
                args: [],
                at: frame.time,
            });
        },
        (frame) => {
            frame.poseOracle.calls.pop();
        },
        (frame) => {
            frame.poseOracle.mixers = [];
        },
    ]) {
        const candidate = report('candidate');
        alter(candidate.captures[1].frames[41]);
        assert.throws(
            () => cadences(candidate),
            /midpoint discrete targets|Presence changed|native action targets|skipped midpoint/,
        );
    }
    const endpoint = report('candidate');
    endpoint.captures[1].frames[40].poseOracle.calls[9].inputs.target.id =
        'different';
    assert.throws(() => cadences(endpoint), /pose targets/);
});

test('rejects changed frozen source/helper/clip manifests and missing manual source coverage', () => {
    const baseline = report('baseline');
    for (const alter of [
        (receipt) => {
            receipt.sources[0].referenceHash = '4'.repeat(64);
            receipt.sources[0].actualHash = '4'.repeat(64);
        },
        (receipt) => {
            receipt.sources[0].helperHashes.shared = '4'.repeat(64);
        },
        (receipt) => {
            receipt.clips[0].hash = '4'.repeat(64);
        },
    ]) {
        const candidate = report('candidate');
        for (const trace of candidate.captures)
            alter(trace.frames[0].poseOracle);
        assert.throws(
            () => compareFaunaBaseline(baseline, candidate),
            /frozen pose body changed|frozen pose helpers changed|clip manifest changed/,
        );
    }
    const omitted = report('candidate');
    for (const trace of omitted.captures) {
        trace.frames[0].poseOracle.sources.pop();
        for (const frame of [...trace.frames, trace.suspension.resumed])
            frame.poseOracle.calls.pop();
    }
    assert.throws(
        () => validateFaunaTrajectoryReport(omitted),
        /Every frozen manual pose source/,
    );
});

test('records legacy60 population/target/root drift only as a measured diagnostic', () => {
    const baseline = report('baseline');
    const old60 = baseline.captures[1];
    for (const frame of old60.frames.slice(200)) {
        frame.actors[0].position[0] += 0.2;
        frame.debug[0].targetId = 'legacy-cadence-target';
    }
    old60.frames[220].actors[0].visible = false;
    old60.frames[220].counts.Cow = 0;
    const diagnostic = analyzeLegacyFaunaCadence(baseline)[0];
    assert.equal(diagnostic.diagnosticOnly, true);
    assert.ok(diagnostic.maxRootDrift > 0.19);
    assert.equal(diagnostic.firstPopulationDifference.at, 220 / 60);
    assert.equal(diagnostic.firstTargetDifference.actor, 'Cow:0');
    assert.equal(compareFaunaBaseline(baseline, report('candidate')).length, 3);
});

test('rejects native action changes shared by candidate30 and60 against normative legacy30', () => {
    const baseline = report('baseline');
    for (const alter of [
        (command) => {
            command.method = 'stop';
        },
        (command) => {
            command.args = [2201, 1];
        },
        (command) => {
            command.at = -1 / 30;
        },
    ]) {
        const candidate = report('candidate');
        for (const trace of candidate.captures)
            alter(trace.frames[0].poseOracle.commands[0]);
        // Same-cadence agreement alone would authorize this common change.
        assert.ok(cadences(candidate).endpoints > 0);
        assert.throws(
            () => compareFaunaBaseline(baseline, candidate),
            /native action targets|receipt was delayed/,
        );
    }
});

test('rejects common candidate pose intents that cadence agreement and matching transforms cannot prove', () => {
    const baseline = report('baseline');
    for (const sourceIndex of [0, 9]) {
        const candidate = report('candidate');
        for (const trace of candidate.captures)
            for (const frame of trace.frames)
                frame.poseOracle.calls[sourceIndex].inputs.target.id =
                    'common-changed-target';
        assert.ok(cadences(candidate).endpoints > 0);
        assert.throws(
            () => compareFaunaBaseline(baseline, candidate),
            /normative pose intent/,
        );
    }
});

test('names uncomputed culled legacy input coverage without inventing values or waiving observed mismatches', () => {
    const baseline = report('baseline'),
        candidate = report('candidate');
    baseline.captures[0].frames[0].poseOracle.calls.shift();
    const result = compareFaunaBaseline(baseline, candidate);
    assert.equal(result[0].unobservedLegacyCullingInputs, 2);
    assert.ok(result[0].executedPoseIntents > 0);
    candidate.captures[0].frames[2].poseOracle.calls[0].inputs.behavior =
        'trot';
    assert.throws(
        () => compareFaunaBaseline(baseline, candidate),
        /normative pose intent/,
    );
});

test('source registration without actual helper invocation cannot prove frozen math coverage', () => {
    const candidate = report('candidate');
    for (const trace of candidate.captures)
        for (const frame of [...trace.frames, trace.suspension.resumed])
            frame.poseOracle.calls.pop();
    assert.throws(
        () => validateFaunaTrajectoryReport(candidate),
        /execute actual math/,
    );
});
