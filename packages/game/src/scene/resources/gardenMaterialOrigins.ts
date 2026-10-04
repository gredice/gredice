import type { Material } from 'three';

type ResidentOrigin = {
    owners: Set<object>;
    listeners: Set<() => void>;
};
const origins = new WeakMap<Material, ResidentOrigin>();
const disposedOrigins = new WeakSet<Material>();
const inheritedOrigins = new WeakMap<Material, WeakRef<Material>>();

/** Pure decoration carries identity only; it takes no resource reference. */
export function inheritGardenMaterialOrigin(clone: Material, source: Material) {
    inheritedOrigins.set(clone, new WeakRef(getGardenMaterialOrigin(source)));
}

export function getGardenMaterialOrigin(material: Material) {
    return inheritedOrigins.get(material)?.deref() ?? material;
}

/** Only decoded, resident GLTF resources can own a warm stock clone. */
export function registerResidentGardenMaterial(material: Material) {
    if (disposedOrigins.has(material)) return () => {};
    let origin = origins.get(material);
    if (!origin) {
        origin = { owners: new Set(), listeners: new Set() };
        origins.set(material, origin);
        const held = origin;
        material.addEventListener('dispose', () => {
            disposedOrigins.add(material);
            held.owners.clear();
            for (const listener of [...held.listeners]) listener();
            held.listeners.clear();
        });
    }
    const held = origin;
    const owner = {};
    held.owners.add(owner);
    return () => {
        if (!held.owners.delete(owner) || held.owners.size > 0) return;
        for (const listener of [...held.listeners]) listener();
        held.listeners.clear();
    };
}

export function isResidentGardenMaterial(material: Material) {
    return (
        !disposedOrigins.has(material) &&
        Boolean(origins.get(material)?.owners.size)
    );
}

export function subscribeToGardenMaterialEviction(
    material: Material,
    listener: () => void,
) {
    const origin = origins.get(material);
    if (!origin || !isResidentGardenMaterial(material)) return undefined;
    origin.listeners.add(listener);
    return () => origin.listeners.delete(listener);
}
