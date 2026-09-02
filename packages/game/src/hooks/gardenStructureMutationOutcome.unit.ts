import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    classifyGardenStructureMutationHttpOutcome,
    getGardenStructureRolloutGateErrorMessage,
} from './gardenStructureMutationOutcome';

test('classifies timeout, retry, rate-limit, and server failures as unknown', () => {
    for (const status of [0, 408, 425, 429, 500, 502, 503, 504]) {
        assert.equal(
            classifyGardenStructureMutationHttpOutcome(status),
            'unknown',
            status.toString(),
        );
    }
    for (const status of [400, 401, 403, 404, 409, 422]) {
        assert.equal(
            classifyGardenStructureMutationHttpOutcome(status),
            'rejected',
            status.toString(),
        );
    }
});

test('treats exact API rollout refusals as definitive rejections', () => {
    for (const code of [
        'BUILDING_SYSTEM_DISABLED',
        'BUILDING_COMMERCIAL_DISABLED',
    ]) {
        assert.equal(
            classifyGardenStructureMutationHttpOutcome(503, code),
            'rejected',
            code,
        );
    }

    assert.equal(
        classifyGardenStructureMutationHttpOutcome(503, 'UNAVAILABLE'),
        'unknown',
    );
});

test('uses recovery-aware copy only for exact API rollout refusals', () => {
    assert.match(
        getGardenStructureRolloutGateErrorMessage('BUILDING_SYSTEM_DISABLED') ??
            '',
        /lokalne kopije/,
    );
    assert.match(
        getGardenStructureRolloutGateErrorMessage(
            'BUILDING_COMMERCIAL_DISABLED',
        ) ?? '',
        /lokalne kopije/,
    );
    assert.equal(
        getGardenStructureRolloutGateErrorMessage('UNAVAILABLE'),
        null,
    );
});
