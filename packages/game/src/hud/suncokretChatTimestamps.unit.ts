import assert from 'node:assert/strict';
import test from 'node:test';
import type { UIMessage } from 'ai';
import { groupSuncokretMessageTimestamps } from './suncokretChatTimestamps';

function message(id: string, date?: Date): UIMessage {
    return {
        id,
        role: 'user',
        parts: [{ type: 'text', text: id }],
        metadata: date ? { createdAt: date.toISOString() } : undefined,
    };
}

test('chat dates appear first, after a one-hour gap, and at a local day change', () => {
    const dates = [
        new Date(2026, 8, 22, 12, 0),
        new Date(2026, 8, 22, 12, 59, 59),
        new Date(2026, 8, 22, 13, 59, 59),
        new Date(2026, 8, 22, 23, 50),
        new Date(2026, 8, 23, 0, 5),
        new Date(2026, 8, 23, 0, 6),
    ];
    assert.deepEqual(
        groupSuncokretMessageTimestamps(
            dates.map((date, index) => message(String(index), date)),
        ).map((entry) => entry.timestamp),
        [dates[0], undefined, dates[2], dates[3], dates[4], undefined],
    );
});

test('missing dates are not invented and the diary date wins over a legacy snapshot timestamp', () => {
    const analysisDate = '2026-09-22T12:00:00.000Z';
    const messages = [
        message('unknown'),
        message('analysis-0', new Date('2026-09-23T12:00:00Z')),
        message('question', new Date('2026-09-23T12:01:00Z')),
    ];
    const grouped = groupSuncokretMessageTimestamps(messages, {
        id: 'analysis',
        messages: [
            { role: 'assistant', text: 'Analiza', createdAt: analysisDate },
        ],
    });
    assert.equal(grouped[0]?.timestamp, undefined);
    assert.equal(grouped[1]?.timestamp?.toISOString(), analysisDate);
    assert.equal(
        grouped[2]?.timestamp?.toISOString(),
        '2026-09-23T12:01:00.000Z',
    );
    assert.equal(
        messages[1]?.metadata && JSON.stringify(messages[1].metadata),
        '{"createdAt":"2026-09-23T12:00:00.000Z"}',
    );
});
