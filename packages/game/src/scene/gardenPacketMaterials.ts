import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useState } from 'react';
import {
    type BufferGeometry,
    type Material,
    MeshStandardMaterial,
    type Object3D,
} from 'three';
import {
    getMaterialShaderHooksWithoutCloudShadowAttenuation,
    registerCloudShadowAttenuationMaterialCandidate,
} from './cloudShadowAttenuation';
import { getGardenMaterialSignature } from './gardenMaterials';
import { acquireGardenPacketMaterialLifetime } from './gardenPacketMaterialLifetime';

/** Every stock shader uniform, map and registered hook participates in compatibility. */
export function getGardenPacketMaterialSignature(material: Material) {
    if (
        !(material instanceof MeshStandardMaterial) ||
        material.type !== 'MeshStandardMaterial' ||
        material.transparent
    )
        return undefined;
    const signature = getGardenMaterialSignature(material);
    return signature ? `garden-stock-v1:${signature}` : undefined;
}

/** Clone values and exact original callbacks; introduce no GLSL or shader feature flags. */
export function createGardenPacketMaterial(source: MeshStandardMaterial) {
    if (!getGardenPacketMaterialSignature(source))
        throw new Error('Unsupported garden packet material.');
    const material = source.clone();
    const hooks = getMaterialShaderHooksWithoutCloudShadowAttenuation(source);
    material.onBeforeCompile = hooks.onBeforeCompile;
    material.customProgramCacheKey = hooks.customProgramCacheKey;
    material.name = `${source.name || source.type}:GardenStock`;
    return material;
}

/** Root identity scopes ownership only; it never changes the native program cache key. */
export function acquireGardenPacketMaterial(
    source: MeshStandardMaterial,
    root: Object3D,
) {
    const signature = getGardenPacketMaterialSignature(source);
    if (!signature) return undefined;
    const lease = acquireGardenPacketMaterialLifetime(
        root,
        source,
        signature,
        () => createGardenPacketMaterial(source),
    );
    const unregisterCloud = registerCloudShadowAttenuationMaterialCandidate(
        lease.material,
        root,
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

/** Owned material leases are commit-scoped; source geometry remains borrowed and immutable. */
export function useGardenPacketSource(
    geometry: BufferGeometry,
    source: Material | Material[] | undefined,
    enabled: boolean,
) {
    const root = useThree((state) => state.scene);
    const signature =
        enabled && source && !Array.isArray(source)
            ? getGardenPacketMaterialSignature(source)
            : undefined;
    const eligible =
        signature && source instanceof MeshStandardMaterial
            ? source
            : undefined;
    const [leased, setLeased] = useState<{
        root: Object3D;
        signature: string;
        material: Material;
    }>();
    useLayoutEffect(() => {
        if (!eligible || !signature) return;
        const lease = acquireGardenPacketMaterial(eligible, root);
        if (!lease) return;
        setLeased({ root, signature, material: lease.material });
        return lease.release;
    }, [eligible, root, signature]);
    if (!signature) return { geometry, material: source, stock: false };
    // The original component keeps presenting until this synchronous layout lease commits.
    if (leased?.root !== root || leased.signature !== signature)
        return { geometry, material: undefined, stock: true };
    return { geometry, material: leased.material, stock: true };
}
