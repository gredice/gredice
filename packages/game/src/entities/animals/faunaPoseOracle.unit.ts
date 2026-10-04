import assert from 'node:assert/strict';
import test from 'node:test';
import {
    AnimationClip,
    AnimationMixer,
    Group,
    MathUtils,
    NumberKeyframeTrack,
} from 'three';
import {
    activateFaunaPoseOracle,
    createFaunaPoseOracle,
} from '../../../tests/faunaPoseOracle';

const source = {
    file: 'independent.unit',
    name: 'updateBeeRig',
    referenceCommit: 'a'.repeat(40),
    referenceHash: 'b'.repeat(64),
    actualHash: 'b'.repeat(64),
    helperHashes: {},
};
function createRig() {
    const root = new Group(),
        pivot = new Group();
    pivot.name = 'Cow_BodyPivot';
    root.add(pivot);
    return {
        root,
        input: { rig: { object: pivot, amount: 0 }, now: 0, delta: 0 },
    };
}
function pose({ rig, now, delta }: ReturnType<typeof createRig>['input']) {
    rig.amount = MathUtils.damp(rig.amount, Math.sin(now), 8, delta);
    rig.object.position.y = rig.amount;
}

test('observes the actual hidden birth root without changing its transform', async () => {
    const model = createRig(),
        actor = new Group(),
        oracle = createFaunaPoseOracle();
    actor.add(model.root);
    actor.scale.setScalar(0);
    actor.updateWorldMatrix(true, true);
    oracle.setModel(model.root, 'Butterfly:0', null, actor);
    oracle.beginFrame(1 / 60, 1 / 60);
    oracle.recordActorRoot(model.root, actor);
    const receipt = await oracle.receipt([]);
    assert.equal(receipt.actorRoots[0].matchesObservedParent, true);
    assert.deepEqual(receipt.actorRoots[0].local.scale, [0, 0, 0]);
    assert.deepEqual(
        receipt.actorRoots[0].matrixWorld,
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    );
    assert.deepEqual(actor.scale.toArray(), [0, 0, 0]);
    oracle.setModel(model.root, 'Butterfly:0', null, new Group());
    oracle.beginFrame(1 / 30, 1 / 60);
    assert.equal(
        (await oracle.receipt([])).actorRoots[0].matchesObservedParent,
        false,
    );
});

test('reconstructs persistent damped rig state and rejects a changed recurrence', async () => {
    const model = createRig(),
        oracle = createFaunaPoseOracle();
    oracle.setModel(model.root, 'Cow:0');
    for (let index = 1; index < 10; index++) {
        oracle.beginFrame(index / 60, 1 / 60);
        model.input.now = index / 60;
        model.input.delta = 1 / 60;
        oracle.invoke(source, [model.input], pose, pose);
        assert.equal((await oracle.receipt([])).pass, true);
    }
    oracle.beginFrame(10 / 60, 1 / 60);
    model.input.now = 10 / 60;
    const wrongPose = ({
        rig,
        now,
        delta,
    }: ReturnType<typeof createRig>['input']) => {
        rig.amount = MathUtils.damp(rig.amount, Math.sin(now), 9, delta);
        rig.object.position.y = rig.amount;
    };
    assert.throws(
        () => oracle.invoke(source, [model.input], wrongPose, pose),
        /independent frozen pose drift/,
    );
});

test('rejects a wrong render clock phase or cadence rate before pose evaluation', () => {
    for (const alter of [
        (input: ReturnType<typeof createRig>['input']) => {
            input.now += 1 / 60;
        },
        (input: ReturnType<typeof createRig>['input']) => {
            input.delta *= 2;
        },
    ]) {
        const model = createRig(),
            oracle = createFaunaPoseOracle();
        oracle.setModel(model.root, 'Cow:0');
        oracle.beginFrame(1 / 60, 1 / 60);
        model.input.now = 1 / 60;
        model.input.delta = 1 / 60;
        alter(model.input);
        assert.throws(
            () => oracle.invoke(source, [model.input], pose, pose),
            /pose clock phase|pose clock rate/,
        );
    }
});

test('anchors delayed presentation to simulation despite a culled first helper call', async () => {
    const model = createRig(),
        oracle = createFaunaPoseOracle();
    const cowSource = { ...source, name: 'updateCowPose' };
    oracle.setModel(model.root, 'Cow:0');
    oracle.beginFrame(0, 0);
    oracle.recordSimulation({ now: 0, delta: 0 }, model.root);
    // The presentation sampler advances on the initial render even when
    // the actual culling hook prevents the manual pose helper from running.
    oracle.beginFrame(1 / 60, 1 / 60);
    model.input.now = 0;
    model.input.delta = 0;
    oracle.invoke(cowSource, [model.input], pose, pose);
    const first = await oracle.receipt([]);
    assert.equal(first.calls[0].clock.time, 0);
    assert.equal(first.calls[0].clock.delta, 0);
    assert.deepEqual(first.checkedPoses, [
        { actor: 'Cow:0', node: '@model' },
        { actor: 'Cow:0', node: 'Cow_BodyPivot' },
    ]);
    // A later skipped helper call must not accumulate presentation delta.
    oracle.beginFrame(2 / 60, 1 / 60);
    oracle.recordSimulation({ now: 1 / 30, delta: 1 / 30 }, model.root);
    oracle.beginFrame(3 / 60, 1 / 60);
    model.input.now = 1 / 60;
    model.input.delta = 1 / 60;
    oracle.invoke(cowSource, [model.input], pose, pose);
    assert.ok(
        Math.abs((await oracle.receipt([])).calls[0].clock.delta - 1 / 60) <
            1e-12,
    );
    oracle.beginFrame(4 / 60, 1 / 60, true);
    oracle.recordSimulation({ now: 4 / 60, delta: 1 / 60 }, model.root);
    model.input.now = 4 / 60;
    model.input.delta = 1 / 60;
    oracle.invoke(cowSource, [model.input], pose, pose);
    assert.equal((await oracle.receipt([])).calls[0].clock.anchor, 4 / 60);
});

test('replays actual action commands and mixer phase on an independent rig', async () => {
    const active = activateFaunaPoseOracle();
    try {
        const model = createRig(),
            mixer = new AnimationMixer(model.root);
        active.oracle.setModel(model.root, 'Cow:0');
        active.oracle.beginFrame(1 / 60, 1 / 60);
        const clip = new AnimationClip('Cow_Walk', 1, [
            new NumberKeyframeTrack(
                'Cow_BodyPivot.position[y]',
                [0, 1],
                [0, 1],
            ),
        ]);
        mixer.clipAction(clip).reset().fadeIn(0.1).play();
        mixer.update(1 / 60);
        const receipt = await active.oracle.receipt([]);
        assert.equal(receipt.pass, true);
        assert.ok(receipt.checks > 0);
        assert.equal(receipt.mixers.length, 1);
        assert.ok(receipt.commands.some(({ method }) => method === 'play'));
        active.oracle.beginFrame(2 / 60, 1 / 60);
        assert.throws(() => mixer.update(1 / 30), /mixer clock rate/);
    } finally {
        active.dispose();
    }
});
