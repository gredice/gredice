import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    compareFaunaBaseline,
    compareFaunaRenderCadences,
    faunaWitnessSpecies,
    validateFaunaTrajectoryReport,
} from './fauna-trajectory-contract.mjs';

function capture(scenario, fps, mode) {
    const frames = Array.from({ length: fps * 20 + 1 }, (_, index) => {
        const time = index / fps;
        const presented =
            mode === 'baseline' ? time : Math.max(0, time - 1 / 30);
        return {
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
                phase: time < 10 ? 'idle' : 'moving',
                behavior: 'walk',
                targetId: 'home',
                updatedAt: time,
            })),
        };
    });
    return {
        scenario,
        fps,
        frames,
        suspension: {
            pass: true,
            scope: 'manual-replay',
            automaticHiddenAdvances: 0,
            hidden: { ...frames.at(-1), visible: false },
            resumed: {
                ...frames.at(-1),
                time: 20 + 1 / fps,
                submittedFrames: frames.length + 1,
            },
        },
    };
}
function report(mode) {
    return {
        schemaVersion: 1,
        mode,
        sourceCommit: 'a'.repeat(40),
        fixtureHash: 'b'.repeat(64),
        runtimeHash: 'd'.repeat(64),
        configHash: 'e'.repeat(64),
        environment: { browserProject: 'chromium-webgl' },
        captures: ['day', 'night', 'autumn-post-rain'].flatMap((scenario) =>
            [30, 60].map((fps) => capture(scenario, fps, mode)),
        ),
    };
}

test('accepts retained populations and the designed presentation latency', () => {
    const baseline = report('baseline');
    const candidate = report('candidate');
    assert.equal(compareFaunaBaseline(baseline, candidate).length, 6);
    assert.ok(
        compareFaunaRenderCadences(candidate.captures[0], candidate.captures[1])
            .halfSteps > 0,
    );
});

test('rejects reduced population, nonfinite transforms and missing GPU receipts', () => {
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

test('rejects different fixture provenance and changed actual behavior targets', () => {
    const baseline = report('baseline');
    const changedFixture = report('candidate');
    changedFixture.fixtureHash = 'c'.repeat(64);
    assert.throws(
        () => compareFaunaBaseline(baseline, changedFixture),
        /identical frozen fixture/,
    );
    const changedTarget = report('candidate');
    changedTarget.captures[0].frames[200].debug[0].targetId = 'different';
    assert.throws(
        () => compareFaunaBaseline(baseline, changedTarget),
        /behavior\/target path changed/,
    );
});

test('rejects endpoint drift and a stepped interactive presentation', () => {
    const candidate = report('candidate');
    candidate.captures[1].frames[40].actors[0].position[0] += 0.02;
    assert.throws(
        () =>
            compareFaunaRenderCadences(
                candidate.captures[0],
                candidate.captures[1],
            ),
        /endpoint drift|interpolation mismatch/,
    );
    const stepped = report('candidate');
    stepped.captures[1].frames[41].actors[0].position[0] =
        stepped.captures[1].frames[40].actors[0].position[0];
    assert.throws(
        () =>
            compareFaunaRenderCadences(
                stepped.captures[0],
                stepped.captures[1],
            ),
        /interpolation mismatch/,
    );
});

test('rejects a suspension report that replays hidden elapsed time', () => {
    const candidate = report('candidate');
    candidate.captures[0].suspension.resumed.time += 10;
    assert.throws(
        () => validateFaunaTrajectoryReport(candidate),
        /hidden backlog/,
    );
});

test('rejects incomplete capture matrices and nonfinite complete joints', () => {
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
test('rejects common wrong orientation, doubled scale and altered static joints', () => {
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
        for (const capture of candidate.captures)
            for (const frame of capture.frames) alter(frame.actors[0]);
        assert.throws(
            () => compareFaunaBaseline(baseline, candidate),
            /orientation changed|scale changed|pose drift/,
        );
    }
});

test('rejects stationary joint drift even when a later phase moves quickly', () => {
    const baseline = report('baseline');
    const candidate = report('candidate');
    for (const trace of [...baseline.captures, ...candidate.captures])
        for (const frame of trace.frames) {
            const joint = frame.actors[0].pose[0];
            joint.position[0] = Math.max(0, frame.time - 10);
            if (candidate.captures.includes(trace)) joint.position[0] += 0.01;
        }
    assert.throws(
        () => compareFaunaBaseline(baseline, candidate),
        /pose drift/,
    );
});

test('attributes inherited cadence per signed channel instead of a norm allowance', () => {
    const baseline = report('baseline');
    const candidate = report('candidate');
    const old30 = baseline.captures[0],
        old60 = baseline.captures[1];
    const new30 = candidate.captures[0],
        new60 = candidate.captures[1];
    for (const trace of [old60, new60])
        for (const frame of trace.frames)
            frame.actors[0].pose[0].position = [0.001, 0, 0];
    assert.ok(
        compareFaunaRenderCadences(new30, new60, {
            ambient: old30,
            interactive: old60,
        }).endpoints > 0,
    );
    for (const offset of [
        [0, 0.001, 0],
        [-0.001, 0, 0],
    ]) {
        for (const frame of new60.frames)
            frame.actors[0].pose[0].position = offset;
        assert.throws(
            () =>
                compareFaunaRenderCadences(new30, new60, {
                    ambient: old30,
                    interactive: old60,
                }),
            /signed pose drift/,
        );
    }
});

test('preserves quaternion-sign equivalent inherited cadence residuals', () => {
    const baseline = report('baseline'),
        candidate = report('candidate');
    const old30 = baseline.captures[0],
        old60 = baseline.captures[1];
    const new30 = candidate.captures[0],
        new60 = candidate.captures[1];
    for (const trace of [old60, new60])
        for (const frame of trace.frames)
            frame.actors[0].pose[0].quaternion = [
                0,
                Math.sin(0.001),
                0,
                Math.cos(0.001),
            ];
    for (const trace of [new30, new60])
        for (const frame of trace.frames)
            frame.actors[0].pose[0].quaternion =
                frame.actors[0].pose[0].quaternion.map((value) => -value);
    assert.ok(
        compareFaunaRenderCadences(new30, new60, {
            ambient: old30,
            interactive: old60,
        }).endpoints > 0,
    );
});
