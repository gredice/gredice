import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { GameQualityProfileTier } from '../../scene/gameQuality';
import {
    estimateGroundDecorationProjectedBackingPixels,
    resolveGroundDecorationMinimumProjectedBackingPixels,
    shouldCullGroundDecorationByProjectedSize,
} from './groundDecorationProjectedSize';

describe('ground decoration projected size', () => {
    it('measures orthographic sprite height in backing pixels', () => {
        const projectedBackingPixels =
            estimateGroundDecorationProjectedBackingPixels(0.2, 0.1, 1_200, 1);

        assert.ok(projectedBackingPixels !== null);
        assert.ok(Math.abs(projectedBackingPixels - 12) < 0.000_001);
    });

    it('accounts for perspective view depth', () => {
        const near = estimateGroundDecorationProjectedBackingPixels(
            0.1,
            2,
            1_000,
            10,
        );
        const far = estimateGroundDecorationProjectedBackingPixels(
            0.1,
            2,
            1_000,
            50,
        );

        assert.equal(near, 10);
        assert.equal(far, 2);
        assert.equal(
            shouldCullGroundDecorationByProjectedSize(0.1, 2, 1_000, 10, 2.5),
            false,
        );
        assert.equal(
            shouldCullGroundDecorationByProjectedSize(0.1, 2, 1_000, 50, 2.5),
            true,
        );
    });

    it('uses quality-aware physical-pixel thresholds', () => {
        const qualityTiers = [
            'high',
            'medium',
            'custom',
            'auto-constrained',
            'low',
        ] satisfies GameQualityProfileTier[];

        assert.deepEqual(
            qualityTiers.map((qualityTier) =>
                resolveGroundDecorationMinimumProjectedBackingPixels(
                    qualityTier,
                ),
            ),
            [2, 2.5, 2.5, 18, 18],
        );
        assert.equal(
            shouldCullGroundDecorationByProjectedSize(0.5, 1, 1_000, 100, 18),
            true,
        );
    });

    it('keeps sprites when projection inputs are not usable', () => {
        assert.equal(
            estimateGroundDecorationProjectedBackingPixels(0.1, 0, 0, 0),
            null,
        );
        assert.equal(
            shouldCullGroundDecorationByProjectedSize(0.1, 0, 0, 0, 2.5),
            false,
        );
    });
});
