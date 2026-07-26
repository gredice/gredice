import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    resolveGameProfileBlockGeometryMerging,
    resolveGameProfileFlags,
} from './profileFlags.ts';

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

describe('resolveGameProfileFlags', () => {
    it('preserves debug and rain flags while controlling geometry merging', () => {
        assert.deepEqual(resolveGameProfileFlags(undefined), {
            enableBlockGeometryMergingFlag: false,
            enableDebugHudFlag: true,
            enableRainWetOverlayFlag: true,
        });
        assert.deepEqual(resolveGameProfileFlags('0'), {
            enableBlockGeometryMergingFlag: false,
            enableDebugHudFlag: true,
            enableRainWetOverlayFlag: true,
        });
    });
});
