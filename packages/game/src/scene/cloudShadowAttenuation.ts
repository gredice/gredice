import {
    type IUniform,
    type Material,
    type Object3D,
    type Texture,
    Vector2,
    Vector4,
} from 'three';
import type { GameQualityProfile } from './gameQuality';

const CLOUD_SHADOW_SHADER_CACHE_KEY = 'gredice-cloud-shadow-attenuation-v1';
const CLOUD_SHADOW_MAX_PROJECTION_SLOPE = 1.5;

const cloudShadowVertexPars = /* glsl */ `
varying vec3 vGrediceCloudShadowWorldPosition;
`;

const cloudShadowVertex = /* glsl */ `
#include <worldpos_vertex>

#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined( USE_SHADOWMAP ) || defined( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
    vGrediceCloudShadowWorldPosition = worldPosition.xyz;
#else
    vec4 grediceCloudShadowWorldPosition = vec4( transformed, 1.0 );

    #ifdef USE_BATCHING
        grediceCloudShadowWorldPosition = batchingMatrix * grediceCloudShadowWorldPosition;
    #endif

    #ifdef USE_INSTANCING
        grediceCloudShadowWorldPosition = instanceMatrix * grediceCloudShadowWorldPosition;
    #endif

    vGrediceCloudShadowWorldPosition = ( modelMatrix * grediceCloudShadowWorldPosition ).xyz;
#endif
`;

const cloudShadowFragmentPars = /* glsl */ `
uniform sampler2D grediceCloudShadowMap;
uniform vec4 grediceCloudShadowBounds;
uniform vec2 grediceCloudShadowProjection;
uniform float grediceCloudShadowStrength;
uniform float grediceCloudShadowHardness;
varying vec3 vGrediceCloudShadowWorldPosition;
`;

export const cloudShadowFragmentShaderChunk = /* glsl */ `
#include <aomap_fragment>

float grediceCloudShadowAttenuation = 1.0;
if ( grediceCloudShadowStrength > 0.001 ) {
    vec2 grediceCloudShadowGroundPosition =
        vGrediceCloudShadowWorldPosition.xz -
        grediceCloudShadowProjection * vGrediceCloudShadowWorldPosition.y;
    vec2 grediceCloudShadowUv =
        ( grediceCloudShadowGroundPosition - grediceCloudShadowBounds.xy ) *
        grediceCloudShadowBounds.zw;
    float grediceCloudShadowInBounds =
        step( 0.0, grediceCloudShadowUv.x ) *
        step( 0.0, grediceCloudShadowUv.y ) *
        step( grediceCloudShadowUv.x, 1.0 ) *
        step( grediceCloudShadowUv.y, 1.0 );
    float grediceCloudShadowMask =
        texture2D( grediceCloudShadowMap, grediceCloudShadowUv ).r *
        grediceCloudShadowInBounds;
    float grediceCloudShadowHardMask =
        smoothstep( 0.08, 0.52, grediceCloudShadowMask );
    grediceCloudShadowAttenuation =
        1.0 -
        mix(
            grediceCloudShadowMask,
            grediceCloudShadowHardMask,
            grediceCloudShadowHardness
        ) *
        grediceCloudShadowStrength;
}

reflectedLight.directDiffuse *= grediceCloudShadowAttenuation;
reflectedLight.directSpecular *= grediceCloudShadowAttenuation;
`;

export type CloudShadowBounds = {
    maxX: number;
    maxZ: number;
    minX: number;
    minZ: number;
};

export type CloudShadowProjection = {
    x: number;
    z: number;
};

export type CloudShadowSample = {
    altitude: number;
    height: number;
    opacity: number;
    rotation: number;
    width: number;
    x: number;
    z: number;
};

export type CloudShadowAttenuationConfig = {
    enabled: boolean;
    maskResolution: number;
    updateMs: number;
};

export type CloudShadowMaskPlacement = {
    alpha: number;
    height: number;
    rotation: number;
    width: number;
    x: number;
    y: number;
};

export type CloudShadowMaterialUniforms = {
    bounds: IUniform<Vector4>;
    hardness: IUniform<number>;
    map: IUniform<Texture | null>;
    projection: IUniform<Vector2>;
    strength: IUniform<number>;
};

type CloudShadowMaterialPatchState = {
    consumerCount: number;
    originalCustomProgramCacheKey: Material['customProgramCacheKey'];
    originalOnBeforeCompile: Material['onBeforeCompile'];
    patchedCustomProgramCacheKey: Material['customProgramCacheKey'];
    patchedOnBeforeCompile: Material['onBeforeCompile'];
};

export type CloudShadowMaterialLease = {
    material: Material;
    release: () => void;
};

export type CloudShadowMaterialLeaseMap = Map<string, CloudShadowMaterialLease>;

const materialPatchStates = new WeakMap<
    Material,
    CloudShadowMaterialPatchState
>();
// The production garden owns one active weather scene, so one stable uniform
// set lets shared materials keep a single compiled program across transitions.
// Concurrent weather scenes with different masks would contend for these
// values and would need renderer- or scene-scoped uniforms.
const sharedCloudShadowMaterialUniforms: CloudShadowMaterialUniforms = {
    bounds: { value: new Vector4(0, 0, 1, 1) },
    hardness: { value: 0 },
    map: { value: null },
    projection: { value: new Vector2() },
    strength: { value: 0 },
};

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function resolveBaseCloudShadowAttenuationConfig(quality: GameQualityProfile) {
    if (quality.tier === 'auto-constrained' || quality.shadowMapSize <= 1024) {
        return { maskResolution: 64, updateMs: 240 };
    }

    if (
        quality.tier === 'high' ||
        quality.cloudShadowMode === 'soft' ||
        quality.shadowMapSize >= 4096
    ) {
        return { maskResolution: 192, updateMs: 96 };
    }

    return { maskResolution: 128, updateMs: 160 };
}

export function resolveCloudShadowAttenuationConfig({
    minimumUpdateMs,
    prefersReducedMotion,
    quality,
}: {
    minimumUpdateMs?: number;
    prefersReducedMotion: boolean;
    quality: GameQualityProfile;
}): CloudShadowAttenuationConfig {
    if (!quality.shadows) {
        return {
            enabled: false,
            maskResolution: 0,
            updateMs: 0,
        };
    }

    const base = resolveBaseCloudShadowAttenuationConfig(quality);
    const reducedMotionUpdateMs = prefersReducedMotion
        ? Math.max(base.updateMs, 320)
        : base.updateMs;
    const updateMs =
        typeof minimumUpdateMs === 'number' && Number.isFinite(minimumUpdateMs)
            ? Math.max(reducedMotionUpdateMs, minimumUpdateMs)
            : reducedMotionUpdateMs;

    return {
        enabled: true,
        maskResolution: prefersReducedMotion
            ? Math.min(base.maskResolution, 128)
            : base.maskResolution,
        updateMs,
    };
}

export function getCloudShadowAttenuationMaterialUniforms() {
    return sharedCloudShadowMaterialUniforms;
}

export function resolveCloudShadowAttenuationActivation({
    activated,
    strength,
}: {
    activated: boolean;
    strength: number;
}) {
    return activated || (Number.isFinite(strength) && strength > 0.001);
}

export function resolveCloudShadowAttenuationUpdateTick({
    enabled,
    force,
    nextUpdateAt,
    now,
    updateMs,
}: {
    enabled: boolean;
    force: boolean;
    nextUpdateAt: number;
    now: number;
    updateMs: number;
}) {
    const shouldUpdate =
        enabled &&
        Number.isFinite(updateMs) &&
        updateMs > 0 &&
        (force || now >= nextUpdateAt);

    return {
        nextUpdateAt: shouldUpdate ? now + updateMs : nextUpdateAt,
        shouldUpdate,
    };
}

export function resolveCloudShadowProjection({
    x,
    y,
    z,
}: {
    x: number;
    y: number;
    z: number;
}): CloudShadowProjection {
    if (!Number.isFinite(y) || y <= 0.001) {
        return { x: 0, z: 0 };
    }

    return {
        x: clamp(
            x / y,
            -CLOUD_SHADOW_MAX_PROJECTION_SLOPE,
            CLOUD_SHADOW_MAX_PROJECTION_SLOPE,
        ),
        z: clamp(
            z / y,
            -CLOUD_SHADOW_MAX_PROJECTION_SLOPE,
            CLOUD_SHADOW_MAX_PROJECTION_SLOPE,
        ),
    };
}

export function projectCloudShadowReceiverToGround(
    position: { x: number; y: number; z: number },
    projection: CloudShadowProjection,
) {
    return {
        x: position.x - projection.x * position.y,
        z: position.z - projection.z * position.y,
    };
}

export function resolveCloudShadowMaskPlacement({
    bounds,
    projection,
    resolution,
    sample,
}: {
    bounds: CloudShadowBounds;
    projection: CloudShadowProjection;
    resolution: number;
    sample: CloudShadowSample;
}): CloudShadowMaskPlacement {
    const spanX = Math.max(0.001, bounds.maxX - bounds.minX);
    const spanZ = Math.max(0.001, bounds.maxZ - bounds.minZ);
    const groundPosition = projectCloudShadowReceiverToGround(
        {
            x: sample.x,
            y: sample.altitude,
            z: sample.z,
        },
        projection,
    );

    return {
        alpha: clamp(sample.opacity, 0, 1),
        height: (sample.height / spanZ) * resolution,
        // Canvas Y points down while world/texture Z-V points up.
        rotation: -sample.rotation,
        width: (sample.width / spanX) * resolution,
        x: ((groundPosition.x - bounds.minX) / spanX) * resolution,
        y: ((bounds.maxZ - groundPosition.z) / spanZ) * resolution,
    };
}

function hasMaterialFlag(material: Material, flag: string) {
    return Reflect.get(material, flag) === true;
}

export function supportsCloudShadowAttenuation(material: Material) {
    // Built-in lit materials share the reflected-light shader contract above.
    // ShaderMaterial receivers need an explicit output integration and are
    // intentionally left unchanged instead of guessing at their uniforms.
    return (
        hasMaterialFlag(material, 'isMeshStandardMaterial') ||
        hasMaterialFlag(material, 'isMeshPhysicalMaterial') ||
        hasMaterialFlag(material, 'isMeshLambertMaterial') ||
        hasMaterialFlag(material, 'isMeshPhongMaterial') ||
        hasMaterialFlag(material, 'isMeshToonMaterial')
    );
}

function isMaterial(value: unknown): value is Material {
    return (
        typeof value === 'object' &&
        value !== null &&
        Reflect.get(value, 'isMaterial') === true
    );
}

function getObjectMaterials(object: Object3D) {
    const value = Reflect.get(object, 'material');
    if (Array.isArray(value)) {
        return value.filter(isMaterial);
    }

    return isMaterial(value) ? [value] : [];
}

function injectCloudShadowAttenuationShader(
    shader: Parameters<Material['onBeforeCompile']>[0],
    uniforms: CloudShadowMaterialUniforms,
) {
    shader.uniforms.grediceCloudShadowMap = uniforms.map;
    shader.uniforms.grediceCloudShadowBounds = uniforms.bounds;
    shader.uniforms.grediceCloudShadowProjection = uniforms.projection;
    shader.uniforms.grediceCloudShadowStrength = uniforms.strength;
    shader.uniforms.grediceCloudShadowHardness = uniforms.hardness;

    shader.vertexShader = shader.vertexShader
        .replace(
            '#include <common>',
            `#include <common>\n${cloudShadowVertexPars}`,
        )
        .replace('#include <worldpos_vertex>', cloudShadowVertex);
    shader.fragmentShader = shader.fragmentShader
        .replace(
            '#include <common>',
            `#include <common>\n${cloudShadowFragmentPars}`,
        )
        .replace('#include <aomap_fragment>', cloudShadowFragmentShaderChunk);
}

export function retainCloudShadowAttenuationMaterial(
    material: Material,
    uniforms: CloudShadowMaterialUniforms,
): CloudShadowMaterialLease {
    const existingState = materialPatchStates.get(material);
    if (existingState) {
        existingState.consumerCount += 1;
        let released = false;
        return {
            material,
            release: () => {
                if (released) {
                    return;
                }
                released = true;
                releaseCloudShadowAttenuationMaterial(material);
            },
        };
    }

    const originalOnBeforeCompile = material.onBeforeCompile;
    const originalCustomProgramCacheKey = material.customProgramCacheKey;
    const patchedOnBeforeCompile: Material['onBeforeCompile'] = (
        shader,
        renderer,
    ) => {
        originalOnBeforeCompile.call(material, shader, renderer);
        injectCloudShadowAttenuationShader(shader, uniforms);
    };
    const patchedCustomProgramCacheKey: Material['customProgramCacheKey'] =
        () =>
            `${originalCustomProgramCacheKey.call(material)}|${CLOUD_SHADOW_SHADER_CACHE_KEY}`;
    const state = {
        consumerCount: 1,
        originalCustomProgramCacheKey,
        originalOnBeforeCompile,
        patchedCustomProgramCacheKey,
        patchedOnBeforeCompile,
    };
    materialPatchStates.set(material, state);
    material.onBeforeCompile = patchedOnBeforeCompile;
    material.customProgramCacheKey = patchedCustomProgramCacheKey;
    material.needsUpdate = true;

    let released = false;
    return {
        material,
        release: () => {
            if (released) {
                return;
            }
            released = true;
            releaseCloudShadowAttenuationMaterial(material);
        },
    };
}

function releaseCloudShadowAttenuationMaterial(material: Material) {
    const state = materialPatchStates.get(material);
    if (!state) {
        return;
    }

    state.consumerCount = Math.max(0, state.consumerCount - 1);
    if (state.consumerCount > 0) {
        return;
    }

    if (material.onBeforeCompile === state.patchedOnBeforeCompile) {
        material.onBeforeCompile = state.originalOnBeforeCompile;
    }
    if (material.customProgramCacheKey === state.patchedCustomProgramCacheKey) {
        material.customProgramCacheKey = state.originalCustomProgramCacheKey;
    }
    material.needsUpdate = true;
    materialPatchStates.delete(material);
}

export function syncCloudShadowAttenuationMaterials({
    enabled,
    leases,
    root,
    uniforms,
}: {
    enabled: boolean;
    leases: CloudShadowMaterialLeaseMap;
    root: Object3D;
    uniforms: CloudShadowMaterialUniforms;
}) {
    const activeMaterialIds = new Set<string>();

    if (enabled) {
        root.traverse((object) => {
            for (const material of getObjectMaterials(object)) {
                if (!supportsCloudShadowAttenuation(material)) {
                    continue;
                }

                activeMaterialIds.add(material.uuid);
                if (!leases.has(material.uuid)) {
                    leases.set(
                        material.uuid,
                        retainCloudShadowAttenuationMaterial(
                            material,
                            uniforms,
                        ),
                    );
                }
            }
        });
    }

    for (const [materialId, lease] of leases) {
        if (activeMaterialIds.has(materialId)) {
            continue;
        }

        lease.release();
        leases.delete(materialId);
    }

    return leases.size;
}

export function releaseCloudShadowAttenuationMaterials(
    leases: CloudShadowMaterialLeaseMap,
) {
    for (const lease of leases.values()) {
        lease.release();
    }
    leases.clear();
}
