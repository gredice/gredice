import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    AdditiveBlending,
    BoxGeometry,
    Color,
    DoubleSide,
    Mesh,
    MeshPhysicalMaterial,
    MeshStandardMaterial,
    ShaderLib,
    Texture,
    UniformsUtils,
} from 'three';
import { applyGroundPatchMaterial } from '../entities/helpers/groundPatchMaterial';
import {
    compileMeshBufferSources,
    packMeshGeometry,
    unpackMeshGeometry,
} from './compiler/meshBuffers';
import {
    acquireOwnedSharedGardenMaterial,
    classifyGardenMaterial,
    getGardenMaterialSignature,
} from './gardenMaterials';
import {
    createGardenPaletteGeometry,
    createGardenPaletteMaterial,
    getGardenPaletteMaterialSignature,
} from './gardenPaletteMaterials';
import { isStaticOpaqueSceneCacheReplayEligible } from './staticOpaqueSceneCacheReplay';
import {
    createIntegratedWeatherSurfaceMaterial,
    type WeatherSurfaceMaterialOptions,
} from './weatherSurfaceMaterial';

function shader(material: MeshStandardMaterial) {
    const program = {
        fragmentShader: ShaderLib.standard.fragmentShader,
        vertexShader: ShaderLib.standard.vertexShader,
        uniforms: UniformsUtils.clone(ShaderLib.standard.uniforms),
    };
    Reflect.apply(material.onBeforeCompile, material, [program, undefined]);
    return program;
}

function weatherOptions(): WeatherSurfaceMaterialOptions {
    return {
        frostIntensityUniform: { value: 0 },
        rain: {
            bounds: { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
            darkness: 1,
            enabled: true,
            glossiness: 0.7,
            puddleStrengthUniform: { value: 0 },
            topSurfaceBias: 1.8,
            wetnessUniform: { value: 0.75 },
        },
        snow: {
            amountUniform: { value: 0.5 },
            color: '#f7f7ff',
            enabled: true,
            lift: 0.003,
            maxThickness: 0.18,
            noiseAmplitude: 0.35,
            noiseInfluence: 0.15,
            noiseScale: 2.5,
            slopeExponent: 2.4,
        },
    };
}

describe('garden palette packets', () => {
    it('shares different palette/PBR values but preserves every other material input', () => {
        const first = new MeshStandardMaterial({
            color: '#aabbcc',
            roughness: 0.9,
            metalness: 0.1,
        });
        const second = new MeshStandardMaterial({
            color: '#332211',
            roughness: 0.2,
            metalness: 0.8,
            emissive: '#112233',
            emissiveIntensity: 2,
        });
        assert.equal(
            getGardenPaletteMaterialSignature(first),
            getGardenPaletteMaterialSignature(second),
        );
        for (const change of [
            (material: MeshStandardMaterial) => {
                material.map = new Texture();
            },
            (material: MeshStandardMaterial) => {
                material.side = DoubleSide;
            },
            (material: MeshStandardMaterial) => {
                material.alphaTest = 0.5;
            },
            (material: MeshStandardMaterial) => {
                material.vertexColors = true;
            },
        ]) {
            const changed = first.clone();
            change(changed);
            assert.notEqual(
                getGardenPaletteMaterialSignature(first),
                getGardenPaletteMaterialSignature(changed),
            );
        }
        assert.equal(
            getGardenPaletteMaterialSignature(new MeshPhysicalMaterial()),
            undefined,
        );
        const unknown = first.clone();
        unknown.onBeforeCompile = () => {};
        assert.equal(getGardenPaletteMaterialSignature(unknown), undefined);
    });

    it('keeps source-local palette attributes unchanged through the heterogeneous compiler', () => {
        const geometry = new BoxGeometry();
        geometry.setAttribute('color', geometry.getAttribute('normal').clone());
        const first = new MeshStandardMaterial({
            color: '#aabbcc',
            roughness: 0.8,
            metalness: 0.2,
            emissive: '#332211',
            emissiveIntensity: 3,
            vertexColors: true,
        });
        const second = new MeshStandardMaterial({
            color: '#112233',
            roughness: 0.4,
            metalness: 0.7,
        });
        const prepared = createGardenPaletteGeometry(geometry, first);
        assert.equal(geometry.getAttribute('aGardenPalette0'), undefined);
        assert.notEqual(
            prepared.getAttribute('position').array,
            geometry.getAttribute('position').array,
        );
        assert.deepEqual(
            prepared.getAttribute('color').array,
            geometry.getAttribute('color').array,
        );
        const matrices = new Float64Array([
            1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 20, 3, 5, 1,
        ]);
        const compiled = unpackMeshGeometry(
            compileMeshBufferSources([
                { source: packMeshGeometry(prepared), matrices },
                {
                    source: packMeshGeometry(
                        createGardenPaletteGeometry(geometry, second),
                    ),
                    matrices,
                },
            ]),
        );
        const count = geometry.getAttribute('position').count;
        assert.deepEqual(
            Array.from(
                compiled.getAttribute('aGardenPalette0').array.slice(0, 4),
            ),
            Array.from(
                new Float32Array([
                    first.color.r,
                    first.color.g,
                    first.color.b,
                    first.roughness,
                ]),
            ),
        );
        assert.deepEqual(
            Array.from(
                compiled.getAttribute('aGardenPalette1').array.slice(0, 4),
            ),
            Array.from(
                new Float32Array([
                    first.emissive.r * 3,
                    first.emissive.g * 3,
                    first.emissive.b * 3,
                    first.metalness,
                ]),
            ),
        );
        assert.deepEqual(
            Array.from(
                compiled
                    .getAttribute('aGardenPalette0')
                    .array.slice(count * 4, count * 4 + 4),
            ),
            Array.from(
                new Float32Array([
                    second.color.r,
                    second.color.g,
                    second.color.b,
                    second.roughness,
                ]),
            ),
        );
        assert.equal(
            compiled.getAttribute('position').getX(0),
            prepared.getAttribute('position').getX(0) + 20,
        );
    });

    it('composes palette inputs before ground patches and weather, while retaining mapped PBR inputs', () => {
        const options = weatherOptions();
        const source = applyGroundPatchMaterial(
            new MeshStandardMaterial({ color: '#aabbcc' }),
            'dirt',
            {},
        );
        const integrated = createIntegratedWeatherSurfaceMaterial(
            source,
            options,
        );
        const palette = createGardenPaletteMaterial(integrated);
        const program = shader(palette);
        const tint = program.fragmentShader.indexOf(
            'diffuseColor.rgb *= vGardenPalette0.rgb;',
        );
        assert.ok(tint >= 0);
        assert.ok(
            tint <
                program.fragmentShader.indexOf(
                    'diffuseColor.rgb = applyGroundPatches',
                ),
        );
        assert.ok(
            tint <
                program.fragmentShader.indexOf(
                    'float grediceWeatherSnowCoverage',
                ),
        );
        assert.match(
            program.fragmentShader,
            /float roughnessFactor = vGardenPalette0\.a;/,
        );
        assert.match(
            program.fragmentShader,
            /roughnessFactor \*= texelRoughness\.g/,
        );
        assert.match(
            program.fragmentShader,
            /float metalnessFactor = vGardenPalette1\.a;/,
        );
        assert.match(
            program.fragmentShader,
            /metalnessFactor \*= texelMetalness\.b/,
        );
        assert.match(
            program.fragmentShader,
            /vec3 totalEmissiveRadiance = vGardenPalette1\.rgb;/,
        );
        assert.equal(
            program.uniforms.uGrediceRainWetness,
            options.rain.wetnessUniform,
        );
        assert.equal(
            program.uniforms.uGrediceSnowAmount,
            options.snow.amountUniform,
        );
        assert.equal(palette.alphaTest, integrated.alphaTest);
        assert.equal(palette.alphaMap, integrated.alphaMap);
    });

    it('shares integrated weather only for equal configuration and the same mutable uniform owners', () => {
        const options = weatherOptions();
        const first = createIntegratedWeatherSurfaceMaterial(
            new MeshStandardMaterial({ color: '#aaaaaa' }),
            options,
        );
        const second = createIntegratedWeatherSurfaceMaterial(
            new MeshStandardMaterial({ color: '#bbbbbb' }),
            options,
        );
        assert.ok(getGardenMaterialSignature(first));
        assert.equal(
            getGardenPaletteMaterialSignature(first),
            getGardenPaletteMaterialSignature(second),
        );
        const independentlyUpdated = createIntegratedWeatherSurfaceMaterial(
            new MeshStandardMaterial(),
            weatherOptions(),
        );
        assert.notEqual(
            getGardenPaletteMaterialSignature(first),
            getGardenPaletteMaterialSignature(independentlyUpdated),
        );
        const changedBounds = createIntegratedWeatherSurfaceMaterial(
            new MeshStandardMaterial(),
            {
                ...options,
                rain: {
                    ...options.rain,
                    bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
                },
            },
        );
        assert.notEqual(
            getGardenPaletteMaterialSignature(first),
            getGardenPaletteMaterialSignature(changedBounds),
        );
        first.userData.unregistered = true;
        assert.equal(getGardenPaletteMaterialSignature(first), undefined);
    });

    it('owns generated materials until the last user releases them', () => {
        let created = 0;
        let disposed = 0;
        const create = () => {
            created++;
            const material = createGardenPaletteMaterial(
                new MeshStandardMaterial({ color: new Color('#123456') }),
            );
            material.addEventListener('dispose', () => {
                disposed++;
            });
            return material;
        };
        const first = acquireOwnedSharedGardenMaterial(
            'palette-lifetime-test',
            create,
        );
        const second = acquireOwnedSharedGardenMaterial(
            'palette-lifetime-test',
            create,
        );
        assert.equal(created, 1);
        assert.equal(first.material, second.material);
        first.release();
        assert.equal(disposed, 0);
        second.release();
        second.release();
        assert.equal(disposed, 1);
    });

    it('preserves opaque cache eligibility for stable palettes and keeps moving weather live', () => {
        const source = new MeshStandardMaterial();
        const geometry = new BoxGeometry();
        assert.equal(
            isStaticOpaqueSceneCacheReplayEligible(
                new Mesh(geometry, createGardenPaletteMaterial(source)),
            ),
            true,
        );
        const dirt = applyGroundPatchMaterial(source.clone(), 'dirt', {});
        assert.equal(
            isStaticOpaqueSceneCacheReplayEligible(
                new Mesh(geometry, createGardenPaletteMaterial(dirt)),
            ),
            true,
        );
        const weather = createIntegratedWeatherSurfaceMaterial(
            source,
            weatherOptions(),
        );
        assert.equal(
            isStaticOpaqueSceneCacheReplayEligible(
                new Mesh(geometry, createGardenPaletteMaterial(weather)),
            ),
            false,
        );
    });

    it('keeps transparent effects sorted against weather and other alpha effects', () => {
        const supported = new MeshStandardMaterial({
            transparent: true,
            blending: AdditiveBlending,
            depthWrite: false,
        });
        assert.deepEqual(classifyGardenMaterial(supported), {
            batchable: false,
            family: 'transparent',
            reason: 'transparent',
        });
        supported.depthWrite = true;
        assert.equal(classifyGardenMaterial(supported).batchable, false);
        assert.equal(
            classifyGardenMaterial(
                new MeshStandardMaterial({
                    transparent: true,
                    depthWrite: false,
                }),
            ).batchable,
            false,
        );
    });

    it('retains cutout maps, alpha and shadow/depth state', () => {
        const source = new MeshStandardMaterial({
            color: '#abcdef',
            alphaTest: 0.4,
            alphaMap: new Texture(),
            map: new Texture(),
            side: DoubleSide,
            opacity: 0.9,
            polygonOffset: true,
            polygonOffsetFactor: -1,
        });
        source.clipShadows = true;
        const palette = createGardenPaletteMaterial(source);
        assert.deepEqual(classifyGardenMaterial(palette), {
            batchable: true,
            family: 'cutout',
        });
        for (const key of [
            'alphaTest',
            'alphaMap',
            'map',
            'side',
            'opacity',
            'depthTest',
            'depthWrite',
            'depthFunc',
            'polygonOffset',
            'polygonOffsetFactor',
            'clipShadows',
        ] as const)
            assert.equal(palette[key], source[key]);
        const program = shader(palette);
        assert.match(program.fragmentShader, /#include <alphamap_fragment>/);
        assert.match(program.fragmentShader, /#include <alphatest_fragment>/);
    });

    it('reacquires fresh owned shaders after StrictMode-style cleanup and palette mutation', () => {
        const source = new MeshStandardMaterial({ color: '#123456' });
        const key = getGardenPaletteMaterialSignature(source);
        assert.ok(key);
        let disposed = 0;
        const create = () => {
            const result = createGardenPaletteMaterial(source);
            result.addEventListener('dispose', () => {
                disposed++;
            });
            return result;
        };
        const initial = acquireOwnedSharedGardenMaterial(key, create);
        const initialMaterial = initial.material;
        initial.release();
        const mounted = acquireOwnedSharedGardenMaterial(key, create);
        assert.notEqual(initialMaterial, mounted.material);
        assert.equal(disposed, 1);
        source.color.set('#abcdef');
        source.roughness = 0.25;
        assert.equal(getGardenPaletteMaterialSignature(source), key);
        const prepared = createGardenPaletteGeometry(new BoxGeometry(), source);
        assert.equal(prepared.getAttribute('aGardenPalette0').getW(0), 0.25);
        assert.equal(
            prepared.getAttribute('aGardenPalette0').getX(0),
            Math.fround(source.color.r),
        );
        const consumer = acquireOwnedSharedGardenMaterial(key, create);
        assert.equal(consumer.material, mounted.material);
        mounted.release();
        assert.equal(disposed, 1);
        consumer.release();
        assert.equal(disposed, 2);
    });
});
