import type { Material } from 'three';
import {
    getMaterialShaderHooksWithoutCloudShadowAttenuation,
    registerCloudShadowAttenuationMaterialCandidate,
} from './cloudShadowAttenuation';
import {
    acquireOwnedSharedGardenMaterial,
    getGardenMaterialSignature,
} from './gardenMaterials';
import { getGardenPaletteMaterialSignature } from './gardenPaletteMaterials';

export function getGardenPaletteFallbackMaterialKey(source: Material) {
    if (source.transparent || !getGardenPaletteMaterialSignature(source))
        return undefined;
    const signature = getGardenMaterialSignature(source);
    return signature
        ? `static-packet-fallback:${source.uuid}:${signature}`
        : undefined;
}

/**
 * Pending instancing programs belong to a transient clone, so their final
 * consumer releases them without touching the authored material or its maps.
 * Registered ground/weather callbacks keep the same live uniform owners;
 * cloud attenuation belongs to the scene and is applied once to the clone.
 */
export function acquireGardenPaletteFallbackMaterial(source: Material) {
    const key = getGardenPaletteFallbackMaterialKey(source);
    if (!key) return undefined;
    const lease = acquireOwnedSharedGardenMaterial(key, () => {
        const material = source.clone();
        const hooks =
            getMaterialShaderHooksWithoutCloudShadowAttenuation(source);
        material.onBeforeCompile = hooks.onBeforeCompile;
        material.customProgramCacheKey = hooks.customProgramCacheKey;
        material.name = `${source.name || source.type}:StaticPacketFallback`;
        return material;
    });
    const unregisterCloud = registerCloudShadowAttenuationMaterialCandidate(
        lease.material,
    );
    let released = false;
    return {
        material: lease.material,
        release: () => {
            if (released) return;
            released = true;
            unregisterCloud();
            lease.release();
        },
    };
}
