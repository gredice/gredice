import assert from 'node:assert/strict';
import test from 'node:test';
import {
    AdditiveBlending,
    MeshBasicMaterial,
    MeshStandardMaterial,
    ShaderMaterial,
} from 'three';
import { applyGroundPatchMaterial } from '../entities/helpers/groundPatchMaterial';
import {
    getCloudShadowAttenuationMaterialUniforms,
    retainCloudShadowAttenuationMaterial,
} from './cloudShadowAttenuation';
import {
    createIntegratedWeatherSurfaceMaterial,
    getWeatherSurfacePluginVariantKey,
    resolveWeatherSurfacePluginMode,
    supportsIntegratedWeatherSurfaceMaterial,
} from './weatherSurfaceMaterial';

const options = {
    rain: {
        bounds: {
            max: [4, 0.75, 5] as const,
            min: [-2, -0.25, -3] as const,
        },
        darkness: 1,
        enabled: true,
        glossiness: 0.7,
        puddleStrengthUniform: { value: 0.4 },
        topSurfaceBias: 1.8,
        wetnessUniform: { value: 0.75 },
    },
    snow: {
        amountUniform: { value: 0.5 },
        color: '#f7f7ff',
        enabled: true,
        lift: 0.01,
        maxThickness: 0.1,
        noiseAmplitude: 0.35,
        noiseInfluence: 0.15,
        noiseScale: 0.2,
        slopeExponent: 2.4,
    },
};

function shaderFixture() {
    return {
        fragmentShader: `
#include <common>
void main() {
    vec4 diffuseColor = vec4(1.0);
    #include <map_fragment>
    #include <color_fragment>
    #include <aomap_fragment>
    #include <roughnessmap_fragment>
    #include <metalnessmap_fragment>
    #include <opaque_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
    #include <dithering_fragment>
}`,
        uniforms: {},
        vertexShader: `
#include <common>
void main() {
    vec3 transformed = position;
    #include <project_vertex>
    #include <worldpos_vertex>
}`,
    };
}

test('integrated weather material composes existing shader hooks', () => {
    const source = new MeshStandardMaterial();
    let sourceHookCount = 0;
    source.onBeforeCompile = (shader) => {
        sourceHookCount += 1;
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `#include <color_fragment>
float grediceGroundPatchApplied = 1.0;`,
        );
    };
    source.customProgramCacheKey = () => 'ground-patch:grass';
    const material = createIntegratedWeatherSurfaceMaterial(source, options);
    const shader = shaderFixture();

    Reflect.apply(material.onBeforeCompile, material, [shader, undefined]);

    assert.equal(sourceHookCount, 1);
    assert.match(shader.fragmentShader, /grediceGroundPatchApplied/);
    assert.match(shader.fragmentShader, /grediceWeatherWet/);
    assert.match(shader.fragmentShader, /grediceWeatherSnowStrength/);
    assert.match(shader.vertexShader, /aSnowTopDistance/);
    assert.match(
        shader.vertexShader,
        /varying vec3 vGrediceWeatherWorldNormal;/,
    );
    assert.doesNotMatch(
        shader.vertexShader,
        /varying float vGrediceWeatherWorldNormalY;/,
    );
    assert.match(
        shader.vertexShader,
        /uGrediceSnowAmount > 0\.001[\s\S]*grediceWeatherNoise/,
    );
    assert.match(
        shader.vertexShader,
        /dot\(grediceWeatherWorldNormal, grediceWeatherWorldUp\)/,
    );
    assert.match(
        shader.fragmentShader,
        /mat3\(viewMatrix\) \*[\s\S]*normalize\(vGrediceWeatherWorldNormal\)/,
    );
    assert.match(
        shader.vertexShader,
        /grediceWeatherNoise\(\s*aWeatherLocalPosition \* uGrediceSnowNoiseScale/,
    );
    assert.match(
        shader.vertexShader,
        /defined\( USE_SHADOWMAP \)[\s\S]*vGrediceWeatherWorldPosition = worldPosition\.xyz;[\s\S]*#else/,
    );
    assert.ok(
        shader.fragmentShader.indexOf('grediceGroundPatchApplied') <
            shader.fragmentShader.indexOf('float grediceWeatherSnowCoverage'),
        'base ground-patch color must run before the weather blend',
    );
    assert.match(shader.fragmentShader, /if \(uGrediceRainWetness > 0\.001\)/);
    assert.match(
        shader.fragmentShader,
        /normalize\(vGrediceWeatherWorldNormal\)\.y/,
    );
    assert.ok(
        shader.fragmentShader.indexOf('float grediceWeatherTopness') >
            shader.fragmentShader.indexOf('#include <color_fragment>'),
    );
    assert.ok(
        shader.fragmentShader.indexOf('float grediceWeatherTopness') <
            shader.fragmentShader.indexOf('#include <aomap_fragment>'),
        'combined rain computation remains at the color stage',
    );
    assert.deepEqual(
        Reflect.get(shader.uniforms, 'uGrediceRainBoundsMin').value.toArray(),
        [-2, -0.25, -3],
    );
    assert.deepEqual(
        Reflect.get(shader.uniforms, 'uGrediceRainBoundsMax').value.toArray(),
        [4, 0.75, 5],
    );
    assert.match(
        shader.fragmentShader,
        /vec3 grediceWeatherRainLocal =[\s\S]*vGrediceWeatherWorldPosition -[\s\S]*uGrediceRainBoundsMin[\s\S]*uGrediceRainBoundsMax -[\s\S]*uGrediceRainBoundsMin/,
    );
    assert.match(
        shader.fragmentShader,
        /grediceWeatherFragmentNoise\(\s*grediceWeatherRainLocal \* 17\.0/,
    );
    assert.match(
        shader.fragmentShader,
        /grediceWeatherFragmentNoise\(\s*grediceWeatherRainLocal \* 23\.0/,
    );
    assert.doesNotMatch(
        shader.fragmentShader,
        /vGrediceWeatherWorldPosition \* (17|23)\.0/,
    );
    assert.match(shader.fragmentShader, /pow\(grediceWeatherNormalY, 20\.0\)/);
    assert.doesNotMatch(
        shader.fragmentShader,
        /pow\(grediceWeatherTopness, 20\.0\)/,
    );
    assert.doesNotMatch(
        shader.fragmentShader,
        /mix\(\s*roughnessFactor,\s*0\.18/,
    );
    assert.ok(
        shader.fragmentShader.indexOf('#include <fog_fragment>') <
            shader.fragmentShader.indexOf('float grediceWeatherRainAlpha'),
        'legacy rain blending happens in final output space after fog',
    );
    assert.ok(
        shader.fragmentShader.indexOf('float grediceWeatherRainAlpha') <
            shader.fragmentShader.indexOf('#include <dithering_fragment>'),
        'dithering remains the final output step',
    );
    assert.match(
        shader.fragmentShader,
        /uGrediceSnowNoiseInfluence[\s\S]*\),\s*0\.0,\s*1\.0/,
    );
    assert.match(
        shader.fragmentShader,
        /grediceWeatherEarlySnowStrength >= 0\.01[\s\S]*vGrediceSnowSurface > 0\.5[\s\S]*return;/,
    );
    const fastSnowPath = shader.fragmentShader.slice(
        shader.fragmentShader.indexOf('float grediceWeatherEarlySnowCoverage'),
        shader.fragmentShader.indexOf('float grediceWeatherSnowCoverage'),
    );
    assert.match(fastSnowPath, /#include <fog_fragment>/);
    assert.doesNotMatch(fastSnowPath, /#include <colorspace_fragment>/);
    assert.doesNotMatch(fastSnowPath, /#include <tonemapping_fragment>/);
    assert.doesNotMatch(
        shader.fragmentShader,
        /uGrediceSnowNoiseInfluence\s*\*\s*uGrediceSnowAmount/,
    );
    assert.doesNotMatch(
        shader.fragmentShader,
        /\bdiscard\b/,
        'opaque terrain must retain early depth testing',
    );
    assert.equal(
        material.customProgramCacheKey(),
        `ground-patch:grass|${getWeatherSurfacePluginVariantKey('combined')}`,
    );
    assert.equal(source.userData.grediceWeatherSurface, undefined);
    assert.equal(material.userData.grediceWeatherSurface, true);
    assert.equal(material.userData.grediceWeatherSurfacePluginMode, 'combined');
    assert.equal(
        material.userData.grediceWeatherSurfacePluginVariantKey,
        getWeatherSurfacePluginVariantKey('combined'),
    );

    material.dispose();
    source.dispose();
});

test('cloud attenuation decorates an integrated clone exactly once', () => {
    const source = new MeshStandardMaterial();
    source.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `#include <color_fragment>
float grediceGroundPatchApplied = 1.0;`,
        );
    };
    source.customProgramCacheKey = () => 'ground-patch:grass';
    const uniforms = getCloudShadowAttenuationMaterialUniforms();
    const sourceCloudLease = retainCloudShadowAttenuationMaterial(
        source,
        uniforms,
    );
    const material = createIntegratedWeatherSurfaceMaterial(source, options);
    const integratedCloudLease = retainCloudShadowAttenuationMaterial(
        material,
        uniforms,
    );
    const shader = shaderFixture();

    Reflect.apply(material.onBeforeCompile, material, [shader, undefined]);

    assert.equal(
        shader.vertexShader.match(
            /varying vec3 vGrediceCloudShadowWorldPosition;/g,
        )?.length ?? 0,
        0,
    );
    assert.equal(
        shader.fragmentShader.match(
            /varying vec3 vGrediceCloudShadowWorldPosition;/g,
        )?.length ?? 0,
        0,
    );
    assert.equal(
        shader.vertexShader.match(/varying vec3 vGrediceWeatherWorldPosition;/g)
            ?.length,
        1,
    );
    assert.match(shader.fragmentShader, /vGrediceWeatherWorldPosition\.xz/);
    assert.match(shader.fragmentShader, /grediceGroundPatchApplied/);
    assert.match(shader.fragmentShader, /grediceCloudShadowAttenuation/);
    assert.equal(
        material.customProgramCacheKey(),
        `ground-patch:grass|${getWeatherSurfacePluginVariantKey('combined')}|gredice-cloud-shadow-attenuation-v1`,
    );

    integratedCloudLease.release();
    sourceCloudLease.release();
    material.dispose();
    source.dispose();
});

test('ground patches reuse the integrated weather world position varying', () => {
    const source = applyGroundPatchMaterial(
        new MeshStandardMaterial(),
        'grass',
        {},
    );
    const material = createIntegratedWeatherSurfaceMaterial(source, options);
    const shader = shaderFixture();

    Reflect.apply(material.onBeforeCompile, material, [shader, undefined]);

    assert.equal(
        shader.vertexShader.match(/varying vec3 vGrediceWeatherWorldPosition;/g)
            ?.length,
        1,
    );
    assert.equal(
        shader.fragmentShader.match(
            /varying vec3 vGrediceWeatherWorldPosition;/g,
        )?.length,
        1,
    );
    assert.doesNotMatch(shader.vertexShader, /vGroundPatchWorldPosition/);
    assert.doesNotMatch(shader.fragmentShader, /vGroundPatchWorldPosition/);
    assert.doesNotMatch(shader.vertexShader, /vec4 groundPatchWorldPosition/);
    assert.match(
        shader.fragmentShader,
        /applyGroundPatches\(diffuseColor\.rgb, vGrediceWeatherWorldPosition\)/,
    );
    assert.ok(
        shader.fragmentShader.indexOf(
            'diffuseColor.rgb = applyGroundPatches(',
        ) < shader.fragmentShader.indexOf('float grediceWeatherSnowCoverage'),
    );

    material.dispose();
    source.dispose();
});

test('rain-only specialization omits every snow shader input and operation', () => {
    const source = new MeshStandardMaterial();
    source.customProgramCacheKey = () => 'base';
    const material = createIntegratedWeatherSurfaceMaterial(source, {
        rain: options.rain,
        snow: {
            ...options.snow,
            enabled: false,
        },
    });
    const shader = shaderFixture();

    Reflect.apply(material.onBeforeCompile, material, [shader, undefined]);

    assert.match(
        shader.vertexShader,
        /varying float vGrediceWeatherWorldNormalY;/,
    );
    assert.match(
        shader.fragmentShader,
        /varying float vGrediceWeatherWorldNormalY;/,
    );
    assert.doesNotMatch(
        shader.vertexShader,
        /varying vec3 vGrediceWeatherWorldNormal;/,
    );
    assert.doesNotMatch(
        shader.fragmentShader,
        /varying vec3 vGrediceWeatherWorldNormal;/,
    );
    assert.match(
        shader.vertexShader,
        /vGrediceWeatherWorldNormalY = normalize\(\s*inverseTransformDirection\(transformedNormal, viewMatrix\)\s*\)\.y;/,
    );
    assert.match(shader.vertexShader, /vGrediceWeatherWorldPosition/);
    assert.match(shader.fragmentShader, /grediceWeatherRainLocal/);
    assert.match(shader.fragmentShader, /grediceWeatherRainAlpha/);
    assert.doesNotMatch(
        shader.fragmentShader,
        /normalize\(vGrediceWeatherWorldNormal/,
    );
    const colorStage = shader.fragmentShader.slice(
        shader.fragmentShader.indexOf('#include <color_fragment>'),
        shader.fragmentShader.indexOf('#include <aomap_fragment>'),
    );
    assert.doesNotMatch(
        colorStage,
        /grediceWeatherTopness|grediceWeatherRainLocal|grediceWeatherWet/,
    );
    const rainComputationIndex = shader.fragmentShader.indexOf(
        'float grediceWeatherTopness',
    );
    const rainOutputIndex = shader.fragmentShader.indexOf(
        'float grediceWeatherRainAlpha',
    );
    assert.equal(
        shader.fragmentShader.match(/float grediceWeatherTopness/g)?.length,
        1,
    );
    assert.ok(
        rainComputationIndex >
            shader.fragmentShader.indexOf('#include <fog_fragment>'),
        'rain-only computation runs after the base PBR output and fog',
    );
    assert.ok(rainOutputIndex > rainComputationIndex);
    assert.ok(
        rainOutputIndex <
            shader.fragmentShader.indexOf('#include <dithering_fragment>'),
    );
    assert.doesNotMatch(
        shader.fragmentShader.slice(rainComputationIndex, rainOutputIndex),
        /#include </,
        'rain-only computation is adjacent to its final output blend',
    );
    assert.match(
        shader.fragmentShader,
        /grediceWeatherNormalY = max\(\s*vGrediceWeatherWorldNormalY,\s*0\.0\s*\);\s*if \(grediceWeatherNormalY > 0\.0\) \{[\s\S]*vec3 grediceWeatherRainLocal/,
    );
    assert.match(
        shader.fragmentShader,
        /float grediceWeatherPuddleMask =[\s\S]*if \(grediceWeatherPuddleMask > 0\.0\) \{\s*float grediceWeatherPuddleNoise =\s*grediceWeatherFragmentNoise/,
    );
    assert.doesNotMatch(
        shader.vertexShader,
        /aSnow|aWeather|uGrediceSnow|vGrediceSnow|grediceSnow|grediceWeatherNoise/,
    );
    assert.doesNotMatch(
        shader.fragmentShader,
        /uGrediceSnow|vGrediceSnow|grediceWeatherSnow|grediceWeatherEarlySnow/,
    );
    assert.doesNotMatch(
        shader.fragmentShader,
        /roughnessFactor\s*=\s*mix|metalnessFactor\s*=\s*mix/,
    );
    assert.equal(
        Object.keys(shader.uniforms).some((key) =>
            key.startsWith('uGrediceSnow'),
        ),
        false,
    );
    assert.equal(
        material.customProgramCacheKey(),
        `base|${getWeatherSurfacePluginVariantKey('rain-only')}`,
    );

    material.dispose();
    source.dispose();
});

test('snow-only specialization omits every rain shader input and operation', () => {
    const source = new MeshStandardMaterial();
    source.customProgramCacheKey = () => 'base';
    const material = createIntegratedWeatherSurfaceMaterial(source, {
        rain: {
            ...options.rain,
            enabled: false,
        },
        snow: options.snow,
    });
    const shader = shaderFixture();

    Reflect.apply(material.onBeforeCompile, material, [shader, undefined]);

    assert.match(shader.vertexShader, /aSnowTopDistance/);
    assert.match(shader.vertexShader, /grediceWeatherNoise/);
    assert.doesNotMatch(shader.vertexShader, /vGrediceWeatherWorldNormal/);
    assert.doesNotMatch(shader.fragmentShader, /vGrediceWeatherWorldNormal/);
    assert.doesNotMatch(
        shader.vertexShader,
        /varying float vGrediceWeatherWorldNormalY;/,
    );
    assert.match(shader.vertexShader, /dot\(vNormal, viewMatrix\[1\]\.xyz\)/);
    assert.doesNotMatch(
        shader.vertexShader,
        /inverseTransformDirection\(transformedNormal, viewMatrix\)/,
    );
    assert.match(
        shader.fragmentShader,
        /vec3 grediceWeatherEarlyNormal = normalize\(vNormal\);/,
    );
    assert.doesNotMatch(shader.fragmentShader, /mat3\(viewMatrix\)/);
    assert.match(shader.fragmentShader, /grediceWeatherEarlySnowStrength/);
    assert.match(shader.fragmentShader, /grediceWeatherSnowStrength/);
    assert.match(shader.fragmentShader, /roughnessFactor\s*=\s*mix/);
    assert.match(shader.fragmentShader, /metalnessFactor\s*=\s*mix/);
    assert.doesNotMatch(shader.vertexShader, /uGrediceRain|grediceWeatherRain/);
    assert.doesNotMatch(
        shader.fragmentShader,
        /uGrediceRain|grediceWeatherRain|grediceWeatherWet|grediceWeatherPuddle|grediceWeatherFragmentNoise/,
    );
    assert.equal(
        Object.keys(shader.uniforms).some((key) =>
            key.startsWith('uGrediceRain'),
        ),
        false,
    );
    assert.equal(
        material.customProgramCacheKey(),
        `base|${getWeatherSurfacePluginVariantKey('snow-only')}`,
    );

    material.dispose();
    source.dispose();
});

test('snow-only flat shading retains the custom world-normal fallback', () => {
    const source = new MeshStandardMaterial({ flatShading: true });
    source.customProgramCacheKey = () => 'base-flat';
    const material = createIntegratedWeatherSurfaceMaterial(source, {
        rain: {
            ...options.rain,
            enabled: false,
        },
        snow: options.snow,
    });
    const shader = shaderFixture();

    Reflect.apply(material.onBeforeCompile, material, [shader, undefined]);

    assert.match(
        shader.vertexShader,
        /varying vec3 vGrediceWeatherWorldNormal;/,
    );
    assert.match(
        shader.fragmentShader,
        /varying vec3 vGrediceWeatherWorldNormal;/,
    );
    assert.match(
        shader.vertexShader,
        /inverseTransformDirection\(transformedNormal, viewMatrix\)/,
    );
    assert.match(
        shader.vertexShader,
        /dot\(grediceWeatherWorldNormal, grediceWeatherWorldUp\)/,
    );
    assert.match(
        shader.vertexShader,
        /vGrediceWeatherWorldNormal = grediceWeatherWorldNormal;/,
    );
    assert.match(
        shader.fragmentShader,
        /mat3\(viewMatrix\) \*[\s\S]*normalize\(vGrediceWeatherWorldNormal\)/,
    );
    assert.doesNotMatch(
        shader.vertexShader,
        /dot\(vNormal, viewMatrix\[1\]\.xyz\)/,
    );
    assert.doesNotMatch(
        shader.fragmentShader,
        /grediceWeatherEarlyNormal = normalize\(vNormal\)/,
    );
    assert.equal(
        material.customProgramCacheKey(),
        `base-flat|${getWeatherSurfacePluginVariantKey('snow-only')}`,
    );

    material.dispose();
    source.dispose();
});

test('weather plugin modes have three distinct bounded program keys', () => {
    assert.equal(
        resolveWeatherSurfacePluginMode({
            rainEnabled: true,
            snowEnabled: false,
        }),
        'rain-only',
    );
    assert.equal(
        resolveWeatherSurfacePluginMode({
            rainEnabled: false,
            snowEnabled: true,
        }),
        'snow-only',
    );
    assert.equal(
        resolveWeatherSurfacePluginMode({
            rainEnabled: true,
            snowEnabled: true,
        }),
        'combined',
    );
    assert.throws(
        () =>
            resolveWeatherSurfacePluginMode({
                rainEnabled: false,
                snowEnabled: false,
            }),
        /requires rain, snow, or both/,
    );
    assert.equal(
        new Set(
            (['rain-only', 'snow-only', 'combined'] as const).map(
                getWeatherSurfacePluginVariantKey,
            ),
        ).size,
        3,
    );
});

test('weather values stay uniforms instead of multiplying program variants', () => {
    const source = new MeshStandardMaterial();
    source.customProgramCacheKey = () => 'base';
    const clear = createIntegratedWeatherSurfaceMaterial(source, options);
    const storm = createIntegratedWeatherSurfaceMaterial(source, {
        rain: {
            ...options.rain,
            darkness: 0.6,
            wetnessUniform: { value: 1 },
        },
        snow: {
            ...options.snow,
            amountUniform: { value: 0 },
            maxThickness: 0.4,
        },
    });

    assert.equal(clear.customProgramCacheKey(), storm.customProgramCacheKey());

    clear.dispose();
    storm.dispose();
    source.dispose();
});

test('weather integration accepts only opaque depth-writing standard materials', () => {
    const standard = new MeshStandardMaterial();
    assert.equal(supportsIntegratedWeatherSurfaceMaterial(standard), true);

    standard.transparent = true;
    assert.equal(supportsIntegratedWeatherSurfaceMaterial(standard), false);
    standard.transparent = false;
    standard.depthWrite = false;
    assert.equal(supportsIntegratedWeatherSurfaceMaterial(standard), false);
    standard.depthWrite = true;
    standard.blending = AdditiveBlending;
    assert.equal(supportsIntegratedWeatherSurfaceMaterial(standard), false);

    assert.equal(
        supportsIntegratedWeatherSurfaceMaterial(new MeshBasicMaterial()),
        false,
    );
    assert.equal(
        supportsIntegratedWeatherSurfaceMaterial(new ShaderMaterial()),
        false,
    );
});
