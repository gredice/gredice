import assert from 'node:assert/strict';
import test from 'node:test';
import { AnimationClip, Group, LoopRepeat, VectorKeyframeTrack } from 'three';
import { createActorAnimationRig } from './actorAnimationRig';

function createAnimatedActor() {
    const root = new Group();
    const bone = new Group();
    bone.name = 'Bone';
    root.add(bone);
    const clips = [
        new AnimationClip('Walk', 1, [
            new VectorKeyframeTrack(
                'Bone.position',
                [0, 1],
                [0, 0, 0, 2, 0, 0],
            ),
        ]),
        new AnimationClip('Idle', 1, [
            new VectorKeyframeTrack(
                'Bone.position',
                [0, 1],
                [0, 0, 0, 0, 2, 0],
            ),
        ]),
    ];
    return { root, bone, clips };
}

test('actor animation rig replays after a dispose and remount of the same root', () => {
    const { root, bone, clips } = createAnimatedActor();
    const first = createActorAnimationRig(root, clips);
    first.actions.get('Walk')?.play();
    first.mixer.update(0.25);
    first.dispose();

    const second = createActorAnimationRig(root, clips);
    const walk = second.actions.get('Walk');
    assert.ok(walk);
    assert.notEqual(walk, first.actions.get('Walk'));
    assert.deepEqual([...second.actions.keys()], ['Walk', 'Idle']);

    assert.doesNotThrow(() => {
        walk.reset().setLoop(LoopRepeat, Number.POSITIVE_INFINITY).play();
        second.mixer.update(0.5);
    });
    assert.ok(Math.abs(bone.position.x - 1) < 1e-6);
    second.dispose();
});

test('actor animation rig dispose stops actions and restores the root pose', () => {
    const { root, bone, clips } = createAnimatedActor();
    const rig = createActorAnimationRig(root, clips);
    const idle = rig.actions.get('Idle');
    assert.ok(idle);
    idle.play();
    rig.mixer.update(0.5);
    assert.ok(Math.abs(bone.position.y - 1) < 1e-6);

    rig.dispose();

    assert.equal(idle.isRunning(), false);
    assert.deepEqual(bone.position.toArray(), [0, 0, 0]);
});
