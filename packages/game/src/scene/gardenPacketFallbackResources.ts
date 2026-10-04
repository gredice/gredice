import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useState } from 'react';
import type { BufferGeometry, Material, Object3D } from 'three';
import {
    acquireGardenPacketFallbackMaterial,
    getGardenPacketFallbackMaterialKey,
} from './gardenPacketFallbackMaterials';

const geometries = new Map<
    BufferGeometry,
    { geometry: BufferGeometry; users: number }
>();

/** Eligible stock inputs are immutable geometry or replaced source objects. */
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
export function acquireGardenPacketFallbackResources(
    geometry: BufferGeometry,
    material: Material,
    root: Object3D,
) {
    const shader = acquireGardenPacketFallbackMaterial(material, root);
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
export function useGardenPacketFallbackResources(
    geometry: BufferGeometry,
    material: Material,
    enabled: boolean,
) {
    const root = useThree((state) => state.scene);
    const materialKey = enabled
        ? getGardenPacketFallbackMaterialKey(material, root)
        : undefined;
    const key = materialKey ? `${geometry.uuid}:${materialKey}` : undefined;
    const [leased, setLeased] = useState<{
        key: string;
        geometry: BufferGeometry;
        material: Material;
    }>();
    useLayoutEffect(() => {
        if (!key) return;
        const lease = acquireGardenPacketFallbackResources(
            geometry,
            material,
            root,
        );
        if (!lease) return;
        setLeased({ key, geometry: lease.geometry, material: lease.material });
        return lease.release;
    }, [geometry, key, material, root]);
    if (!key) return { geometry, material };
    return leased?.key === key ? leased : undefined;
}
