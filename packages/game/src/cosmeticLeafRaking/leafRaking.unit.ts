import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createLeafRakingController,
    getLeafRakingTargets,
    leafRakingAnchorName,
    leafRakingCooldownMs,
    leafRakingParticleCount,
    sampleLeafRaking,
} from './leafRaking';

test('only exposed existing rake and leaf decorations are activity targets; stacks remain unchanged', () => {
    const stacks = [
        {
            blocks: [
                { id: 'hidden', name: 'LeafRake' },
                { id: 'bed', name: 'RaisedBed' },
            ],
        },
        { blocks: [{ id: 'pile', name: 'AutumnLeafPileCrescent' }] },
        { blocks: [{ id: 'rake', name: 'LeafRake' }] },
    ];
    const before = JSON.stringify(stacks);
    assert.deepEqual(
        getLeafRakingTargets(stacks).map((block) => block.id),
        ['pile', 'rake'],
    );
    assert.equal(
        leafRakingAnchorName('AutumnLeafPileCrescent', 'pile'),
        'AutumnLeafPile:rake-anchor:pile',
    );
    assert.equal(JSON.stringify(stacks), before);
});

test('one action/cooldown spans all targets, ends without a frame clock, and disconnect discards scene identity', () => {
    const controller = createLeafRakingController();
    assert.equal(controller.request('rake', false), false);
    let now = 100;
    const disconnect = controller.connect((targetId) =>
        controller.start({
            targetId,
            origin: [1, 0.2, 3],
            startedAtMs: now,
            sceneTime: 8,
            reducedMotion: false,
        }),
    );
    assert.equal(controller.request('rake', false), true);
    assert.equal(controller.request('pile', false), false);
    controller.advance(1000);
    assert.equal(controller.getSnapshot().action?.phase, 'cooldown');
    assert.equal(controller.request('rake', false), false);
    now += leafRakingCooldownMs;
    controller.advance(now);
    assert.equal(controller.request('pile', false), true);
    disconnect();
    assert.equal(controller.getSnapshot().available, false);
    assert.equal(controller.getSnapshot().action, null);
    assert.equal(controller.getSnapshot().lastTargetId, null);
});

test('reduced motion has a short static acknowledgement and the same repeat cooldown', () => {
    const controller = createLeafRakingController();
    controller.connect((targetId) =>
        controller.start({
            targetId,
            origin: [0, 0, 0],
            startedAtMs: 0,
            sceneTime: 0,
            reducedMotion: true,
        }),
    );
    controller.request('pile', false);
    controller.advance(180);
    assert.equal(controller.getSnapshot().action?.phase, 'cooldown');
    assert.equal(controller.request('pile', false), false);
    controller.advance(2200);
    assert.equal(controller.request('pile', false), true);
    controller.reset();
    assert.equal(controller.getSnapshot().action, null);
});

test('eight reusable leaves remain within a small finite puff and disappear at its end', () => {
    assert.equal(leafRakingParticleCount, 8);
    for (let index = 0; index < leafRakingParticleCount; index++) {
        for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
            const pose = sampleLeafRaking(progress, index);
            assert.ok(Math.hypot(pose.x, pose.z) <= 0.29);
            assert.ok(pose.y >= 0 && pose.y <= 0.2);
            assert.ok(Object.values(pose).every(Number.isFinite));
        }
        assert.equal(sampleLeafRaking(1, index).scale, 0);
    }
});
