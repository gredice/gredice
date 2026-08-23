import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createPersistedAppearanceVariantForPlacement,
    isPersistedAppearanceVariant,
    isPersistedAppearanceVariantUpdateAllowed,
    rabbitAppearanceVariants,
    resolvePersistedAppearanceVariant,
} from './index';

test('Rabbit exposes exactly two named coat-color families', () => {
    assert.deepEqual(rabbitAppearanceVariants.families, [
        { key: 'chestnut-agouti', variant: 0 },
        { key: 'cream', variant: 1 },
    ]);
});

test('selects a Rabbit coat once from the placement random source', () => {
    assert.equal(
        createPersistedAppearanceVariantForPlacement('Rabbit', () => 0),
        0,
    );
    assert.equal(
        createPersistedAppearanceVariantForPlacement('Rabbit', () => 0.999),
        1,
    );
    assert.equal(
        createPersistedAppearanceVariantForPlacement('Bucket', () => 0.999),
        undefined,
    );
});

test('keeps a valid persisted coat and deterministically repairs legacy data', () => {
    assert.equal(
        resolvePersistedAppearanceVariant({
            blockName: 'Rabbit',
            persistedVariant: 1,
            stableId: 'rabbit-42',
        }),
        1,
    );

    const firstFallback = resolvePersistedAppearanceVariant({
        blockName: 'Rabbit',
        persistedVariant: null,
        stableId: 'legacy-rabbit',
    });
    const secondFallback = resolvePersistedAppearanceVariant({
        blockName: 'Rabbit',
        persistedVariant: 999,
        stableId: 'legacy-rabbit',
    });
    assert.equal(firstFallback, secondFallback);
    assert.equal(
        isPersistedAppearanceVariant(rabbitAppearanceVariants, firstFallback),
        true,
    );
});

test('locks persisted Rabbit appearance while leaving ordinary block variants mutable', () => {
    assert.equal(
        isPersistedAppearanceVariantUpdateAllowed({
            blockName: 'Rabbit',
            currentVariant: 0,
            requestedVariant: 0,
        }),
        true,
    );
    assert.equal(
        isPersistedAppearanceVariantUpdateAllowed({
            blockName: 'Rabbit',
            currentVariant: 0,
            requestedVariant: 1,
        }),
        false,
    );
    assert.equal(
        isPersistedAppearanceVariantUpdateAllowed({
            blockName: 'Rabbit',
            currentVariant: null,
            requestedVariant: 0,
        }),
        false,
    );
    assert.equal(
        isPersistedAppearanceVariantUpdateAllowed({
            blockName: 'FenceGate',
            currentVariant: 0,
            requestedVariant: 1,
        }),
        true,
    );
});
