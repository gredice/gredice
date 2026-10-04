import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getAiChatMessageTimestamp,
    getAiChatResponseTimestamp,
} from './chatMessageTimestamp';

test('chat timestamps tolerate missing or invalid legacy metadata', () => {
    for (const metadata of [
        null,
        undefined,
        {},
        '2026-09-23',
        { createdAt: 42 },
        { createdAt: 'invalid' },
    ]) {
        assert.equal(getAiChatMessageTimestamp(metadata), undefined);
    }
    assert.equal(
        getAiChatMessageTimestamp({
            createdAt: '2026-09-23T12:00:00+02:00',
        })?.toISOString(),
        '2026-09-23T10:00:00.000Z',
    );
});

test('new replies start now while tool continuations keep the original reply timestamp', () => {
    const now = new Date('2026-09-23T12:00:00Z');
    const metadata = { createdAt: '2026-09-23T10:00:00Z' };
    assert.equal(
        getAiChatResponseTimestamp([{ role: 'user', metadata }], now),
        now,
    );
    assert.equal(
        getAiChatResponseTimestamp(
            [{ role: 'assistant', metadata }],
            now,
        ).toISOString(),
        '2026-09-23T10:00:00.000Z',
    );
    assert.equal(
        getAiChatResponseTimestamp([{ role: 'assistant', metadata: {} }], now),
        now,
    );
    assert.equal(getAiChatResponseTimestamp([], now), now);
});
