import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    AnimationClip,
    AnimationMixer,
    Group,
    NumberKeyframeTrack,
} from 'three';
import {
    createFaunaSimulation,
    createFaunaWalkDistance,
    faunaSimulationStepSeconds,
} from './faunaSimulation';

describe('retained per-root fauna simulation', () => {
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
