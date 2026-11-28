import {
    type BufferGeometry,
    InstancedBufferAttribute,
    InstancedMesh,
    type Material,
    Matrix4,
    Mesh,
    type Object3D,
    SkinnedMesh,
} from 'three';
import { getMaterialShaderHooksWithoutCloudShadowAttenuation } from '../../scene/cloudShadowAttenuation';
import { getGardenMaterialShaderHookSignature } from '../../scene/gardenMaterials';

/** Opacity of an Expand ghost, as the pack layout preview's ghosts. */
export const expandGhostOpacity = 0.35;

/**
 * How a block's copies are drawn.
 *
 * - `prop`: one see-through pass at `expandGhostOpacity`, as the pack layout
 *   preview draws its ghosts. Overlapping parts show through each other.
 * - `ground`: ground, paving and water copies merge into one solid once
 *   placed, so their ghosts draw in two passes. The depth pass writes the
 *   depth of every ghost part and no colour; the colour pass then shades
 *   only the surface nearest the camera, so the walls between copies (and
 *   the cell plates inside them) do not show through. As that shades one
 *   layer instead of several, it uses the stronger
 *   `expandGroundGhostOpacity`, so pale ground such as sand still reads.
 */
export type GhostStyle = 'ground' | 'prop';

/** Opacity of a `ground` ghost's single shaded layer. */
export const expandGroundGhostOpacity = 0.5;

/**
 * Render orders of the two `ground` passes. Both run after the garden's own
 * see-through surfaces (order 0) and before water and the cell plates
 * (order 1), so a plate inside a ground copy is hidden, as it will be once
 * the copy is placed.
 */
export const expandGhostDepthRenderOrder = 0.5;
export const expandGhostRenderOrder = 0.75;

/** Which of the two ghost passes a material draws (see `GhostStyle`). */
export type GhostMaterialPass = 'color' | 'depth';

/** Ground, paving and water: the blocks whose copies merge into one solid. */
export function getExpandGhostStyle(blockName: string): GhostStyle {
    return blockName.startsWith('Block_') ? 'ground' : 'prop';
}

/** The opacity of a ghost style's shaded layer. */
export function getExpandGhostOpacity(style: GhostStyle) {
    return style === 'ground' ? expandGroundGhostOpacity : expandGhostOpacity;
}

/** How a ghost material is made: its pass and opacity. */
export type GhostMaterialOptions = {
    opacity?: number;
    pass?: GhostMaterialPass;
};

/**
 * Parts of an entity that are not the block itself, or that a static
 * see-through copy cannot reproduce: snow and wet overlays, decoration
 * billboards on block tops (`BlockSurfaceDecorationSprites`), grounding and
 * contact shadows, and debug helpers. They are skipped with everything
 * below them; a template that holds only these still yields its other
 * meshes.
 */
const skippedObjectNameFragments = [
    'Overlay',
    'SpriteAtlasBillboard',
    ':billboard',
    'Shadow',
    'Debug:',
] as const;

/**
 * Instanced meshes inside a template (the rim pieces of a terrain block)
 * are copied instance by instance. Larger batches are decoration fields, not
 * parts of one block, and are skipped.
 */
export const maxGhostTemplateInstancesPerMesh = 64;

/** One drawable part of the template: a geometry with its material(s). */
export type GhostTemplatePart = {
    geometry: BufferGeometry;
    /** The material(s) the template draws the part with. */
    material: Material | Material[];
    /**
     * Where the template draws the part, relative to the template root. A
     * part the template draws several times (two meshes with one geometry
     * and material, or the instances of an instanced mesh) has a matrix per
     * copy.
     */
    localMatrices: Matrix4[];
};

export type GhostTemplateCollection =
    | { kind: 'parts'; parts: GhostTemplatePart[] }
    | {
          /**
           * Ghost copies cannot be drawn from the template: it is skinned
           * (an animated rig needs its skeleton) or nothing drawable is left
           * after filtering. The preview shows cell plates only.
           */
          kind: 'fallback';
          reason: 'skinned-mesh' | 'no-mesh';
      };

/**
 * Whether a collection is final: the template drew its parts, or it is
 * skinned (its rig has loaded). An empty template may still be loading.
 */
export function isFinalGhostTemplateCollection(
    collection: GhostTemplateCollection | null,
) {
    return (
        collection !== null &&
        (collection.kind === 'parts' || collection.reason === 'skinned-mesh')
    );
}

export function isSkippedGhostTemplateObject(object: Object3D) {
    return skippedObjectNameFragments.some((fragment) =>
        object.name.includes(fragment),
    );
}

/**
 * A geometry with per-instance attributes of its own holds data for a fixed
 * number of instances; a ghost drawing it at more copies would read past
 * them, so such parts are left out.
 */
function hasInstancedAttributes(geometry: BufferGeometry) {
    return Object.values(geometry.attributes).some(
        (attribute) => attribute instanceof InstancedBufferAttribute,
    );
}

function isDrawableMaterial(material: Material | Material[]) {
    return Array.isArray(material)
        ? material.some((entry) => entry.visible)
        : material.visible;
}

function getMaterialKey(material: Material | Material[]) {
    return Array.isArray(material)
        ? material.map((entry) => entry.uuid).join(',')
        : material.uuid;
}

/**
 * Walks the template below `root` and returns the parts a ghost copy draws.
 * Hidden objects and the decorations above are skipped with their subtree;
 * `root` itself may be hidden (the template is never drawn). Call it after
 * the template has committed; it updates the template's world matrices.
 *
 * `maxInstancesPerMesh` caps the instanced meshes copied instance by
 * instance (see `maxGhostTemplateInstancesPerMesh`). The rim of a whole
 * Expand rectangle is one template drawn once, so it lifts the cap.
 */
export function collectGhostTemplateParts(
    root: Object3D,
    {
        maxInstancesPerMesh = maxGhostTemplateInstancesPerMesh,
    }: { maxInstancesPerMesh?: number } = {},
): GhostTemplateCollection {
    root.updateWorldMatrix(true, true);
    const inverseRoot = new Matrix4().copy(root.matrixWorld).invert();
    const parts = new Map<string, GhostTemplatePart>();
    const instanceMatrix = new Matrix4();
    let skinned = false;

    const addPart = (
        geometry: BufferGeometry,
        material: Material | Material[],
        matrices: Matrix4[],
    ) => {
        const key = `${geometry.uuid}|${getMaterialKey(material)}`;
        const part = parts.get(key);
        if (part) {
            part.localMatrices.push(...matrices);
        } else {
            parts.set(key, { geometry, material, localMatrices: matrices });
        }
    };

    const visit = (object: Object3D) => {
        if (object !== root) {
            if (!object.visible || isSkippedGhostTemplateObject(object)) {
                return;
            }
        }

        if (object instanceof SkinnedMesh) {
            skinned = true;
            return;
        }

        if (
            object instanceof Mesh &&
            isDrawableMaterial(object.material) &&
            !hasInstancedAttributes(object.geometry)
        ) {
            const local = new Matrix4().multiplyMatrices(
                inverseRoot,
                object.matrixWorld,
            );
            if (object instanceof InstancedMesh) {
                if (object.count > 0 && object.count <= maxInstancesPerMesh) {
                    const matrices: Matrix4[] = [];
                    for (let index = 0; index < object.count; index++) {
                        object.getMatrixAt(index, instanceMatrix);
                        matrices.push(
                            new Matrix4().multiplyMatrices(
                                local,
                                instanceMatrix,
                            ),
                        );
                    }
                    addPart(object.geometry, object.material, matrices);
                }
            } else {
                addPart(object.geometry, object.material, [local]);
            }
        }

        for (const child of object.children) {
            visit(child);
        }
    };
    visit(root);

    if (skinned) {
        return { kind: 'fallback', reason: 'skinned-mesh' };
    }
    if (parts.size === 0) {
        return { kind: 'fallback', reason: 'no-mesh' };
    }

    return { kind: 'parts', parts: [...parts.values()] };
}

/** How many copies of its parts a collection draws: its instance count. */
export function countGhostTemplateInstances(
    collection: GhostTemplateCollection | null,
) {
    if (collection?.kind !== 'parts') {
        return 0;
    }
    let count = 0;
    for (const part of collection.parts) {
        count += part.localMatrices.length;
    }
    return count;
}

/**
 * A cheap fingerprint of what the template draws: which meshes, geometries
 * and materials, their visibility and their instance counts and matrices.
 * It changes when an inner Suspense boundary resolves, a material is
 * swapped (a texture finished loading) or a mesh is replaced, so the parts
 * are collected again only then. Plain transforms are left out: the
 * template is static (no spring animation), and a part that moves on every
 * frame must not make the preview collect on every frame.
 * Allocation-free; it walks the same nodes as the collection.
 */
export function getGhostTemplateSignature(root: Object3D) {
    let hash = 2166136261;
    const mix = (value: number) => {
        hash = Math.imul(hash ^ value, 16777619) >>> 0;
    };

    const visit = (object: Object3D) => {
        if (object !== root) {
            if (!object.visible || isSkippedGhostTemplateObject(object)) {
                mix(-1);
                return;
            }
        }

        mix(object.id);
        if (object instanceof Mesh) {
            mix(object.geometry.id);
            const { material } = object;
            if (Array.isArray(material)) {
                for (const entry of material) {
                    mix(entry.id);
                    mix(entry.visible ? 1 : 0);
                }
            } else {
                mix(material.id);
                mix(material.visible ? 1 : 0);
            }
            if (object instanceof InstancedMesh) {
                mix(object.count);
                mix(object.instanceMatrix.version);
            }
        }

        mix(object.children.length);
        for (const child of object.children) {
            visit(child);
        }
    };
    visit(root);
    return hash;
}

/**
 * A see-through copy of a template material: transparent at the ghost
 * opacity and without depth writes, so ghosts never hide the garden behind
 * them. Its `depth` twin writes depth and no colour (the first ghost pass);
 * it keeps the same opacity and hooks, so it discards exactly the fragments
 * the colour pass discards.
 *
 * `Material.clone` drops compile hooks. Hooks that are pure functions of
 * their configuration (default hooks and the registered garden decorators,
 * such as the ground patch shader) are carried over, so ghost grass keeps
 * its painted patches. Unregistered hooks (Drei's wobble, the time-driven
 * materials) are left behind and the ghost draws the base material. The
 * scene's cloud shadow decorator is never copied.
 */
export function createGhostMaterial(
    source: Material,
    { opacity = expandGhostOpacity, pass = 'color' }: GhostMaterialOptions = {},
): Material {
    const ghost = source.clone();
    if (getGardenMaterialShaderHookSignature(source) !== undefined) {
        const hooks =
            getMaterialShaderHooksWithoutCloudShadowAttenuation(source);
        ghost.onBeforeCompile = hooks.onBeforeCompile;
        ghost.customProgramCacheKey = hooks.customProgramCacheKey;
    }
    ghost.transparent = true;
    ghost.opacity = opacity;
    ghost.depthWrite = pass === 'depth';
    ghost.colorWrite = pass === 'color';
    ghost.name = `BlockExpand:Ghost${pass === 'depth' ? 'Depth' : ''}:${source.name || source.type}`;
    return ghost;
}

/** Ghost materials by the uuid of the template material they copy. */
export type GhostMaterialSet = Map<string, Material>;

/**
 * One ghost material per distinct template material and pass, shared by
 * every part that uses it. Dispose them with `disposeGhostMaterials`; the
 * template's own geometries and materials are shared resources and stay
 * untouched.
 */
export function createGhostMaterials<
    Part extends Pick<GhostTemplatePart, 'material'>,
>(
    parts: readonly Part[],
    previous?: GhostMaterialSet,
    options?: GhostMaterialOptions,
): GhostMaterialSet {
    const materials: GhostMaterialSet = new Map();
    for (const part of parts) {
        const sources = Array.isArray(part.material)
            ? part.material
            : [part.material];
        for (const source of sources) {
            if (materials.has(source.uuid)) {
                continue;
            }
            materials.set(
                source.uuid,
                previous?.get(source.uuid) ??
                    createGhostMaterial(source, options),
            );
        }
    }
    return materials;
}

/** The ghost material(s) for a part, in the part's material order. */
export function getGhostPartMaterial<
    Part extends Pick<GhostTemplatePart, 'material'>,
>(part: Part, materials: GhostMaterialSet): Material | Material[] | null {
    if (Array.isArray(part.material)) {
        const resolved: Material[] = [];
        for (const source of part.material) {
            const ghost = materials.get(source.uuid);
            if (!ghost) {
                return null;
            }
            resolved.push(ghost);
        }
        return resolved;
    }

    return materials.get(part.material.uuid) ?? null;
}

/**
 * Disposes the ghost materials in `materials` that `keep` does not hold.
 * Only ghost clones are ever disposed.
 */
export function disposeGhostMaterials(
    materials: GhostMaterialSet,
    keep?: GhostMaterialSet,
) {
    for (const [uuid, material] of materials) {
        if (keep?.get(uuid) === material) {
            continue;
        }
        material.dispose();
    }
}
