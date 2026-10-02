import { useLayoutEffect, useState } from 'react';
import type { BufferGeometry, Material } from 'three';
import {
    acquireGardenPaletteFallbackMaterial,
    getGardenPaletteFallbackMaterialKey,
} from './gardenPaletteFallbackMaterials';

const geometries = new Map<
    BufferGeometry,
    { geometry: BufferGeometry; users: number }
>();

/** Eligible palette inputs are immutable geometry or replaced source objects. */
function acquireFallbackGeometry(source: BufferGeometry) {
    let entry = geometries.get(source);
    if (!entry) {
        entry = { geometry: source.clone(), users: 0 };
        geometries.set(source, entry);
    }
    const lease = entry;
    lease.users++;
    let released = false;
    return {
        geometry: lease.geometry,
        release: () => {
            if (released) return;
            released = true;
            lease.users--;
            if (lease.users === 0 && geometries.get(source) === lease) {
                geometries.delete(source);
                lease.geometry.dispose();
            }
        },
    };
}

/** Releases fallback GPU buffers and programs without disposing borrowed inputs. */
export function acquireGardenPaletteFallbackResources(
    geometry: BufferGeometry,
    material: Material,
) {
    const shader = acquireGardenPaletteFallbackMaterial(material);
    if (!shader) return undefined;
    try {
        const buffers = acquireFallbackGeometry(geometry);
        return {
            geometry: buffers.geometry,
            material: shader.material,
            release: () => {
                shader.release();
                buffers.release();
            },
        };
    } catch (error) {
        shader.release();
        throw error;
    }
}

/** No borrowed input reaches a pending frame before its paired lease commits. */
export function useGardenPaletteFallbackResources(
    geometry: BufferGeometry,
    material: Material,
    enabled: boolean,
) {
    const materialKey = enabled
        ? getGardenPaletteFallbackMaterialKey(material)
        : undefined;
    const key = materialKey ? `${geometry.uuid}:${materialKey}` : undefined;
    const [leased, setLeased] = useState<{
        key: string;
        geometry: BufferGeometry;
        material: Material;
    }>();
    useLayoutEffect(() => {
        if (!key) return;
        const lease = acquireGardenPaletteFallbackResources(geometry, material);
        if (!lease) return;
        setLeased({ key, geometry: lease.geometry, material: lease.material });
        return lease.release;
    }, [geometry, key, material]);
    if (!key) return { geometry, material };
    return leased?.key === key ? leased : undefined;
}
