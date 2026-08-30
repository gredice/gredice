import assert from 'node:assert/strict';
import test from 'node:test';
import {
    faunaHeavyMockGardenProfile,
    isDeterministicEmptyMockGardenProfile,
} from './mockGardenProfilePolicy';

test('only self-contained empty API mock profiles use deterministic responses', () => {
    assert.equal(isDeterministicEmptyMockGardenProfile('high-target'), true);
    assert.equal(
        isDeterministicEmptyMockGardenProfile(faunaHeavyMockGardenProfile),
        true,
    );
    assert.equal(isDeterministicEmptyMockGardenProfile('default'), false);
    assert.equal(
        isDeterministicEmptyMockGardenProfile('operation-rewards'),
        false,
    );
});
