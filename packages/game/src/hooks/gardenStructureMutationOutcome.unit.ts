import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyGardenStructureMutationHttpOutcome } from './gardenStructureMutationOutcome';

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
