import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { GENERATED_PLANT_SHADOW_LAYER } from '../entities/raisedBed/plantShadowProxy';
import { enableGeneratedPlantShadowLayer } from './generatedPlantShadowLayer';

describe('generated plant shadow layer', () => {
    it('enables the proxy layer for the render camera, light, and shadow camera', () => {
        const camera = new THREE.OrthographicCamera();
        const directionalLight = new THREE.DirectionalLight();

        const cleanup = enableGeneratedPlantShadowLayer({
            camera,
            directionalLight,
        });

        assert.equal(
            camera.layers.isEnabled(GENERATED_PLANT_SHADOW_LAYER),
            true,
        );
        assert.equal(
            directionalLight.layers.isEnabled(GENERATED_PLANT_SHADOW_LAYER),
            true,
        );
        assert.equal(
            directionalLight.shadow.camera.layers.isEnabled(
                GENERATED_PLANT_SHADOW_LAYER,
            ),
            true,
        );

        cleanup();
    });

    it('restores only targets that did not already own the layer', () => {
        const camera = new THREE.OrthographicCamera();
        const directionalLight = new THREE.DirectionalLight();
        directionalLight.layers.enable(GENERATED_PLANT_SHADOW_LAYER);

        const cleanup = enableGeneratedPlantShadowLayer({
            camera,
            directionalLight,
        });
        camera.layers.enable(5);
        cleanup();
        cleanup();

        assert.equal(
            camera.layers.isEnabled(GENERATED_PLANT_SHADOW_LAYER),
            false,
        );
        assert.equal(camera.layers.isEnabled(5), true);
        assert.equal(
            directionalLight.layers.isEnabled(GENERATED_PLANT_SHADOW_LAYER),
            true,
        );
        assert.equal(
            directionalLight.shadow.camera.layers.isEnabled(
                GENERATED_PLANT_SHADOW_LAYER,
            ),
            false,
        );
    });
});
