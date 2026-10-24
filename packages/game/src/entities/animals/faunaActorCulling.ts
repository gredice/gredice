import { InstancedMesh, Mesh, type Object3D, Sphere } from 'three';

/**
 * Animated rigs bend away from their bind-pose bounds. The scale keeps a
 * walking, hopping, or flapping actor inside its culling sphere, so the
 * renderer only skips actors that are clearly outside the camera frustum.
 */
export const faunaCullingBoundsScale = 1.75;

export type FaunaActorCulling = {
    /**
     * Returns whether any actor mesh was submitted by a render since the
     * previous call. Actors start as rendered so their first pose is applied
     * before anything is drawn.
     */
    consumeRendered: () => boolean;
    meshCount: number;
};

const cullingByRoot = new WeakMap<Object3D, FaunaActorCulling>();

function conservativeMeshBounds(mesh: Mesh, boundsScale: number) {
    const geometry = mesh.geometry;
    if (!geometry.boundingSphere) {
        geometry.computeBoundingSphere();
    }

    const bounds = geometry.boundingSphere?.clone() ?? new Sphere();
    bounds.radius *= boundsScale;
    return bounds;
}

/**
 * Re-enables renderer frustum culling for an actor's meshes with conservative
 * per-mesh bounds, and reports when the actor was actually rendered. The
 * renderer then skips draw calls and skeleton updates for offscreen actors
 * for every camera and render pass, and species can skip pose work while
 * their simulation keeps advancing.
 */
export function configureFaunaActorCulling(
    root: Object3D,
    { boundsScale = faunaCullingBoundsScale }: { boundsScale?: number } = {},
): FaunaActorCulling {
    const existing = cullingByRoot.get(root);
    if (existing) {
        return existing;
    }

    let renderedSinceCheck = true;
    let meshCount = 0;
    root.traverse((object) => {
        // Instanced meshes own per-instance bounds; leave them to three.
        if (!(object instanceof Mesh) || object instanceof InstancedMesh) {
            return;
        }

        meshCount += 1;
        object.frustumCulled = true;
        // Frustum.intersectsObject prefers an object-level boundingSphere,
        // which keeps shared geometry bounds untouched for raycasting.
        Object.assign(object, {
            boundingSphere: conservativeMeshBounds(object, boundsScale),
        });
        const previousOnBeforeRender = object.onBeforeRender;
        object.onBeforeRender = function onFaunaActorRendered(...args) {
            renderedSinceCheck = true;
            previousOnBeforeRender.apply(this, args);
        };
    });

    const culling: FaunaActorCulling = {
        consumeRendered: () => {
            const rendered = renderedSinceCheck;
            renderedSinceCheck = false;
            return rendered;
        },
        meshCount,
    };
    cullingByRoot.set(root, culling);
    return culling;
}
