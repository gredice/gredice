import assert from 'node:assert/strict';
import test from 'node:test';
import { readAdaptiveHighQualityProfileControlCommand } from './adaptiveHighQualityProfileControl';

test('adaptive High profile control accepts the bounded command contract', () => {
    assert.deepEqual(
        readAdaptiveHighQualityProfileControlCommand({ action: 'start' }),
        { action: 'start' },
    );
    assert.deepEqual(
        readAdaptiveHighQualityProfileControlCommand({
            action: 'sample',
            normalizedLoad: 0.7,
            source: 'frame',
        }),
        {
            action: 'sample',
            normalizedLoad: 0.7,
            source: 'frame',
        },
    );
    assert.deepEqual(
        readAdaptiveHighQualityProfileControlCommand({
            action: 'sample',
            normalizedLoad: 1.2,
            source: 'gpu',
        }),
        {
            action: 'sample',
            normalizedLoad: 1.2,
            source: 'gpu',
        },
    );
    assert.deepEqual(
        readAdaptiveHighQualityProfileControlCommand({ action: 'stop' }),
        { action: 'stop' },
    );
});

test('adaptive High profile control rejects malformed synthetic samples', () => {
    for (const value of [
        null,
        {},
        { action: 'sample' },
        { action: 'sample', normalizedLoad: 0, source: 'frame' },
        { action: 'sample', normalizedLoad: 11, source: 'frame' },
        { action: 'sample', normalizedLoad: Number.NaN, source: 'frame' },
        { action: 'sample', normalizedLoad: 0.7, source: 'synthetic' },
        { action: 'reset' },
    ]) {
        assert.equal(readAdaptiveHighQualityProfileControlCommand(value), null);
    }
});
