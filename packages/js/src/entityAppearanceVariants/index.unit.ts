import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    defineAppearanceVariants,
    getHorseAppearanceVariantDefinition,
    horseAppearanceVariants,
    isAppearanceVariantEntityName,
    isValidEntityAppearanceVariant,
    resolveHorseAppearanceVariant,
} from './index';

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
