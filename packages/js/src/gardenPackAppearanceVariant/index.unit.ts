import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveGardenPackLineVariant } from './index';

test('fixed pack appearance uses registry ids and never randomizes', () => {
    assert.equal(
        resolveGardenPackLineVariant({
            modelName: 'HorseStable',
            variant: {
                versionId: 'entity-appearance:v1',
                appearance: { id: 'pinto' },
            },
        }),
        5,
    );
    assert.equal(
        resolveGardenPackLineVariant({
            modelName: 'TestPumpkin',
            variant: null,
        }),
        null,
    );
    for (const variant of [
        null,
        { versionId: 'appearance:v0', appearance: { id: 'pinto' } },
        { versionId: 'entity-appearance:v1', appearance: { id: 'missing' } },
        {
            versionId: 'entity-appearance:v1',
            appearance: { id: 'pinto', color: 'other' },
        },
    ])
        assert.throws(() =>
            resolveGardenPackLineVariant({ modelName: 'HorseStable', variant }),
        );
    assert.throws(() =>
        resolveGardenPackLineVariant({
            modelName: 'TestPumpkin',
            variant: {
                versionId: 'entity-appearance:v1',
                appearance: { id: 'pinto' },
            },
        }),
    );
});
