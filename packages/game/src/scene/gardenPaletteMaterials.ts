import { useLayoutEffect, useMemo, useState } from 'react';
import {
    type BufferGeometry,
    Float32BufferAttribute,
    Material,
    MeshStandardMaterial,
    ShaderChunk,
} from 'three';
import { hasStaticGroundPatchMaterialShaderHooks } from '../entities/helpers/groundPatchMaterial';
import { getMaterialShaderHooksWithoutCloudShadowAttenuation } from './cloudShadowAttenuation';
import {
    acquireOwnedSharedGardenMaterial,
    getGardenMaterialShaderHookSignature,
    getGardenMaterialSignature,
    registerGardenMaterialShaderHooks,
} from './gardenMaterials';

const paletteProperties = [
    'color',
    'roughness',
    'metalness',
    'emissive',
    'emissiveIntensity',
];
const paletteShaderVersion = 'garden-palette-v1';
const cacheStablePaletteHooks = new WeakMap<
    Material['onBeforeCompile'],
    Material['customProgramCacheKey']
>();

/** Only supported PBR properties move to attributes; every other input stays in the key. */
export function getGardenPaletteMaterialSignature(material: Material) {
    if (
        !(material instanceof MeshStandardMaterial) ||
        material.type !== 'MeshStandardMaterial'
    )
        return undefined;
    const signature = getGardenMaterialSignature(material, paletteProperties);
    return signature ? `${paletteShaderVersion}:${signature}` : undefined;
}

export function hasStaticGardenPaletteMaterialShaderHooks(
    hooks: Pick<Material, 'customProgramCacheKey' | 'onBeforeCompile'>,
) {
    return (
        cacheStablePaletteHooks.get(hooks.onBeforeCompile) ===
        hooks.customProgramCacheKey
    );
}

/** Constant attributes preserve the source's linear PBR values after heterogeneous merging. */
export function createGardenPaletteGeometry(
    geometry: BufferGeometry,
    material: MeshStandardMaterial,
) {
    const vertices = geometry.getAttribute('position')?.count ?? 0;
    const first = new Float32Array(vertices * 4);
    const second = new Float32Array(vertices * 4);
    const emissiveR = material.emissive.r * material.emissiveIntensity;
    const emissiveG = material.emissive.g * material.emissiveIntensity;
    const emissiveB = material.emissive.b * material.emissiveIntensity;
    for (let index = 0; index < vertices; index++) {
        const offset = index * 4;
        first[offset] = material.color.r;
        first[offset + 1] = material.color.g;
        first[offset + 2] = material.color.b;
        first[offset + 3] = material.roughness;
        second[offset] = emissiveR;
        second[offset + 1] = emissiveG;
        second[offset + 2] = emissiveB;
        second[offset + 3] = material.metalness;
    }
    // Copies keep disposal independent from the GLTF and from animated/outline meshes.
    const prepared = geometry.clone();
    prepared.setAttribute(
        'aGardenPalette0',
        new Float32BufferAttribute(first, 4),
    );
    prepared.setAttribute(
        'aGardenPalette1',
        new Float32BufferAttribute(second, 4),
    );
    return prepared;
}

const paletteVaryings = `
varying vec4 vGardenPalette0;
varying vec4 vGardenPalette1;
`;

/** Keeps maps, cutout, shadow state, and registered decorators on Three's standard shader. */
export function createGardenPaletteMaterial(source: MeshStandardMaterial) {
    const signature = getGardenPaletteMaterialSignature(source);
    const hookSignature = getGardenMaterialShaderHookSignature(source);
    if (!signature || !hookSignature)
        throw new Error('Unsupported garden palette material.');
    const material = source.clone();
    const sourceHooks =
        getMaterialShaderHooksWithoutCloudShadowAttenuation(source);
    material.color.setRGB(1, 1, 1);
    material.roughness = 1;
    material.metalness = 1;
    material.emissive.setRGB(1, 1, 1);
    material.emissiveIntensity = 1;
    material.name = `${source.name || source.type}:GardenPalette`;
    material.onBeforeCompile = (shader, renderer) => {
        sourceHooks.onBeforeCompile.call(material, shader, renderer);
        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                `#include <common>\nattribute vec4 aGardenPalette0;\nattribute vec4 aGardenPalette1;\n${paletteVaryings}`,
            )
            .replace(
                '#include <begin_vertex>',
                '#include <begin_vertex>\nvGardenPalette0 = aGardenPalette0;\nvGardenPalette1 = aGardenPalette1;',
            );
        shader.fragmentShader = shader.fragmentShader
            .replace(
                '#include <common>',
                `#include <common>\n${paletteVaryings}`,
            )
            .replace(
                'vec3 totalEmissiveRadiance = emissive;',
                'vec3 totalEmissiveRadiance = vGardenPalette1.rgb;',
            )
            // Insert before ground-patch/weather decorators appended to the chunk.
            .replace(
                '#include <color_fragment>',
                '#include <color_fragment>\ndiffuseColor.rgb *= vGardenPalette0.rgb;',
            )
            .replace(
                '#include <roughnessmap_fragment>',
                ShaderChunk.roughnessmap_fragment.replace(
                    'float roughnessFactor = roughness;',
                    'float roughnessFactor = vGardenPalette0.a;',
                ),
            )
            .replace(
                '#include <metalnessmap_fragment>',
                ShaderChunk.metalnessmap_fragment.replace(
                    'float metalnessFactor = metalness;',
                    'float metalnessFactor = vGardenPalette1.a;',
                ),
            );
    };
    const sourceProgramKey =
        sourceHooks.customProgramCacheKey ===
        Material.prototype.customProgramCacheKey
            ? 'default'
            : sourceHooks.customProgramCacheKey.call(source);
    material.customProgramCacheKey = () =>
        `${sourceProgramKey}|${paletteShaderVersion}`;
    registerGardenMaterialShaderHooks(
        material,
        `${hookSignature}>${paletteShaderVersion}`,
        material.userData,
    );
    // These hooks only change immutable color/PBR values. Moving weather hooks
    // remain live so snow displacement and wetness never replay stale pixels.
    if (
        hookSignature === 'default' ||
        hasStaticGroundPatchMaterialShaderHooks(sourceHooks)
    ) {
        cacheStablePaletteHooks.set(
            material.onBeforeCompile,
            material.customProgramCacheKey,
        );
    }
    return material;
}

/** Generated materials are registry-owned; prepared geometry is owned by this consumer. */
export function useGardenPalettePacketSource(
    geometry: BufferGeometry,
    source: Material | Material[] | undefined,
    enabled: boolean,
) {
    const signature =
        enabled && source && !Array.isArray(source)
            ? getGardenPaletteMaterialSignature(source)
            : undefined;
    const eligible =
        signature && source instanceof MeshStandardMaterial
            ? source
            : undefined;
    const paletteKey = eligible
        ? [
              eligible.color.r,
              eligible.color.g,
              eligible.color.b,
              eligible.roughness,
              eligible.emissive.r,
              eligible.emissive.g,
              eligible.emissive.b,
              eligible.emissiveIntensity,
              eligible.metalness,
          ].join(',')
        : undefined;
    // The palette key observes authored value changes without rebuilding for a new equal material.
    // biome-ignore lint/correctness/useExhaustiveDependencies: paletteKey observes authored mutable material values in addition to source identity.
    const prepared = useMemo(
        () =>
            eligible
                ? createGardenPaletteGeometry(geometry, eligible)
                : undefined,
        [geometry, eligible, paletteKey],
    );
    const [leased, setLeased] = useState<{
        signature: string;
        material: Material;
    }>();
    useLayoutEffect(() => {
        if (!eligible || !signature) return;
        const lease = acquireOwnedSharedGardenMaterial(signature, () =>
            createGardenPaletteMaterial(eligible),
        );
        setLeased({ signature, material: lease.material });
        return lease.release;
    }, [eligible, signature]);
    useLayoutEffect(() => () => prepared?.dispose(), [prepared]);
    if (!signature || !prepared || leased?.signature !== signature)
        return { geometry, material: source, palette: false };
    return { geometry: prepared, material: leased.material, palette: true };
}
