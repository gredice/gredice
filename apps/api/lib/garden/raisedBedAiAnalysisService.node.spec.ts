import assert from 'node:assert/strict';
import test from 'node:test';
import { getRaisedBedImageAnalysisWeeklyLimit } from './raisedBedAiAnalysisService';

test('getRaisedBedImageAnalysisWeeklyLimit grants 5 requests per active raised bed', () => {
    assert.strictEqual(getRaisedBedImageAnalysisWeeklyLimit(0), 0);
    assert.strictEqual(getRaisedBedImageAnalysisWeeklyLimit(1), 5);
    assert.strictEqual(getRaisedBedImageAnalysisWeeklyLimit(3), 15);
});
