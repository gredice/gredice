import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeAiAnalysisReferenceDate } from './aiAnalysisReferenceDate';

test('serializeAiAnalysisReferenceDate serializes dates for API requests', () => {
    assert.strictEqual(
        serializeAiAnalysisReferenceDate(new Date('2026-05-12T12:00:00.000Z')),
        '2026-05-12T12:00:00.000Z',
    );
    assert.strictEqual(
        serializeAiAnalysisReferenceDate('2026-05-12T12:00:00.000Z'),
        '2026-05-12T12:00:00.000Z',
    );
    assert.strictEqual(serializeAiAnalysisReferenceDate(null), undefined);
});
