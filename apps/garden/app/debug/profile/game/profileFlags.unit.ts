import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    highTargetOperationVisualHighlightTarget,
    resolveGameProfileAdaptiveHigh,
    resolveGameProfileBlockGeometryMerging,
    resolveGameProfileFlags,
    resolveGameProfileOperationVisuals,
} from './profileFlags.ts';

describe('resolveGameProfileAdaptiveHigh', () => {
    it('keeps adaptive High opt-in', () => {
        assert.equal(resolveGameProfileAdaptiveHigh(undefined), false);
        assert.equal(resolveGameProfileAdaptiveHigh('0'), false);
        assert.equal(resolveGameProfileAdaptiveHigh('unexpected'), false);
        assert.equal(resolveGameProfileAdaptiveHigh('1'), true);
    });
});

describe('resolveGameProfileBlockGeometryMerging', () => {
    it('preserves the existing profiler default', () => {
        assert.equal(resolveGameProfileBlockGeometryMerging(undefined), false);
        assert.equal(
            resolveGameProfileBlockGeometryMerging('unexpected'),
            false,
        );
    });

    it('supports explicit enabled and disabled profile comparisons', () => {
        assert.equal(resolveGameProfileBlockGeometryMerging('1'), true);
        assert.equal(resolveGameProfileBlockGeometryMerging('0'), false);
    });
});

describe('resolveGameProfileOperationVisuals', () => {
    it('keeps the high-target workload behind an explicit opt-in', () => {
        assert.equal(resolveGameProfileOperationVisuals(undefined), false);
        assert.equal(resolveGameProfileOperationVisuals('0'), false);
        assert.equal(resolveGameProfileOperationVisuals('unexpected'), false);
        assert.equal(resolveGameProfileOperationVisuals('1'), true);
    });

    it('exposes the deterministic transient highlight target', () => {
        assert.deepEqual(highTargetOperationVisualHighlightTarget, {
            fieldId: 201,
            positionIndex: 0,
            raisedBedId: 2,
        });
    });
});

describe('resolveGameProfileFlags', () => {
    it('preserves debug and rain flags while controlling profiler opt-ins', () => {
        assert.deepEqual(resolveGameProfileFlags(undefined, undefined), {
            enableAdaptiveHighQualityFlag: false,
            enableBlockGeometryMergingFlag: false,
            enableDebugHudFlag: true,
            enableRainWetOverlayFlag: true,
        });
        assert.deepEqual(resolveGameProfileFlags('0', '1'), {
            enableAdaptiveHighQualityFlag: true,
            enableBlockGeometryMergingFlag: false,
            enableDebugHudFlag: true,
            enableRainWetOverlayFlag: true,
        });
    });
});
