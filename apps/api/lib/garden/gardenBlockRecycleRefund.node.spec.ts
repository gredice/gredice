import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    capLegacyGardenBlockRecycleRefund,
    gardenBlockRecycleFallbackSunflowers,
    isLegacyGardenBlockRecycleRefund,
    resolveGardenBlockRecycleRefund,
} from './gardenBlockRecycleRefund';

describe('resolveGardenBlockRecycleRefund', () => {
    it('refunds the stored paid price regardless of the directory price', () => {
        for (const directoryPrice of [0, 10, 500, undefined, null]) {
            assert.deepEqual(
                resolveGardenBlockRecycleRefund({
                    directoryPrice,
                    isSandbox: false,
                    paidSunflowers: 42,
                }),
                { ok: true, refund: { basis: 'paid-price', sunflowers: 42 } },
            );
        }
        assert.deepEqual(
            resolveGardenBlockRecycleRefund({
                directoryPrice: 99,
                isSandbox: false,
                paidSunflowers: 0,
            }),
            { ok: true, refund: { basis: 'paid-price', sunflowers: 0 } },
        );
    });

    it('never moves currency in sandboxes', () => {
        assert.deepEqual(
            resolveGardenBlockRecycleRefund({
                directoryPrice: 99,
                isSandbox: true,
                paidSunflowers: 42,
            }),
            { ok: true, refund: { basis: 'sandbox', sunflowers: 0 } },
        );
    });

    it('keeps the legacy current-price rule for blocks without a stored price', () => {
        assert.deepEqual(
            resolveGardenBlockRecycleRefund({
                directoryPrice: 75,
                isSandbox: false,
                paidSunflowers: null,
            }),
            { ok: true, refund: { basis: 'directory-price', sunflowers: 75 } },
        );
        for (const directoryPrice of [0, -3, Number.NaN, null, undefined]) {
            assert.deepEqual(
                resolveGardenBlockRecycleRefund({
                    directoryPrice,
                    isSandbox: false,
                    paidSunflowers: undefined,
                }),
                {
                    ok: true,
                    refund: {
                        basis: 'fallback',
                        sunflowers: gardenBlockRecycleFallbackSunflowers,
                    },
                },
            );
        }
    });

    it('rejects stored or directory prices outside storage bounds', () => {
        for (const paidSunflowers of [-1, 1.5, 2_147_483_648, Number.NaN]) {
            assert.deepEqual(
                resolveGardenBlockRecycleRefund({
                    directoryPrice: 10,
                    isSandbox: false,
                    paidSunflowers,
                }),
                { ok: false, reason: 'invalid-paid-price' },
            );
        }
        for (const directoryPrice of [1.5, 2_147_483_648]) {
            assert.deepEqual(
                resolveGardenBlockRecycleRefund({
                    directoryPrice,
                    isSandbox: false,
                    paidSunflowers: null,
                }),
                { ok: false, reason: 'invalid-directory-price' },
            );
        }
    });
});

describe('capLegacyGardenBlockRecycleRefund', () => {
    it('caps only legacy refunds, at a lower valid recovered price', () => {
        const legacy = { basis: 'directory-price', sunflowers: 75 } as const;
        const fallback = { basis: 'fallback', sunflowers: 10 } as const;
        const paid = { basis: 'paid-price', sunflowers: 75 } as const;

        assert.equal(isLegacyGardenBlockRecycleRefund(legacy), true);
        assert.equal(isLegacyGardenBlockRecycleRefund(fallback), true);
        assert.equal(isLegacyGardenBlockRecycleRefund(paid), false);
        assert.deepEqual(capLegacyGardenBlockRecycleRefund(legacy, 30), {
            basis: 'purchase-record',
            sunflowers: 30,
        });
        assert.deepEqual(capLegacyGardenBlockRecycleRefund(fallback, 4), {
            basis: 'purchase-record',
            sunflowers: 4,
        });
        assert.deepEqual(capLegacyGardenBlockRecycleRefund(legacy, 75), legacy);
        assert.deepEqual(capLegacyGardenBlockRecycleRefund(legacy, 90), legacy);
        assert.deepEqual(
            capLegacyGardenBlockRecycleRefund(legacy, null),
            legacy,
        );
        assert.deepEqual(capLegacyGardenBlockRecycleRefund(legacy, -5), legacy);
        assert.deepEqual(capLegacyGardenBlockRecycleRefund(paid, 1), paid);
    });
});
