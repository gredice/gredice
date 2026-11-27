import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    isWaterSurfaceAnimationActive,
    litWaterSurfaceMaterialProps,
} from './WaterSurfaceMaterial';

describe('WaterSurfaceMaterial', () => {
    it('ripples prop water only on the live clock without reduced motion', () => {
        assert.equal(
            isWaterSurfaceAnimationActive({
                fixedTimeSeconds: undefined,
                reducedMotion: false,
            }),
            true,
        );
        assert.equal(
            isWaterSurfaceAnimationActive({
                fixedTimeSeconds: undefined,
                reducedMotion: true,
            }),
            false,
        );
        assert.equal(
            isWaterSurfaceAnimationActive({
                fixedTimeSeconds: 12,
                reducedMotion: false,
            }),
            false,
        );
    });

    it('lights prop water with wet roughness and no metalness', () => {
        assert.equal(litWaterSurfaceMaterialProps.metalness, 0);
        assert.ok(litWaterSurfaceMaterialProps.roughness >= 0.1);
        assert.ok(litWaterSurfaceMaterialProps.roughness <= 0.2);
    });
});
