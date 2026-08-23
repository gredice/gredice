import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getPersistedAppearanceVariantName,
    isPersistedAppearanceVariantIndex,
    isPersistedAppearanceVariantPlacementValid,
    isPersistedAppearanceVariantUpdateAllowed,
    persistedAppearanceVariantNames,
    resolvePersistedAppearanceVariantIndex,
    selectPersistedAppearanceVariantIndex,
} from '.';

describe('persisted appearance variants', () => {
    it('defines exactly the two supported Cow coats', () => {
        assert.deepEqual(persistedAppearanceVariantNames.Cow, [
            'brown-and-white',
            'black-and-white',
        ]);
        assert.equal(
            getPersistedAppearanceVariantName('Cow', 0),
            'brown-and-white',
        );
        assert.equal(
            getPersistedAppearanceVariantName('Cow', 1),
            'black-and-white',
        );
        assert.equal(isPersistedAppearanceVariantIndex('Cow', 2), false);
    });

    it('keeps persisted values and deterministically resolves legacy records', () => {
        assert.equal(
            resolvePersistedAppearanceVariantIndex('Cow', 1, 'cow-a'),
            1,
        );
        const first = resolvePersistedAppearanceVariantIndex(
            'Cow',
            undefined,
            'legacy-cow',
        );
        assert.equal(
            resolvePersistedAppearanceVariantIndex('Cow', null, 'legacy-cow'),
            first,
        );
        assert.ok(first === 0 || first === 1);
    });

    it('selects only at placement boundaries and ignores unrelated blocks', () => {
        const selected = selectPersistedAppearanceVariantIndex(
            'Cow',
            'optimistic-placement-id',
        );
        assert.ok(selected === 0 || selected === 1);
        assert.equal(
            selectPersistedAppearanceVariantIndex(
                'WoodenBench',
                'placement-id',
            ),
            null,
        );
    });

    it('validates placement variants and prevents later Cow coat changes', () => {
        assert.equal(
            isPersistedAppearanceVariantPlacementValid('Cow', undefined),
            true,
        );
        assert.equal(
            isPersistedAppearanceVariantPlacementValid('Cow', 1),
            true,
        );
        assert.equal(
            isPersistedAppearanceVariantPlacementValid('Cow', 2),
            false,
        );
        assert.equal(
            isPersistedAppearanceVariantPlacementValid('Tree', 0),
            false,
        );
        assert.equal(
            isPersistedAppearanceVariantUpdateAllowed('Cow', 1, 1),
            true,
        );
        assert.equal(
            isPersistedAppearanceVariantUpdateAllowed('Cow', 1, 0),
            false,
        );
        assert.equal(
            isPersistedAppearanceVariantUpdateAllowed('Cow', 1, null),
            false,
        );
        assert.equal(
            isPersistedAppearanceVariantUpdateAllowed('FenceGate', 1, 0),
            true,
        );
    });
});
