import assert from 'node:assert/strict';
import test from 'node:test';
import { selectActivePublicGardenVisitors } from './publicGardenVisitorPresence';

const now = Date.parse('2026-08-07T12:00:00.000Z');

function presence(id: string, updatedAt = now) {
    return {
        crouchAmount: 0,
        grounded: true,
        headPitch: 0,
        id,
        movingSpeed: 1,
        position: [1, 0, 2],
        updatedAt,
        view: 'overview',
        yaw: 0,
    };
}

test('selects current peers and removes the local and stale visitors', () => {
    const localId = '00000000-0000-4000-8000-000000000001';
    const peerId = '00000000-0000-4000-8000-000000000002';
    const staleId = '00000000-0000-4000-8000-000000000003';
    const result = selectActivePublicGardenVisitors({
        entries: {
            [localId]: presence(localId),
            [peerId]: presence(peerId),
            [staleId]: presence(staleId, now - 16_000),
            malformed: { updatedAt: now },
        },
        now,
        visitorId: localId,
    });

    assert.deepEqual(result.visitors, [presence(peerId)]);
    assert.deepEqual(
        result.staleVisitorIds.sort(),
        [staleId, 'malformed'].sort(),
    );
});

test('accepts Redis values returned as serialized JSON', () => {
    const localId = '00000000-0000-4000-8000-000000000001';
    const peerId = '00000000-0000-4000-8000-000000000002';
    const result = selectActivePublicGardenVisitors({
        entries: { [peerId]: JSON.stringify(presence(peerId)) },
        now,
        visitorId: localId,
    });

    assert.deepEqual(result.visitors, [presence(peerId)]);
    assert.deepEqual(result.staleVisitorIds, []);
});
