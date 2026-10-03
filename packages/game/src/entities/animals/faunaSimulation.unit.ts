import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    AnimationClip,
    AnimationMixer,
    Group,
    MathUtils,
    NumberKeyframeTrack,
} from 'three';
import {
    createFaunaPresentationSample,
    createFaunaSimulation,
    createFaunaWalkDistance,
    faunaSimulationStepSeconds,
} from './faunaSimulation';

describe('retained per-root fauna simulation', () => {
    it('aligns resumed and restarted paths across root, gait and pose samples', () => {
        const runtime = createFaunaSimulation<null>();
        const actor = new Group();
        const gait = createFaunaWalkDistance(runtime.getInterpolationAlpha);
        const sample = createFaunaPresentationSample(
            runtime.getInterpolationAlpha,
        );
        let pathDistance = 0;
        runtime.register(
            (_, frame) => {
                actor.position.x = frame.now;
                const snapped = sample.set({ moving: true }, frame.now);
                gait.set(pathDistance, snapped);
            },
            () => actor,
        );
        for (let index = 0; index <= 2; index++) {
            pathDistance = index / 30;
            runtime.advance(null, {
                now: index / 30,
                delta: index ? 1 / 30 : 0,
            });
            assert.equal(sample.get(1 / 30)?.time, actor.position.x);
            assert.equal(gait.get(1), actor.position.x);
        }
        runtime.resume();
        sample.resume();
        gait.resume();
        pathDistance = 3 / 30;
        runtime.advance(null, { now: 3 / 30, delta: 1 / 30 });
        assert.equal(actor.position.x, 3 / 30);
        assert.equal(gait.get(1), actor.position.x);
        assert.equal(sample.get(1 / 30)?.time, actor.position.x);
        pathDistance = 0;
        runtime.advance(null, { now: 4 / 30, delta: 1 / 30 });
        assert.equal(actor.position.x, 3 / 30);
        assert.equal(gait.get(1), 3 / 30);
        assert.equal(sample.get(1 / 30)?.time, actor.position.x);
    });
    it('keeps pose time and transition inputs coherent on mount, reset and resume', () => {
        let alpha = 0;
        const sample = createFaunaPresentationSample<string>(() => alpha);
        assert.equal(sample.get(1 / 60), null);
        sample.set('idle', 0);
        assert.deepEqual(sample.get(0), { value: 'idle', time: 0, delta: 0 });
        sample.set('moving', 1 / 30);
        assert.deepEqual(sample.get(1 / 30), {
            value: 'idle',
            time: 0,
            delta: 0,
        });
        alpha = 0.5;
        assert.deepEqual(sample.get(1 / 60), {
            value: 'idle',
            time: 1 / 60,
            delta: 1 / 60,
        });
        alpha = 0;
        sample.set('settled', 2 / 30);
        assert.deepEqual(sample.get(1 / 60), {
            value: 'moving',
            time: 1 / 30,
            delta: 1 / 60,
        });
        sample.resume();
        sample.set('resumed', 100);
        assert.deepEqual(sample.get(1 / 60), {
            value: 'resumed',
            time: 100,
            delta: 1 / 60,
        });
        sample.set('placed', 100 + 1 / 30, true);
        assert.equal(sample.get(1 / 30)?.value, 'placed');
        sample.set('clock-reset', 0);
        assert.deepEqual(sample.get(0), {
            value: 'clock-reset',
            time: 0,
            delta: 0,
        });
    });

    it('presents the exact prior legacy damped breathing and gait at 30 and 60 Hz', () => {
        for (const fps of [30, 60]) {
            const runtime = createFaunaSimulation<null>();
            const actor = new Group();
            const gait = createFaunaWalkDistance(runtime.getInterpolationAlpha);
            const sample = createFaunaPresentationSample(
                runtime.getInterpolationAlpha,
            );
            runtime.register(
                (_, frame) => {
                    actor.position.x = frame.now;
                    gait.set(frame.now);
                    sample.set(null, frame.now);
                },
                () => actor,
            );
            let posed = 0;
            runtime.registerRender((_, frame) => {
                const presentation = sample.get(frame.delta);
                if (!presentation) return;
                posed = MathUtils.damp(
                    posed,
                    Math.sin(presentation.time * 1.15) * 0.012 +
                        Math.sin(gait.get() * Math.PI * 2) * 0.022,
                    11,
                    presentation.delta,
                );
            });
            let legacy = 0;
            const old: number[] = [];
            for (let index = 0; index <= fps; index++) {
                const now = index / fps;
                const delta = index === 0 ? 0 : 1 / fps;
                legacy = MathUtils.damp(
                    legacy,
                    Math.sin(now * 1.15) * 0.012 +
                        Math.sin(now * Math.PI * 2) * 0.022,
                    11,
                    delta,
                );
                old.push(legacy);
                runtime.advance(null, { now, delta });
                assert.ok(
                    Math.abs(posed - old[Math.max(0, index - fps / 30)]) <
                        1e-10,
                );
            }
        }
    });
    it('orders real initial and late mixers before every manual pose and cleans remounts', () => {
        const runtime = createFaunaSimulation<null>();
        const bone = new Group();
        const clip = new AnimationClip('walk', 1, [
            new NumberKeyframeTrack('.rotation[y]', [0, 1], [1, 1]),
        ]);
        const first = new AnimationMixer(bone);
        first.clipAction(clip).play();
        const removeFirst = runtime.registerAnimation((_, frame) =>
            first.update(frame.delta),
        );
        runtime.registerRender(() => {
            assert.equal(bone.rotation.y, 1);
            bone.rotation.y = 2;
        });
        runtime.advance(null, { delta: 1 / 60, now: 0 });
        assert.equal(bone.rotation.y, 2);
        const late = new AnimationMixer(bone);
        late.clipAction(clip).play();
        const removeLate = runtime.registerAnimation((_, frame) =>
            late.update(frame.delta),
        );
        runtime.advance(null, { delta: 1 / 60, now: 1 / 60 });
        assert.equal(bone.rotation.y, 2);
        removeFirst();
        first.stopAllAction();
        first.uncacheRoot(bone);
        removeLate();
        late.stopAllAction();
        late.uncacheRoot(bone);
        const remounted = new AnimationMixer(bone);
        remounted.clipAction(clip).play();
        const removeRemount = runtime.registerAnimation((_, frame) =>
            remounted.update(frame.delta),
        );
        runtime.advance(null, { delta: 1 / 60, now: 2 / 60 });
        assert.equal(bone.rotation.y, 2);
        removeRemount();
        assert.equal(runtime.getStats().animationCallbacks, 0);
    });

    it('interpolates gait with root movement and snaps a restarted path', () => {
        const runtime = createFaunaSimulation<null>();
        const actor = new Group();
        const gait = createFaunaWalkDistance(runtime.getInterpolationAlpha);
        runtime.register(
            (_, { delta }) => {
                actor.position.x += delta;
                gait.set(actor.position.x);
            },
            () => actor,
        );
        for (let frame = 0; frame <= 8; frame++) {
            runtime.advance(null, {
                delta: frame === 0 ? 0 : 1 / 60,
                now: frame / 60,
            });
            assert.ok(Math.abs(gait.get() - actor.position.x) < 1e-10);
        }
        gait.set(0);
        assert.ok(gait.get() >= 0);
        gait.set(0, true);
        assert.equal(gait.get(), 0);
    });
    it('runs the same fixed steps at 30 and 60 render FPS and keeps visual cadence', () => {
        function capture(fps: number) {
            const runtime = createFaunaSimulation<null>();
            const steps: { delta: number; now: number }[] = [];
            let renders = 0;
            runtime.register((_, frame) => steps.push(frame));
            runtime.registerRender(() => renders++);
            for (let frame = 0; frame <= fps * 4; frame++) {
                runtime.advance(null, {
                    delta: frame === 0 ? 0 : 1 / fps,
                    now: frame / fps,
                });
            }
            return { steps, renders };
        }
        const ambient = capture(30);
        const interactive = capture(60);
        assert.deepEqual(interactive.steps, ambient.steps);
        assert.equal(ambient.steps.length, 121);
        assert.equal(ambient.renders, 121);
        assert.equal(interactive.renders, 241);
    });

    it('interpolates transforms without letting interpolation feed movement inputs', () => {
        const runtime = createFaunaSimulation<null>();
        const actor = new Group();
        const inputs: number[] = [];
        runtime.register(
            (_, { delta }) => {
                inputs.push(actor.position.x);
                actor.position.x += delta;
                actor.rotation.y += delta;
            },
            () => actor,
        );
        const rendered: number[] = [];
        for (let frame = 0; frame <= 8; frame++) {
            runtime.advance(null, {
                delta: frame === 0 ? 0 : 1 / 60,
                now: frame / 60,
            });
            rendered.push(actor.position.x);
        }
        assert.deepEqual(inputs, [0, 0, 1 / 30, 2 / 30, 3 / 30]);
        assert.equal(rendered[1], 0);
        assert.ok(Math.abs(rendered[3] - 1 / 60) < 1e-10);
        assert.ok(
            rendered.every(
                (value, index) => index === 0 || value >= rendered[index - 1],
            ),
        );
        assert.ok(Math.abs(actor.position.x - 3 / 30) < 1e-10);
    });

    it('keeps render-only root pose writes separate from authoritative simulation', () => {
        const runtime = createFaunaSimulation<null>();
        const actor = new Group();
        const inputs: number[] = [];
        runtime.register(
            (_, { delta }) => {
                inputs.push(actor.position.y);
                actor.position.y += delta;
            },
            () => actor,
        );
        runtime.registerRender(() => {
            actor.position.y += 0.5;
        });
        runtime.advance(null, { delta: 0, now: 0 });
        runtime.advance(null, { delta: 1 / 30, now: 1 / 30 });
        runtime.advance(null, { delta: 1 / 30, now: 2 / 30 });
        assert.deepEqual(inputs, [0, 0, 1 / 30]);
    });

    it('retains yaw-only Euler semantics through interpolated turns beyond π/2', () => {
        for (const fps of [30, 60]) {
            const runtime = createFaunaSimulation<null>();
            const actor = new Group();
            actor.rotation.y = Math.PI;
            const inputs: number[][] = [];
            runtime.register(
                (_, { delta }) => {
                    inputs.push([
                        actor.rotation.x,
                        actor.rotation.y,
                        actor.rotation.z,
                    ]);
                    actor.rotation.y -= delta;
                },
                () => actor,
            );
            for (let frame = 0; frame <= fps; frame++)
                runtime.advance(null, {
                    delta: frame === 0 ? 0 : 1 / fps,
                    now: frame / fps,
                });
            assert.equal(inputs.length, 31);
            for (let step = 0; step < inputs.length; step++) {
                assert.equal(inputs[step][0], 0);
                assert.equal(inputs[step][2], 0);
                assert.ok(
                    Math.abs(
                        inputs[step][1] -
                            (Math.PI - Math.max(0, step - 1) / 30),
                    ) < 1e-10,
                );
            }
        }
    });

    it('accepts semantic placement changes and snaps first mounts and teleports', () => {
        const runtime = createFaunaSimulation<null>();
        const actor = new Group();
        const inputs: number[] = [];
        runtime.register(
            (_, { delta }) => {
                inputs.push(actor.position.x);
                actor.position.x += delta;
            },
            () => actor,
        );
        runtime.advance(null, { delta: 0, now: 0 });
        actor.position.x = 8;
        runtime.advance(null, { delta: 1 / 60, now: 1 / 60 });
        assert.equal(actor.position.x, 8);
        runtime.advance(null, { delta: 1 / 60, now: 1 / 30 });
        assert.deepEqual(inputs, [0, 8]);
        runtime.resume();
        runtime.advance(null, { delta: 0, now: 1 / 30 });
        assert.equal(actor.position.x, 8 + 1 / 30);
    });

    it('accepts equivalent-quaternion external Euler representation and order edits', () => {
        const runtime = createFaunaSimulation<null>();
        const actor = new Group();
        actor.rotation.y = Math.PI;
        const inputs: (number | string)[][] = [];
        runtime.register(
            () =>
                inputs.push([
                    actor.rotation.x,
                    actor.rotation.y,
                    actor.rotation.z,
                    actor.rotation.order,
                ]),
            () => actor,
        );
        runtime.advance(null, { delta: 0, now: 0 });
        const renderedQuaternion = actor.quaternion.clone();
        actor.rotation.set(0, Math.PI, 0, 'YXZ');
        assert.ok(actor.quaternion.equals(renderedQuaternion));
        runtime.advance(null, { delta: 1 / 30, now: 1 / 30 });
        assert.deepEqual(inputs[1], [0, Math.PI, 0, 'YXZ']);
    });

    it('bounds dropped-frame movement while retaining absolute decision deadlines', () => {
        const runtime = createFaunaSimulation<null>();
        let distance = 0;
        let deadlineReached = false;
        let decisionTime = 0;
        runtime.register((_, { delta, now }) => {
            distance += delta;
            if (now >= 19.9) {
                deadlineReached = true;
                decisionTime = now;
            }
        });
        runtime.advance(null, { delta: 0, now: 0 });
        runtime.advance(null, { delta: 20, now: 20 });
        assert.ok(distance <= 0.064);
        assert.equal(deadlineReached, true);
        assert.ok(20 - decisionTime < faunaSimulationStepSeconds);
        runtime.advance(null, { delta: 1 / 60, now: 20 + 1 / 60 });
        assert.ok(20 + 1 / 60 - decisionTime < faunaSimulationStepSeconds);
        assert.ok(distance <= 0.1);
    });

    it('discards hidden backlog on resume and handles an independently reset root clock', () => {
        const runtime = createFaunaSimulation<null>();
        const frames: { delta: number; now: number }[] = [];
        runtime.register((_, frame) => frames.push(frame));
        runtime.advance(null, { delta: 0, now: 0 });
        runtime.advance(null, { delta: 1 / 60, now: 1 / 60 });
        runtime.resume();
        runtime.advance(null, { delta: 1 / 60, now: 3600 });
        assert.deepEqual(frames, [
            { delta: 0, now: 0 },
            { delta: 1 / 60, now: 3600 },
        ]);
        runtime.advance(null, { delta: 0, now: 0 });
        assert.deepEqual(frames.at(-1), { delta: 0, now: 0 });
    });

    it('keeps earlier species publication order and removes registrations exactly once', () => {
        const runtime = createFaunaSimulation<null>();
        const order: string[] = [];
        const removeFirst = runtime.register(() => order.push('cow'));
        const removeSecond = runtime.register(() => order.push('sheep'));
        const removeVisual = runtime.registerRender(() => order.push('pose'));
        runtime.advance(null, { delta: 0, now: 0 });
        assert.deepEqual(order, ['cow', 'sheep', 'pose']);
        removeFirst();
        removeFirst();
        removeSecond();
        removeVisual();
        order.length = 0;
        runtime.advance(null, { delta: 1 / 30, now: 1 / 30 });
        assert.deepEqual(order, []);
        assert.equal(runtime.getStats().simulationCallbacks, 0);
        assert.equal(runtime.getStats().renderCallbacks, 0);
    });

    it('isolates roots and resolves a fixed-step state once per step for all actors', () => {
        let stateBuilds = 0;
        const first = createFaunaSimulation<number>({
            resolveStepState: (_, frame) => {
                stateBuilds++;
                return frame.now;
            },
        });
        const second = createFaunaSimulation<number>();
        const received: number[] = [];
        first.register((state) => received.push(state));
        first.register((state) => received.push(state));
        second.register(() => assert.fail('Another root must remain idle'));
        first.advance(99, { delta: 0, now: 0 });
        first.advance(99, { delta: 1 / 30, now: 1 / 30 });
        assert.equal(stateBuilds, 2);
        assert.deepEqual(received, [0, 0, 1 / 30, 1 / 30]);
    });
});
