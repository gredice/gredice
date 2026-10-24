import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import type { Material, Object3D } from 'three';
import { acquireOwnedSharedGardenMaterial } from './gardenMaterials';
import {
    getGardenMaterialOrigin,
    isResidentGardenMaterial,
    subscribeToGardenMaterialEviction,
} from './resources/gardenMaterialOrigins';

type MaterialLease = ReturnType<typeof acquireOwnedSharedGardenMaterial>;
type OriginSlot = {
    selected: string;
    users: Map<string, number>;
    idle?: MaterialLease;
    unsubscribe?: () => void;
    invalid: boolean;
};
const roots = new WeakMap<Object3D, GardenPacketMaterialLifetime>();
let nextGeneration = 0;

class GardenPacketMaterialLifetime {
    readonly generation = ++nextGeneration;
    private owners = 0;
    private closed = false;
    private readonly slots = new Map<Material, OriginSlot>();

    constructor(private readonly root: Object3D) {}

    acquireOwner() {
        this.owners++;
        let released = false;
        return () => {
            if (released) return;
            released = true;
            if (--this.owners === 0) this.close();
        };
    }

    acquire(source: Material, signature: string, create: () => Material) {
        const key = `${this.root.uuid}:stock-root-${this.generation}:${signature}`;
        const lease = acquireOwnedSharedGardenMaterial(key, create);
        const origin = getGardenMaterialOrigin(source);
        let slot = this.slots.get(origin);
        if (!slot) {
            slot = { selected: signature, users: new Map(), invalid: false };
            this.slots.set(origin, slot);
        }
        // Acquisition selects the newest configuration; old cleanup cannot undo it.
        slot.selected = signature;
        slot.users.set(signature, (slot.users.get(signature) ?? 0) + 1);
        slot.idle?.release();
        slot.idle = undefined;
        const held = slot;
        let released = false;
        return {
            material: lease.material,
            release: () => {
                if (released) return;
                released = true;
                const remaining = (held.users.get(signature) ?? 1) - 1;
                if (remaining) held.users.set(signature, remaining);
                else held.users.delete(signature);
                if (
                    !remaining &&
                    !this.closed &&
                    this.owners > 0 &&
                    !held.invalid &&
                    held.selected === signature &&
                    isResidentGardenMaterial(origin)
                ) {
                    held.unsubscribe ??= subscribeToGardenMaterialEviction(
                        origin,
                        () => {
                            held.invalid = true;
                            held.idle?.release();
                            held.idle = undefined;
                            held.unsubscribe?.();
                            held.unsubscribe = undefined;
                            this.slots.delete(origin);
                        },
                    );
                    // Pin before releasing the final consumer: Three's native program
                    // reference must never pass through zero during a garden replacement.
                    held.idle = acquireOwnedSharedGardenMaterial(key, create);
                }
                lease.release();
                if (!held.users.size && !held.idle) {
                    held.unsubscribe?.();
                    if (this.slots.get(origin) === held)
                        this.slots.delete(origin);
                    if (!this.owners && !this.slots.size) this.close();
                }
            },
        };
    }

    read() {
        return {
            idleOrigins: [...this.slots.values()].filter((slot) => slot.idle)
                .length,
            activeSignatures: [...this.slots.values()].reduce(
                (sum, slot) => sum + slot.users.size,
                0,
            ),
        };
    }

    private close() {
        if (this.closed) return;
        this.closed = true;
        if (roots.get(this.root) === this) roots.delete(this.root);
        for (const slot of this.slots.values()) {
            slot.idle?.release();
            slot.idle = undefined;
            slot.unsubscribe?.();
            slot.unsubscribe = undefined;
        }
        this.slots.clear();
    }
}

function getLifetime(root: Object3D) {
    let lifetime = roots.get(root);
    if (!lifetime) {
        lifetime = new GardenPacketMaterialLifetime(root);
        roots.set(root, lifetime);
    }
    return lifetime;
}

/** Direct callers without a live Scene owner retain commit-scoped disposal. */
export function acquireGardenPacketMaterialLifetime(
    root: Object3D,
    source: Material,
    signature: string,
    create: () => Material,
) {
    return getLifetime(root).acquire(source, signature, create);
}

export function acquireGardenPacketMaterialRoot(root: Object3D) {
    return getLifetime(root).acquireOwner();
}

export function readGardenPacketMaterialLifetime(root: Object3D) {
    return roots.get(root)?.read() ?? { idleOrigins: 0, activeSignatures: 0 };
}

/** Persistent Canvas ownership survives keyed garden content replacement. */
export function GardenPacketMaterialRoot() {
    const root = useThree((state) => state.scene);
    useLayoutEffect(() => acquireGardenPacketMaterialRoot(root), [root]);
    return null;
}
