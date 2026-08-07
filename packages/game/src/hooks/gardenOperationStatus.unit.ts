import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getSowingGardenOperationStatus,
    parseGardenOperationStatus,
} from './gardenOperationStatus';

test('parses durable blocked operations without breaking history pages', () => {
    assert.equal(parseGardenOperationStatus('blocked'), 'blocked');
});

test('keeps pending verification distinct from completed work', () => {
    assert.equal(
        parseGardenOperationStatus('pendingVerification'),
        'confirmed',
    );
    assert.equal(parseGardenOperationStatus('completed'), 'completed');
});

test('keeps a blocked assigned planting blocked in synthesized history', () => {
    assert.equal(
        getSowingGardenOperationStatus({
            assignedUserIds: ['farmer-1'],
            plantScheduledDate: '2026-07-15T08:00:00.000Z',
            plantStatus: 'blocked',
        }),
        'blocked',
    );
});

test('rejects unknown backend operation states', () => {
    assert.throws(
        () => parseGardenOperationStatus('mystery'),
        /Unknown garden operation status/,
    );
});
