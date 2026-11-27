import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    MeshBasicMaterial,
    MeshStandardMaterial,
    Object3D,
    ShaderMaterial,
    Vector4,
} from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import {
    type CloudShadowField,
    type CloudShadowMaterialLeaseMap,
    cloudShadowEllipseCapacity,
    cloudShadowFragmentShaderChunk,
    cloudShadowRules,
    createCloudShadowMaterialUniforms,
    getCloudShadowAttenuationMaterialCandidateRevision,
    getCloudShadowUniformBindingName,
    isCloudShadowLayerActive,
    projectCloudShadowReceiverToGround,
    registerCloudShadowAttenuationMaterialCandidate,
    releaseCloudShadowAttenuationMaterials,
    resolveCloudShadowAttenuationActivation,
    resolveCloudShadowCount,
    resolveCloudShadowEllipses,
    resolveCloudShadowLap,
    resolveCloudShadowOvercast,
    resolveCloudShadowProjection,
    resolveCloudShadowStrength,
    retainCloudShadowAttenuationMaterial,
    supportsCloudShadowAttenuation,
    syncCloudShadowAttenuationMaterials,
} from './cloudShadowAttenuation';
import { resolveCloudShadowField } from './weather/sky/CloudShadowDriver';
import { resolveCloudShadowSpeed } from './weather/windClass';

/** Laps of `field` run at `speed` units per second by `seconds`. */
function lapsAt(field: CloudShadowField, speed: number, seconds: number) {
    return (speed * seconds) / resolveCloudShadowLap(field);
}

const uniforms = createCloudShadowMaterialUniforms();
uniforms.strength.value = 0.8;
const ownedBindings = Object.keys(uniforms).map(
    getCloudShadowUniformBindingName,
);

const islandField = {
    centreX: 0,
    centreZ: 0,
    halfAlong: 3.54,
    halfAcross: 3.54,
};
const wind = { x: -Math.SQRT1_2, z: Math.SQRT1_2 };

function ellipses() {
    return Array.from(
        { length: cloudShadowEllipseCapacity },
        () => new Vector4(),
    );
}

/** Share of the tint at a ground point, as the shader computes it. */
function shadowAt(
    x: number,
    z: number,
    list: Vector4[],
    amounts: number[],
    axis = wind,
) {
    let share = 0;
    for (let index = 0; index < list.length; index += 1) {
        const ellipse = list[index];
        if (!ellipse) continue;
        const dx = x - ellipse.x;
        const dz = z - ellipse.y;
        const along = (dx * axis.x + dz * axis.z) / ellipse.z;
        const across = (dx * -axis.z + dz * axis.x) / ellipse.w;
        const distance = Math.hypot(along, across);
        const t = Math.min(1, Math.max(0, (distance - 0.5) / 0.5));
        share = Math.max(
            share,
            (amounts[index] ?? 0) * (1 - t * t * (3 - 2 * t)),
        );
    }
    return share;
}

describe('cloud shadow ellipses', () => {
    it('shows three shadows when partly cloudy and the tier cap under overcast', () => {
        assert.equal(resolveCloudShadowCount(0.4, 6), 3);
        assert.equal(resolveCloudShadowCount(0.85, 6), 6);
        assert.equal(resolveCloudShadowCount(1, 4), 4);
        assert.equal(resolveCloudShadowCount(0.4, 4), 3);
        assert.equal(resolveCloudShadowCount(1, 0), 0);
        assert.equal(resolveCloudShadowCount(0.4, 0), 0);
    });

    it('takes the time-of-day strength and weakens it under overcast, rain and snow', () => {
        const partly = { cloudy: 0.4, foggy: 0, rainy: 0, snowy: 0 };
        assert.ok(
            Math.abs(resolveCloudShadowStrength(partly, 0.85) - 0.85) < 1e-9,
        );
        assert.ok(
            Math.abs(resolveCloudShadowStrength(partly, 0.5) - 0.5) < 1e-9,
        );
        const overcast = { ...partly, cloudy: 1 };
        assert.ok(
            Math.abs(
                resolveCloudShadowStrength(overcast, 0.85) -
                    0.85 * cloudShadowRules.overcastStrength,
            ) < 1e-9,
        );
        assert.ok(
            Math.abs(
                resolveCloudShadowStrength({ ...overcast, rainy: 1 }, 1) -
                    cloudShadowRules.overcastStrength * 0.8,
            ) < 1e-9,
        );
        assert.ok(
            Math.abs(
                resolveCloudShadowStrength({ ...overcast, snowy: 1 }, 1) -
                    cloudShadowRules.overcastStrength * 0.65,
            ) < 1e-9,
        );
    });

    it('has no shadows under a clear sky or in fog', () => {
        assert.equal(
            resolveCloudShadowStrength(
                { cloudy: 0.04, foggy: 0, rainy: 0, snowy: 0 },
                0.85,
            ),
            0,
        );
        assert.equal(
            resolveCloudShadowStrength(
                { cloudy: 0.6, foggy: 1, rainy: 0, snowy: 0 },
                0.85,
            ),
            0,
        );
    });

    it('moves at (0.16 + 0.05 × wind class), 0.6× under overcast and 40% with reduced motion', () => {
        assert.ok(Math.abs(resolveCloudShadowSpeed(0) - 0.16) < 1e-9);
        assert.ok(Math.abs(resolveCloudShadowSpeed(2) - 0.26) < 1e-9);
        assert.ok(
            Math.abs(resolveCloudShadowSpeed(0, { overcast: 1 }) - 0.096) <
                1e-9,
        );
        assert.ok(
            Math.abs(
                resolveCloudShadowSpeed(0, { reducedMotion: true }) - 0.064,
            ) < 1e-9,
        );
    });

    it('runs three lanes 2.4 apart with radii 1.65 to 2.05 and a solid core', () => {
        const list = ellipses();
        const amounts = Array.from({ length: list.length }, () => 0);
        resolveCloudShadowEllipses({
            amounts,
            count: 6,
            ellipses: list,
            field: islandField,
            overcast: 0,
            strength: 0.85,
            laps: 0,
            axis: wind,
        });
        for (const [index, ellipse] of list.entries()) {
            assert.ok(
                ellipse.z >= 1.65 * 0.85 - 1e-9 &&
                    ellipse.z <= 1.65 * 1.15 + 1e-9,
            );
            const aspect = ellipse.w / ellipse.z;
            assert.ok(
                aspect >= 0.66 - 1e-9 && aspect <= 0.8 + 1e-9,
                `aspect ${aspect}`,
            );
            const across = ellipse.x * -wind.z + ellipse.y * wind.x;
            const lane = (index % 3) - 1;
            assert.ok(
                Math.abs(across - lane * 2.4) <= 0.2 + 1e-9,
                `lane ${index}`,
            );
        }
        const overcastList = ellipses();
        resolveCloudShadowEllipses({
            amounts,
            count: 6,
            ellipses: overcastList,
            field: islandField,
            overcast: 1,
            strength: 0.6,
            laps: 0,
            axis: wind,
        });
        assert.ok((overcastList[0]?.z ?? 0) > (list[0]?.z ?? 0));
        // The core is solid: the full amount inside half the radius.
        const first = overcastList[0];
        assert.ok(first);
        assert.ok(
            Math.abs(
                shadowAt(first.x, first.y, overcastList, amounts) -
                    Math.max(...amounts),
            ) < 0.6,
        );
    });

    it('travels along the wind, fades at the field ends and never exceeds the strength', () => {
        const list = ellipses();
        const amounts = Array.from({ length: list.length }, () => 0);
        const before = ellipses();
        resolveCloudShadowEllipses({
            amounts,
            count: 6,
            ellipses: before,
            field: islandField,
            overcast: 0,
            strength: 0.85,
            laps: lapsAt(islandField, 0.2, 10),
            axis: wind,
        });
        resolveCloudShadowEllipses({
            amounts,
            count: 6,
            ellipses: list,
            field: islandField,
            overcast: 0,
            strength: 0.85,
            laps: lapsAt(islandField, 0.2, 11),
            axis: wind,
        });
        let moved = 0;
        for (const [index, ellipse] of list.entries()) {
            const previous = before[index];
            assert.ok(previous);
            const step =
                (ellipse.x - previous.x) * wind.x +
                (ellipse.y - previous.y) * wind.z;
            const sideways =
                (ellipse.x - previous.x) * -wind.z +
                (ellipse.y - previous.y) * wind.x;
            assert.ok(Math.abs(sideways) < 1e-9);
            if (Math.abs(step - 0.2) < 1e-9) moved += 1;
        }
        // All but a shadow that wrapped this second moved 0.2 downwind.
        assert.ok(moved >= 5);
        for (const amount of amounts) {
            assert.ok(amount >= 0 && amount <= 0.85 + 1e-9);
        }
        // At the very end of its travel a shadow is gone.
        const span = islandField.halfAlong + cloudShadowRules.travelMargin;
        const wrapList = ellipses();
        const wrapAmounts = Array.from({ length: list.length }, () => 0);
        for (let t = 0; t < 200; t += 0.5) {
            resolveCloudShadowEllipses({
                amounts: wrapAmounts,
                count: 1,
                ellipses: wrapList,
                field: islandField,
                overcast: 0,
                strength: 0.85,
                laps: lapsAt(islandField, 0.2, t),
                axis: wind,
            });
            const along =
                (wrapList[0]?.x ?? 0) * wind.x + (wrapList[0]?.y ?? 0) * wind.z;
            if (Math.abs(along) > span - 0.05) {
                assert.ok((wrapAmounts[0] ?? 1) < 0.02);
            }
        }
    });

    it('shades about an eighth of the island when partly cloudy and more under overcast', () => {
        const coverage = (
            overcast: number,
            count: number,
            strength: number,
        ) => {
            const list = ellipses();
            const amounts = Array.from({ length: list.length }, () => 0);
            let shaded = 0;
            let samples = 0;
            for (let t = 0; t < 120; t += 4) {
                resolveCloudShadowEllipses({
                    amounts,
                    count,
                    ellipses: list,
                    field: islandField,
                    overcast,
                    strength,
                    laps: lapsAt(islandField, 0.2, t),
                    axis: wind,
                });
                for (let x = -2.4; x <= 2.4; x += 0.2) {
                    for (let z = -2.4; z <= 2.4; z += 0.2) {
                        samples += 1;
                        if (shadowAt(x, z, list, amounts) > strength * 0.5) {
                            shaded += 1;
                        }
                    }
                }
            }
            return shaded / samples;
        };
        const partly = coverage(resolveCloudShadowOvercast(0.4), 3, 0.85);
        const overcast = coverage(resolveCloudShadowOvercast(0.9), 6, 0.6);
        assert.ok(partly > 0.06 && partly < 0.22, `partly ${partly}`);
        assert.ok(overcast > partly, `overcast ${overcast}`);
    });

    it('runs either way along the axis and keeps its place when the field changes', () => {
        const place = (laps: number, field: CloudShadowField = islandField) => {
            const list = ellipses();
            const amounts = Array.from({ length: list.length }, () => 0);
            resolveCloudShadowEllipses({
                amounts,
                axis: wind,
                count: 3,
                ellipses: list,
                field,
                laps,
                overcast: 0,
                strength: 0.85,
            });
            return list.slice(0, 3);
        };
        const along = (ellipse: Vector4) =>
            ellipse.x * wind.x + ellipse.y * wind.z;
        const across = (ellipse: Vector4) =>
            ellipse.x * -wind.z + ellipse.y * wind.x;
        const lap = resolveCloudShadowLap(islandField);
        const start = place(1000);
        const ahead = place(1000 + 0.1 / lap);
        const back = place(1000 - 0.1 / lap);
        for (const [index, ellipse] of start.entries()) {
            const forward = ahead[index];
            const backward = back[index];
            assert.ok(forward && backward);
            // A shadow that did not wrap moved 0.1 along the axis either way,
            // in its lane.
            if (Math.abs(along(forward) - along(ellipse)) < 1) {
                assert.ok(
                    Math.abs(along(forward) - along(ellipse) - 0.1) < 1e-6,
                );
                assert.ok(Math.abs(across(forward) - across(ellipse)) < 1e-9);
            }
            if (Math.abs(along(backward) - along(ellipse)) < 1) {
                assert.ok(
                    Math.abs(along(backward) - along(ellipse) + 0.1) < 1e-6,
                );
            }
        }
        // A slightly longer field (the view turning) only stretches the
        // lap: far into a session the shadows barely move.
        const longer = place(1000, { ...islandField, halfAlong: 3.6 });
        for (const [index, ellipse] of start.entries()) {
            const stretched = longer[index];
            assert.ok(stretched);
            assert.ok(Math.abs(along(stretched) - along(ellipse)) < 0.1);
        }
    });

    it('spreads the lanes over a field wider than the target island', () => {
        const list = ellipses();
        const amounts = Array.from({ length: list.length }, () => 0);
        resolveCloudShadowEllipses({
            amounts,
            count: 3,
            ellipses: list,
            field: { centreX: 10, centreZ: -4, halfAlong: 9, halfAcross: 10 },
            overcast: 0,
            strength: 0.85,
            laps: 0,
            axis: { x: 1, z: 0 },
        });
        const acrossValues = list
            .slice(0, 3)
            .map((ellipse) => ellipse.y + 4)
            .sort((a, b) => a - b);
        assert.ok((acrossValues[2] ?? 0) - (acrossValues[0] ?? 0) > 10);
    });
});

describe('cloud shadow field', () => {
    const garden = (width: number, depth: number) =>
        Array.from({ length: width * depth }, (_, index) => ({
            position: { x: index % width, y: 0, z: Math.floor(index / width) },
        }));
    const diagonal = { x: -Math.SQRT1_2, z: Math.SQRT1_2 };

    it('measures a rectangle along its sides like its bounding box', () => {
        const field = resolveCloudShadowField(garden(6, 4), { x: 1, z: 0 });
        assert.ok(Math.abs(field.centreX - 2.5) < 1e-9);
        assert.ok(Math.abs(field.centreZ - 1.5) < 1e-9);
        assert.ok(Math.abs(field.halfAlong - 3) < 1e-9);
        assert.ok(Math.abs(field.halfAcross - 2) < 1e-9);
        assert.deepEqual(resolveCloudShadowField(undefined, diagonal), {
            centreX: 0,
            centreZ: 0,
            halfAlong: 2.5,
            halfAcross: 2.5,
        });
    });

    it('keeps the shadows over the garden when they cross it on the diagonal', () => {
        // Share of the garden in shadow over time, crossing it along a side
        // and (sideways on screen) on the diagonal.
        const coverage = (
            stacks: ReturnType<typeof garden>,
            axis: { x: number; z: number },
        ) => {
            const field = resolveCloudShadowField(stacks, axis);
            const list = ellipses();
            const amounts = Array.from({ length: list.length }, () => 0);
            let shaded = 0;
            let samples = 0;
            for (let t = 0; t < 300; t += 3) {
                resolveCloudShadowEllipses({
                    amounts,
                    axis,
                    count: 6,
                    ellipses: list,
                    field,
                    laps: lapsAt(field, 0.13, t),
                    overcast: 1,
                    strength: 1,
                });
                for (const { position } of stacks) {
                    samples += 1;
                    if (
                        shadowAt(position.x, position.z, list, amounts, axis) >
                        0.5
                    ) {
                        shaded += 1;
                    }
                }
            }
            return shaded / samples;
        };
        for (const [width, depth] of [
            [5, 5],
            [16, 10],
        ] as const) {
            const stacks = garden(width, depth);
            const side = coverage(stacks, { x: 1, z: 0 });
            const across = coverage(stacks, diagonal);
            assert.ok(
                across > 0.8 * side,
                `${width} x ${depth}: ${across} vs ${side}`,
            );
        }
    });
});

describe('cloud shadow world projection', () => {
    it('maps raised receivers onto the same sun ray as the ground footprint', () => {
        const projection = { x: 0.5, z: -0.25 };
        const ground = projectCloudShadowReceiverToGround(
            { x: 7, y: 0, z: 4.5 },
            projection,
        );
        const raised = projectCloudShadowReceiverToGround(
            { x: 8, y: 2, z: 4 },
            projection,
        );

        assert.deepEqual(raised, ground);
    });

    it('projects along the key light and clamps grazing light', () => {
        assert.deepEqual(resolveCloudShadowProjection({ x: 5, y: 10, z: -6 }), {
            x: 0.5,
            z: -0.6,
        });
        assert.deepEqual(resolveCloudShadowProjection({ x: 9, y: 1, z: 0 }), {
            x: 1.5,
            z: 0,
        });
        assert.deepEqual(resolveCloudShadowProjection({ x: 1, y: 0, z: 1 }), {
            x: 0,
            z: 0,
        });
    });
});

describe('cloud shadow activation', () => {
    it('activates lazily and remains active after weather clears', () => {
        assert.equal(
            resolveCloudShadowAttenuationActivation({
                activated: false,
                strength: 0,
            }),
            false,
        );
        assert.equal(
            resolveCloudShadowAttenuationActivation({
                activated: false,
                strength: Number.NaN,
            }),
            false,
        );
        assert.equal(
            resolveCloudShadowAttenuationActivation({
                activated: false,
                strength: 0.2,
            }),
            true,
        );
        assert.equal(
            resolveCloudShadowAttenuationActivation({
                activated: true,
                strength: 0,
            }),
            true,
        );
    });

    it('reports an active shadow layer only while it drives the uniforms', () => {
        const table = createCloudShadowMaterialUniforms();
        assert.equal(isCloudShadowLayerActive(table), false);
        table.active.value = 1;
        assert.equal(isCloudShadowLayerActive(table), true);
    });
});

describe('cloud shadow material integration', () => {
    it('skips the ellipses when cloud strength is zero and tints all light', () => {
        assert.match(
            cloudShadowFragmentShaderChunk,
            /if \( grediceCloudShadowStrength > 0\.001 \)/,
        );
        assert.ok(
            cloudShadowFragmentShaderChunk.indexOf(
                'grediceCloudShadowStrength > 0.001',
            ) <
                cloudShadowFragmentShaderChunk.indexOf(
                    'grediceCloudShadowAmount(',
                ),
        );
        for (const term of [
            'directDiffuse',
            'directSpecular',
            'indirectDiffuse',
            'indirectSpecular',
        ]) {
            assert.match(
                cloudShadowFragmentShaderChunk,
                new RegExp(
                    `reflectedLight\\.${term} \\*= grediceCloudShadowAttenuation`,
                ),
            );
        }
        assert.match(cloudShadowFragmentShaderChunk, /grediceCloudShadowTint/);
    });

    it('composes and restores exact material shader hooks', () => {
        const material = new MeshStandardMaterial();
        let originalHookCallCount = 0;
        material.onBeforeCompile = (shader) => {
            originalHookCallCount += 1;
            shader.fragmentShader = shader.fragmentShader.replace(
                'void main()',
                '// existing material hook\nvoid main()',
            );
        };
        material.customProgramCacheKey = () => 'existing-cache-key';
        const originalOnBeforeCompile = material.onBeforeCompile;
        const originalCustomProgramCacheKey = material.customProgramCacheKey;
        const leaseA = retainCloudShadowAttenuationMaterial(material, uniforms);
        const patchedOnBeforeCompile = material.onBeforeCompile;
        const patchedCustomProgramCacheKey = material.customProgramCacheKey;
        const leaseB = retainCloudShadowAttenuationMaterial(material, uniforms);

        assert.notEqual(patchedOnBeforeCompile, originalOnBeforeCompile);
        assert.notEqual(
            patchedCustomProgramCacheKey,
            originalCustomProgramCacheKey,
        );
        assert.match(
            material.customProgramCacheKey(),
            /^existing-cache-key\|gredice-cloud-shadow-ellipses-v1$/,
        );
        const shader = {
            fragmentShader:
                '#include <common>\nvoid main() {\n#include <aomap_fragment>\n}',
            uniforms: {},
            vertexShader:
                '#include <common>\nvoid main() {\n#include <worldpos_vertex>\n}',
        };
        Reflect.apply(material.onBeforeCompile, material, [shader, undefined]);
        assert.equal(originalHookCallCount, 1);
        assert.match(shader.fragmentShader, /existing material hook/);
        assert.match(shader.fragmentShader, /grediceCloudShadowAttenuation/);

        leaseA.release();
        assert.equal(material.onBeforeCompile, patchedOnBeforeCompile);
        leaseB.release();
        assert.equal(material.onBeforeCompile, originalOnBeforeCompile);
        assert.equal(
            material.customProgramCacheKey,
            originalCustomProgramCacheKey,
        );
    });

    it('patches lit materials and excludes unlit materials', () => {
        const generatedPlantMaterial = new CustomShaderMaterial({
            baseMaterial: MeshStandardMaterial,
        });

        assert.equal(
            supportsCloudShadowAttenuation(new MeshStandardMaterial()),
            true,
        );
        assert.equal(
            supportsCloudShadowAttenuation(generatedPlantMaterial),
            true,
        );
        assert.equal(
            supportsCloudShadowAttenuation(new MeshBasicMaterial()),
            false,
        );
        assert.equal(
            supportsCloudShadowAttenuation(new ShaderMaterial()),
            false,
        );
        generatedPlantMaterial.dispose();
    });

    it('releases scene material hooks when attenuation is disabled', () => {
        const root = new Object3D();
        const material = new MeshStandardMaterial();
        const object = new Object3D();
        Reflect.set(object, 'material', material);
        root.add(object);
        const leases: CloudShadowMaterialLeaseMap = new Map();
        const originalOnBeforeCompile = material.onBeforeCompile;

        assert.equal(
            syncCloudShadowAttenuationMaterials({
                enabled: true,
                leases,
                root,
                uniforms,
            }),
            1,
        );
        assert.notEqual(material.onBeforeCompile, originalOnBeforeCompile);
        assert.equal(
            syncCloudShadowAttenuationMaterials({
                enabled: false,
                leases,
                root,
                uniforms,
            }),
            0,
        );
        assert.equal(material.onBeforeCompile, originalOnBeforeCompile);

        releaseCloudShadowAttenuationMaterials(leases);
    });

    it('patches explicitly registered dynamic materials without a scene scan gap', () => {
        const root = new Object3D();
        const material = new MeshStandardMaterial();
        const leases: CloudShadowMaterialLeaseMap = new Map();
        const originalOnBeforeCompile = material.onBeforeCompile;
        const revisionBefore =
            getCloudShadowAttenuationMaterialCandidateRevision();
        const unregister =
            registerCloudShadowAttenuationMaterialCandidate(material);

        assert.equal(
            getCloudShadowAttenuationMaterialCandidateRevision(),
            revisionBefore + 1,
        );
        assert.equal(
            syncCloudShadowAttenuationMaterials({
                enabled: true,
                leases,
                root,
                uniforms,
            }),
            1,
        );
        assert.notEqual(material.onBeforeCompile, originalOnBeforeCompile);

        unregister();
        unregister();
        assert.equal(
            getCloudShadowAttenuationMaterialCandidateRevision(),
            revisionBefore + 2,
        );
        assert.equal(
            syncCloudShadowAttenuationMaterials({
                enabled: true,
                leases,
                root,
                uniforms,
            }),
            0,
        );
        assert.equal(material.onBeforeCompile, originalOnBeforeCompile);
    });
});

describe('cached cloud program uniform bindings', () => {
    function rendererWith(value: unknown) {
        return {
            properties: {
                has: () => true,
                get: () => value,
                remove: () => {},
                update: () => undefined,
                dispose: () => {},
            },
        };
    }
    it('refreshes only its owned aliases without changing cached programs, lists, hooks, keys or unrelated uniforms', () => {
        const material = new MeshStandardMaterial();
        const originalHook = material.onBeforeCompile,
            originalKey = material.customProgramCacheKey;
        const pbr = { value: 0.7 };
        const table = { roughness: pbr };
        const programs = new Map([['cached-cloud', { usedTimes: 1 }]]),
            list = [{}];
        const properties = { uniforms: table, programs, uniformsList: list };
        const lease = retainCloudShadowAttenuationMaterial(
            material,
            uniforms,
            rendererWith(properties),
        );
        for (const [key, uniform] of Object.entries(uniforms)) {
            assert.equal(
                Reflect.get(table, getCloudShadowUniformBindingName(key)),
                uniform,
            );
        }
        assert.equal(
            Reflect.get(table, 'grediceCloudShadowEllipses'),
            uniforms.ellipses,
        );
        assert.equal(table.roughness, pbr);
        assert.deepEqual(
            Object.keys(table).sort(),
            ['roughness', ...ownedBindings].sort(),
        );
        assert.equal(properties.programs, programs);
        assert.equal(properties.uniformsList, list);
        assert.deepEqual([...programs.values()], [{ usedTimes: 1 }]);
        lease.release();
        assert.equal(material.onBeforeCompile, originalHook);
        assert.equal(material.customProgramCacheKey, originalKey);
    });
    it('ignores missing or malformed renderer and uniform tables without inventing cache state', () => {
        for (const value of [
            undefined,
            null,
            3,
            [],
            { uniforms: undefined },
            { uniforms: null },
            { uniforms: 3 },
            { uniforms: [] },
        ]) {
            const material = new MeshStandardMaterial();
            const lease = retainCloudShadowAttenuationMaterial(
                material,
                uniforms,
                rendererWith(value),
            );
            lease.release();
            if (Array.isArray(value)) assert.equal(value.length, 0);
        }
    });
    it('keeps current provided uniform owners isolated between root-scoped stock candidates', () => {
        const rootA = new Object3D(),
            rootB = new Object3D();
        const a = new MeshStandardMaterial(),
            b = new MeshStandardMaterial();
        const aTable = {},
            bTable = {};
        const props = new Map([
            [a, { uniforms: aTable }],
            [b, { uniforms: bTable }],
        ]);
        const renderer = {
            properties: {
                has: (object: unknown) =>
                    props.has(
                        object instanceof MeshStandardMaterial ? object : a,
                    ),
                get: (object: unknown) =>
                    object instanceof MeshStandardMaterial
                        ? props.get(object)
                        : undefined,
                remove: () => {},
                update: () => undefined,
                dispose: () => {},
            },
        };
        const aUniforms = { ...uniforms, strength: { value: 0.2 } },
            bUniforms = { ...uniforms, strength: { value: 0.8 } };
        const leasesA: CloudShadowMaterialLeaseMap = new Map(),
            leasesB: CloudShadowMaterialLeaseMap = new Map();
        const removeA = registerCloudShadowAttenuationMaterialCandidate(
                a,
                rootA,
            ),
            removeB = registerCloudShadowAttenuationMaterialCandidate(b, rootB);
        syncCloudShadowAttenuationMaterials({
            enabled: true,
            leases: leasesA,
            root: rootA,
            uniforms: aUniforms,
            renderer,
        });
        syncCloudShadowAttenuationMaterials({
            enabled: true,
            leases: leasesB,
            root: rootB,
            uniforms: bUniforms,
            renderer,
        });
        assert.equal(
            Reflect.get(aTable, 'grediceCloudShadowStrength'),
            aUniforms.strength,
        );
        assert.equal(
            Reflect.get(bTable, 'grediceCloudShadowStrength'),
            bUniforms.strength,
        );
        assert.equal(leasesA.has(b.uuid), false);
        assert.equal(leasesB.has(a.uuid), false);
        releaseCloudShadowAttenuationMaterials(leasesA);
        assert.equal(
            Reflect.get(bTable, 'grediceCloudShadowStrength'),
            bUniforms.strength,
        );
        releaseCloudShadowAttenuationMaterials(leasesB);
        removeA();
        removeB();
    });
});
