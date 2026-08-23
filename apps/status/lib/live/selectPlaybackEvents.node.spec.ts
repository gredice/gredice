import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { selectPlaybackEvents } from '../../app/live/selectVisualEvents';
import type { LiveActivityEvent, LiveActivitySource } from './types';

function event(
    id: string,
    source: LiveActivitySource,
    occurredAt: string,
): LiveActivityEvent {
    return {
        id,
        source,
        category:
            source === 'vercel'
                ? 'platform'
                : source === 'github'
                  ? 'code'
                  : 'garden',
        label: id,
        title: id,
        detail: id,
        occurredAt,
        lane: 0,
        intensity: 1,
    };
}

describe('live playback selection', () => {
    it('interleaves sources so platform traffic does not dominate', () => {
        const events = [
            event('v1', 'vercel', '2026-08-16T09:04:00.000Z'),
            event('v2', 'vercel', '2026-08-16T09:03:00.000Z'),
            event('v3', 'vercel', '2026-08-16T09:02:00.000Z'),
            event('g1', 'gredice', '2026-08-16T09:01:00.000Z'),
            event('h1', 'github', '2026-08-16T09:00:00.000Z'),
        ];

        assert.deepEqual(
            selectPlaybackEvents(events, 5).map(({ id }) => id),
            ['g1', 'v1', 'h1', 'v2', 'v3'],
        );
    });
});
