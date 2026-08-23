import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    cowAppearanceVariants,
    defineAppearanceVariants,
    getHorseAppearanceVariantDefinition,
    horseAppearanceVariants,
    isAppearanceVariantEntityName,
    isValidEntityAppearanceVariant,
    requiresExplicitAppearanceVariantSelection,
    resolveCowAppearanceVariant,
    resolveHorseAppearanceVariant,
    selectEntityAppearanceVariant,
} from './index';

describe('Cow appearance variants', () => {
    it('keeps exactly the two durable coat contracts', () => {
        assert.deepEqual(
            cowAppearanceVariants.variants.map(({ id, value }) => ({
                id,
                value,
            })),
            [
                { id: 'brown-and-white', value: 0 },
                { id: 'black-and-white', value: 1 },
            ],
        );
    });

    it('selects once from the placement id and resolves legacy records stably', () => {
        const selected = selectEntityAppearanceVariant('Cow', 'cow-new');
        assert.equal(cowAppearanceVariants.isVariant(selected), true);
        assert.equal(selectEntityAppearanceVariant('Cow', 'cow-new'), selected);
        assert.equal(resolveCowAppearanceVariant(1, 'cow-legacy'), 1);

        const fallback = resolveCowAppearanceVariant(null, 'cow-legacy');
        assert.equal(cowAppearanceVariants.isVariant(fallback), true);
        assert.equal(
            resolveCowAppearanceVariant(undefined, 'cow-legacy'),
            fallback,
        );
        assert.equal(resolveCowAppearanceVariant(99, 'cow-legacy'), fallback);
    });

    it('auto-selects Cow coats while Horse still requires a picker choice', () => {
        assert.equal(requiresExplicitAppearanceVariantSelection('Cow'), false);
        assert.equal(requiresExplicitAppearanceVariantSelection('Horse'), true);
        assert.equal(isAppearanceVariantEntityName('Cow'), true);
        assert.equal(isValidEntityAppearanceVariant('Cow', 0), true);
        assert.equal(isValidEntityAppearanceVariant('Cow', 1), true);
        assert.equal(isValidEntityAppearanceVariant('Cow', 2), false);
    });
});

describe('Horse appearance variants', () => {
    it('keeps six distinct append-only coat contracts', () => {
        assert.deepEqual(
            horseAppearanceVariants.variants.map((variant) => ({
                id: variant.id,
                value: variant.value,
            })),
            [
                { id: 'bay', value: 0 },
                { id: 'chestnut', value: 1 },
                { id: 'black', value: 2 },
                { id: 'dapple-gray', value: 3 },
                { id: 'palomino', value: 4 },
                { id: 'pinto', value: 5 },
            ],
        );
        assert.equal(
            new Set(
                horseAppearanceVariants.variants.map(
                    (variant) => variant.coatColor,
                ),
            ).size,
            6,
        );
        for (const variant of horseAppearanceVariants.variants) {
            assert.match(variant.markingColor, /^#[0-9a-f]{6}$/u);
            assert.match(variant.muzzleColor, /^#[0-9a-f]{6}$/u);
        }
    });

    it('validates only supported Horse values', () => {
        assert.equal(isAppearanceVariantEntityName('Horse'), true);
        assert.equal(isAppearanceVariantEntityName('Dog'), false);
        assert.equal(isValidEntityAppearanceVariant('Horse', 0), true);
        assert.equal(isValidEntityAppearanceVariant('Horse', 5), true);
        assert.equal(isValidEntityAppearanceVariant('Horse', 6), false);
        assert.equal(isValidEntityAppearanceVariant('Horse', 1.5), false);
        assert.equal(isValidEntityAppearanceVariant('Dog', 0), false);
    });

    it('uses persisted values and a stable legacy fallback by block id', () => {
        assert.equal(resolveHorseAppearanceVariant(4, 'horse-legacy'), 4);

        const missing = resolveHorseAppearanceVariant(null, 'horse-legacy');
        assert.equal(missing, 5);
        assert.equal(
            resolveHorseAppearanceVariant(undefined, 'horse-legacy'),
            missing,
        );
        assert.equal(
            resolveHorseAppearanceVariant(99, 'horse-legacy'),
            missing,
        );
        assert.equal(horseAppearanceVariants.isVariant(missing), true);
        assert.equal(getHorseAppearanceVariantDefinition(3).id, 'dapple-gray');
    });
});

describe('defineAppearanceVariants', () => {
    it('rejects invalid or duplicate durable values', () => {
        assert.throws(
            () =>
                defineAppearanceVariants('Broken', [
                    { id: 'negative', value: -1 },
                ]),
            /non-negative integers/u,
        );
        assert.throws(
            () =>
                defineAppearanceVariants('Broken', [
                    { id: 'first', value: 1 },
                    { id: 'duplicate', value: 1 },
                ]),
            /unique/u,
        );
        assert.throws(
            () => defineAppearanceVariants('Broken', []),
            /At least one/u,
        );
    });
});
