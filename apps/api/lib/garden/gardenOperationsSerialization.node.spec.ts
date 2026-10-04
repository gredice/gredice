import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeGardenOperationEvidence } from './gardenOperationsSerialization';

test('garden operation evidence is hidden until operation verification completes', () => {
    assert.deepStrictEqual(
        serializeGardenOperationEvidence({
            status: 'pendingVerification',
            imageUrls: ['https://example.com/pending.jpg'],
            completionNotes: 'Pending review note',
        }),
        {
            imageUrls: [],
            completionNotes: null,
        },
    );
});

test('garden operation evidence is visible after operation verification', () => {
    assert.deepStrictEqual(
        serializeGardenOperationEvidence({
            status: 'completed',
            imageUrls: ['https://example.com/completed.jpg'],
            completionNotes: 'Verified note',
        }),
        {
            imageUrls: ['https://example.com/completed.jpg'],
            completionNotes: 'Verified note',
        },
    );
});
