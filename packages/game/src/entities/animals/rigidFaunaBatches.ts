import {
    BufferAttribute,
    type BufferGeometry,
    Mesh,
    MeshStandardMaterial,
    type Object3D,
    Sphere,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { meshGeometryLayoutSignature } from '../../scene/compiler/meshBuffers';
import { getGardenMaterialSignature } from '../../scene/gardenMaterials';
import {
    faunaCullingBoundsScale,
    hasRigidFaunaRenderCallbacks,
} from './faunaActorCulling';

type GeometryEntry = {
    geometry: BufferGeometry;
    bounds: Sphere;
    users: number;
};

// Only committed, live actor models retain outputs. Source GLTF data is borrowed.
const geometries = new WeakMap<Object3D, Map<string, GeometryEntry>>();

function rigidSource(object: Object3D) {
    if (
        !(object instanceof Mesh) ||
        object.type !== 'Mesh' ||
        !object.matrixAutoUpdate ||
        !object.visible ||
        object.castShadow ||
        object.children.length > 0 ||
        !hasRigidFaunaRenderCallbacks(object) ||
        !(object.material instanceof MeshStandardMaterial) ||
        object.material.type !== 'MeshStandardMaterial' ||
        object.material.transparent
    )
        return undefined;
    const geometry = object.geometry;
    if (
        !geometry.getAttribute('position') ||
        geometry.groups.length > 0 ||
        Object.keys(geometry.morphAttributes).length > 0 ||
        Object.values(geometry.attributes).some(
            (attribute) => !(attribute instanceof BufferAttribute),
        ) ||
        geometry.drawRange.start !== 0 ||
        (geometry.drawRange.count !== Infinity &&
            geometry.drawRange.count !==
                (geometry.index?.count ??
                    geometry.getAttribute('position').count))
    )
        return undefined;
    const signature = getGardenMaterialSignature(object.material);
    if (!signature) return undefined;
    object.updateMatrix();
    // Keep mirrored primitives on their authored winding/culling path.
    const determinant = object.matrix.determinant();
    if (!Number.isFinite(determinant) || determinant <= 0) return undefined;
    return {
        mesh: object,
        material: object.material,
        key: [
            signature,
            meshGeometryLayoutSignature(geometry),
            object.castShadow,
            object.receiveShadow,
            object.renderOrder,
            object.layers.mask,
        ].join('|'),
    };
}

type RigidSource = NonNullable<ReturnType<typeof rigidSource>>;

function acquireGeometry(
    source: Object3D,
    parent: Object3D,
    parts: RigidSource[],
) {
    let entries = geometries.get(source);
    if (!entries) {
        entries = new Map();
        geometries.set(source, entries);
    }
    const key = JSON.stringify([
        parent.name,
        parts[0]?.key,
        parts.map(({ mesh }) => [
            mesh.geometry.uuid,
            mesh.geometry.index?.version,
            Object.values(mesh.geometry.attributes).map((attribute) =>
                attribute instanceof BufferAttribute
                    ? attribute.version
                    : undefined,
            ),
            mesh.matrix.elements,
        ]),
    ]);
    let entry = entries.get(key);
    if (!entry) {
        const copies: BufferGeometry[] = [];
        const bounds = new Sphere().makeEmpty();
        try {
            for (const { mesh } of parts) {
                copies.push(mesh.geometry.clone().applyMatrix4(mesh.matrix));
                if (!mesh.geometry.boundingSphere)
                    mesh.geometry.computeBoundingSphere();
                const sphere = mesh.geometry.boundingSphere?.clone();
                if (sphere) {
                    sphere.radius *= faunaCullingBoundsScale;
                    bounds.union(sphere.applyMatrix4(mesh.matrix));
                }
            }
            const geometry = mergeGeometries(copies);
            if (!geometry) return undefined;
            geometry.name = `FaunaRigidGeometry:${parent.name}`;
            geometry.computeBoundingBox();
            geometry.computeBoundingSphere();
            entry = { geometry, bounds, users: 0 };
            entries.set(key, entry);
        } finally {
            for (const geometry of copies) geometry.dispose();
        }
    }
    const leased = entry;
    const owner = entries;
    leased.users += 1;
    let released = false;
    return {
        geometry: leased.geometry,
        bounds: leased.bounds,
        release() {
            if (released) return;
            released = true;
            leased.users -= 1;
            if (leased.users > 0) return;
            if (owner.get(key) === leased) owner.delete(key);
            leased.geometry.dispose();
            if (owner.size === 0) geometries.delete(source);
        },
    };
}

/**
 * Opt-in only for known rigid siblings of the manual Bee/Ladybug pivots.
 * These actors use the separate projected shadow batch. Primary shadow-map
 * casters retain their authored transform/rasterization path.
 * Logical nodes remain available to rig/pose readers; articulation parents,
 * unsupported primitives, transparent sorting and source asset owners stay intact.
 */
export function acquireRigidFaunaBatches(
    root: Object3D,
    source: Object3D,
    parentNames: readonly string[],
    markRendered: () => void,
) {
    const batches: Mesh[] = [];
    const cleanups: (() => void)[] = [];
    let released = false;
    const release = () => {
        if (released) return;
        released = true;
        for (const cleanup of cleanups.reverse()) cleanup();
    };
    try {
        for (const name of parentNames) {
            const parent = root.getObjectByName(name);
            if (!parent) continue;
            const groups = new Map<string, RigidSource[]>();
            for (const object of parent.children) {
                const part = rigidSource(object);
                if (!part) continue;
                const group = groups.get(part.key);
                if (group) group.push(part);
                else groups.set(part.key, [part]);
            }
            for (const parts of groups.values()) {
                const first = parts[0];
                if (!first || parts.length < 2) continue;
                const lease = acquireGeometry(source, parent, parts);
                if (!lease) continue;
                const batch = Object.assign(
                    new Mesh(lease.geometry, first.material),
                    {
                        boundingSphere: lease.bounds.clone(),
                    },
                );
                batch.name = `FaunaRigidBatch:${name}:${batches.length}`;
                batch.castShadow = first.mesh.castShadow;
                batch.receiveShadow = first.mesh.receiveShadow;
                batch.renderOrder = first.mesh.renderOrder;
                batch.layers.mask = first.mesh.layers.mask;
                batch.onBeforeRender = markRendered;
                const originals = parts.map(({ mesh }) => ({
                    mesh,
                    visible: mesh.visible,
                    raycast: mesh.raycast,
                }));
                for (const { mesh } of originals) {
                    mesh.visible = false;
                    mesh.raycast = () => undefined;
                }
                parent.add(batch);
                batches.push(batch);
                cleanups.push(() => {
                    batch.removeFromParent();
                    for (const original of originals) {
                        original.mesh.visible = original.visible;
                        original.mesh.raycast = original.raycast;
                    }
                    lease.release();
                });
            }
        }
    } catch (error) {
        release();
        throw error;
    }
    return { batches, release };
}
