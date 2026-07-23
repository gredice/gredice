import assert from 'node:assert/strict';
import test from 'node:test';
import {
    plantHeavyMockGardenReferenceDate,
    resolveMockGardenProfileReferenceDate,
} from './mockGardenProfileFixtures';

test('plant-heavy garden lifecycle dates remain deterministic', () => {
    assert.equal(
        resolveMockGardenProfileReferenceDate(
            'plant-heavy',
            new Date('2035-01-01T00:00:00.000Z'),
        ),
        plantHeavyMockGardenReferenceDate,
    );
    assert.equal(
        resolveMockGardenProfileReferenceDate(
            'plant-heavy',
            new Date('2020-01-01T00:00:00.000Z'),
        ),
        plantHeavyMockGardenReferenceDate,
    );
});

test('non-plant profiling gardens retain the requested reference time', () => {
    const referenceDate = new Date('2026-07-23T12:34:56.000Z');
    assert.equal(
        resolveMockGardenProfileReferenceDate('dense', referenceDate),
        referenceDate.toISOString(),
    );
});
