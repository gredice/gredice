import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MeshStandardMaterial, ShaderLib, Vector4 } from 'three';
import {
    createWaterBlockMaterial,
    injectWaterBlockShader,
    type WaterBlockMaterialSettings,
} from './waterBlockMaterial';

function settings(
    overrides: Partial<WaterBlockMaterialSettings> = {},
): WaterBlockMaterialSettings {
    return {
        discardInnerEdges: false,
        foamCorners: new Vector4(0, 0, 0, 0),
        foamEdges: new Vector4(1, 0, 1, 0),
        style: 'standard',
        timeUniform: { value: 0 },
        useFoamAttributes: true,
        useLocalPositionAttribute: true,
        useShoreDepthAttribute: true,
        useWaterDepthAttribute: true,
        waterDepth: 1,
        waterTopLocalY: 0.2,
        ...overrides,
    };
}

describe('createWaterBlockMaterial', () => {
    it('is a lit standard material with wet roughness and no metalness', () => {
        const material = createWaterBlockMaterial(settings());

        assert.ok(material instanceof MeshStandardMaterial);
        assert.equal(material.metalness, 0);
        assert.ok(material.roughness >= 0.1 && material.roughness <= 0.2);
        // The body is opaque and writes depth, so far walls never paint over
        // near ones.
        assert.equal(material.depthWrite, true);

        material.dispose();
    });

    it('keeps the water shader when a preview clones the material', () => {
        const material = createWaterBlockMaterial(settings());
        const preview = material.clone();

        assert.equal(preview.onBeforeCompile, material.onBeforeCompile);
        assert.equal(
            preview.customProgramCacheKey(),
            material.customProgramCacheKey(),
        );
        assert.deepEqual(preview.defines, material.defines);
        assert.ok('USE_WATER_FOAM_ATTRIBUTES' in (preview.defines ?? {}));

        material.dispose();
        preview.dispose();
    });
});

describe('injectWaterBlockShader', () => {
    it('finds every anchor in the three.js standard shader', () => {
        const shader = {
            fragmentShader: ShaderLib.standard.fragmentShader,
            uniforms: {},
            vertexShader: ShaderLib.standard.vertexShader,
        };

        injectWaterBlockShader(shader, { uWaterShallow: { value: 1 } });

        assert.ok('uWaterShallow' in shader.uniforms);
        assert.match(shader.vertexShader, /varying vec3 vWaterWorldPosition;/);
        assert.match(shader.vertexShader, /vWaterWorldPosition = /);
        assert.match(shader.fragmentShader, /uniform vec3 uWaterShallow;/);
        assert.match(
            shader.fragmentShader,
            /diffuseColor = vec4\( waterAlbedo/,
        );
        assert.doesNotMatch(shader.fragmentShader, /#include <color_fragment>/);

        // The sheen cap runs after the lights, and the shared sky rim and
        // surface gradient that extend `lights_fragment_end`.
        const lightsEnd = shader.fragmentShader.indexOf(
            '#include <lights_fragment_end>',
        );
        const sheen = shader.fragmentShader.indexOf(
            'reflectedLight.directSpecular = min(',
        );
        assert.ok(lightsEnd >= 0 && sheen > lightsEnd);
    });
});
