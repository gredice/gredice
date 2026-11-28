import {
    Box3,
    BufferGeometry,
    type IUniform,
    Material,
    Mesh,
    type Object3D,
    ShaderMaterial,
    Vector3,
} from 'three';
import { getMaterialShaderHooksWithoutCloudShadowAttenuation } from './cloudShadowAttenuation';

/**
 * Idle breathing for living things (GAME_ART.md, "Motion"): a slow stretch of
 * 2% to 3.5% at about one cycle every four seconds, each instance with its own
 * phase. The stretch preserves volume like the placement bounce: when height
 * scales by `1 + b`, width and depth scale by `1 - b / 2`.
 *
 * The same timing runs in three places. Batched canopies and instanced living
 * blocks (pine, tulip) breathe about the instance origin in the vertex shader,
 * so their instanced meshes stay static on the CPU. Living entities drawn as
 * several meshes (palm, maple, rose, sunflower, the flowers of an aster pot)
 * breathe about the point they stand on, also in the vertex shader, in world
 * space. Animals scale a body part on frames they already render. In both
 * shader paths only the drawn position moves: shadow-map lookups use the rest
 * surface, which is what the event-refreshed shadow map holds.
 *
 * Breathing materials register no shader-hook signature
 * (`registerGardenMaterialShaderHooks`) on purpose: merged static packets hold
 * world-space vertices without an instance origin, so a breathing batch must
 * stay an instanced mesh, and it stays out of the static scene cache.
 *
 * None of it asks the scene for frames of its own: breathing advances
 * whenever something else animates (clouds, plant sway, animals) and holds its
 * pose while the scene is otherwise idle.
 */

/** Nominal length of one breath. */
export const idleBreathingPeriodSeconds = 4;
/** Each instance runs up to this fraction faster or slower, so neighbours drift apart. */
export const idleBreathingPeriodJitter = 0.1;
/** Allowed peak stretch from GAME_ART.md. */
export const idleBreathingAmplitudeRange = { max: 0.035, min: 0.02 } as const;
/** Snow coverage above which foliage is treated as snow-loaded and holds still. */
export const idleBreathingSnowThreshold = 0.02;

export type IdleBreathingRole =
    | 'animal'
    | 'canopy'
    | 'flower'
    | 'shrub'
    | 'tall-plant';

/**
 * Peak vertical stretch per role. A tall plant breathes from the ground, so
 * its top travels furthest; it uses the low end of the range. An animal
 * breathes with its body only, about the body's own centre.
 */
export const idleBreathingAmplitudes = {
    animal: 0.025,
    canopy: 0.025,
    flower: 0.03,
    shrub: 0.03,
    'tall-plant': 0.02,
} as const satisfies Record<IdleBreathingRole, number>;

export type IdleBreathingEntity = {
    /**
     * Mesh names (the model's exported object names) of the living parts of a
     * prop, such as the flowers in a pot. They breathe from the bottom of
     * their own bounds; the rest of the prop holds still. Without parts the
     * whole entity breathes from the point it stands on.
     */
    parts?: readonly string[];
    role: IdleBreathingRole;
};

const autumnAsterPotFlowers = {
    parts: [
        'AutumnAsterPot_Centers',
        'AutumnAsterPot_Foliage',
        'AutumnAsterPot_Petals',
    ],
    role: 'flower',
} as const satisfies IdleBreathingEntity;

/**
 * Living entities that render as one component per block. Instanced trees and
 * bushes breathe in their canopy shader instead, so they are not listed.
 */
const idleBreathingEntities: Readonly<Record<string, IdleBreathingEntity>> = {
    AutumnAsterPotCream: autumnAsterPotFlowers,
    AutumnAsterPotGold: autumnAsterPotFlowers,
    AutumnAsterPotMauve: autumnAsterPotFlowers,
    AutumnShrub: { role: 'shrub' },
    PalmTree: { role: 'tall-plant' },
    PineAdvent: { role: 'tall-plant' },
    Rose: { role: 'flower' },
    SeasonalMaple: { role: 'tall-plant' },
    /** A static model with no rig of its own: it breathes from the ground. */
    Sheep: { role: 'animal' },
    Sunflower: { role: 'tall-plant' },
};

export function getIdleBreathingEntity(
    blockName: string,
): IdleBreathingEntity | undefined {
    return Object.hasOwn(idleBreathingEntities, blockName)
        ? idleBreathingEntities[blockName]
        : undefined;
}

export function getIdleBreathingEntityRole(
    blockName: string,
): IdleBreathingRole | undefined {
    return getIdleBreathingEntity(blockName)?.role;
}

/**
 * Living blocks that the garden draws as instanced batches of their model
 * material. Each part breathes about its own instance origin, which for these
 * models is the point the plant grows from. Trees and bushes are not listed:
 * only their canopy breathes, in its own batch.
 */
const idleBreathingInstancedRoles: Readonly<Record<string, IdleBreathingRole>> =
    {
        Pine: 'tall-plant',
        Tulip: 'flower',
    };

export function getIdleBreathingInstancedRole(
    blockName: string,
): IdleBreathingRole | undefined {
    return Object.hasOwn(idleBreathingInstancedRoles, blockName)
        ? idleBreathingInstancedRoles[blockName]
        : undefined;
}

function fract(value: number) {
    return value - Math.floor(value);
}

/**
 * Phase seed in [0, 1) for the tile a living thing stands on. Rounding to the
 * tile keeps the phase stable while a block is dragged within a tile. The
 * shader uses the same hash.
 */
export function idleBreathingSeed(x: number, z: number) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
    const tileX = Math.floor(x + 0.5);
    const tileZ = Math.floor(z + 0.5);
    return fract(Math.sin(tileX * 12.9898 + tileZ * 78.233) * 43758.5453);
}

/** Length of one breath for a seed, within the jitter around four seconds. */
export function idleBreathingPeriod(seed: number) {
    const jitter = fract(seed * 7.13) * 2 - 1;
    return (
        idleBreathingPeriodSeconds * (1 + idleBreathingPeriodJitter * jitter)
    );
}

/** Breath position in [-1, 1] at a scene time, for one seed. */
export function idleBreathingWave(timeSeconds: number, seed: number) {
    if (!Number.isFinite(timeSeconds) || !Number.isFinite(seed)) return 0;
    return Math.sin(
        2 * Math.PI * (timeSeconds / idleBreathingPeriod(seed) + seed),
    );
}

/**
 * GLSL factor that jitters the breath speed of one instance of a batched
 * plant by the same share as `idleBreathingPeriod`, from its sway phase, so
 * plants in one batch drift apart instead of breathing in lockstep.
 */
export const plantInstanceBreathSpeedJitterGlsl = /* glsl */ `( 1.0 + ${idleBreathingPeriodJitter.toFixed(4)} * ( fract( instanceSwayPhase * 7.13 ) * 2.0 - 1.0 ) )`;

/** Volume-preserving stretch for a breath position. */
export function idleBreathingScale(amplitude: number, wave: number) {
    const breath =
        Number.isFinite(amplitude) && Number.isFinite(wave)
            ? amplitude * wave
            : 0;
    return { side: 1 - breath / 2, up: 1 + breath };
}

/**
 * Peak stretch for a role, or zero where living things hold still: reduced
 * motion, fixed-time captures (block images keep the rest pose) and snow.
 */
export function resolveIdleBreathingAmplitude({
    enabled = true,
    fixedTime = false,
    reducedMotion,
    role,
}: {
    enabled?: boolean;
    fixedTime?: boolean;
    reducedMotion: boolean;
    role: IdleBreathingRole;
}) {
    if (!enabled || reducedMotion || fixedTime) return 0;
    return idleBreathingAmplitudes[role];
}

/**
 * Where a canopy breathes from: the centre of the bottom of its full shape, so
 * the crown stays seated on its trunk and a bush stays on the ground.
 */
export function getIdleBreathingPivot(
    geometry: BufferGeometry,
    target = new Vector3(),
) {
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box || box.isEmpty()) return target.set(0, 0, 0);
    return target.set(
        (box.min.x + box.max.x) / 2,
        box.min.y,
        (box.min.z + box.max.z) / 2,
    );
}

export type IdleBreathingUniforms = {
    grediceIdleBreathAmplitude: IUniform<number>;
    grediceIdleBreathPivot: IUniform<Vector3>;
    grediceIdleBreathTime: IUniform<number>;
};

/** `time` is the shared scene time uniform; the others belong to one batch. */
export function createIdleBreathingUniforms(
    time: IUniform<number>,
    pivot = new Vector3(),
): IdleBreathingUniforms {
    return {
        grediceIdleBreathAmplitude: { value: 0 },
        grediceIdleBreathPivot: { value: pivot },
        grediceIdleBreathTime: time,
    };
}

const idleBreathingMarker = '// gredice:idle-breathing';
const idleBreathingCacheKey = 'gredice-idle-breathing-v2';
const idleBreathingWorldMarker = '// gredice:idle-breathing-world';
const idleBreathingWorldCacheKey = 'gredice-idle-breathing-world-v1';

/**
 * GLSL for the volume-preserving stretch of one breath, the same maths as
 * `idleBreathingSeed`, `idleBreathingWave` and `idleBreathingScale`. `tile` is
 * the tile the living thing stands on; it sets the phase and period.
 */
function idleBreathingStretchGlsl(tile: string) {
    return /* glsl */ `vec2 grediceIdleBreathTile = floor( ${tile} + 0.5 );
    float grediceIdleBreathSeed = fract( sin( dot( grediceIdleBreathTile, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
    float grediceIdleBreathPeriod = ${idleBreathingPeriodSeconds.toFixed(4)} * ( 1.0 + ${idleBreathingPeriodJitter.toFixed(4)} * ( fract( grediceIdleBreathSeed * 7.13 ) * 2.0 - 1.0 ) );
    float grediceIdleBreathValue = grediceIdleBreathAmplitude * sin( 6.28318530718 * ( grediceIdleBreathTime / grediceIdleBreathPeriod + grediceIdleBreathSeed ) );
    vec3 grediceIdleBreathStretch = vec3( 1.0 - 0.5 * grediceIdleBreathValue, 1.0 + grediceIdleBreathValue, 1.0 - 0.5 * grediceIdleBreathValue );`;
}

/**
 * Vertex shader half of the breathing. The anchor is the instance origin in
 * world space, so every instance of a batch gets its own phase and an
 * instanced mesh never has to rewrite its matrices. The pivot is in geometry
 * space, before the instance transform.
 */
export const idleBreathingVertexShaderChunk = /* glsl */ `
${idleBreathingMarker}
uniform float grediceIdleBreathTime;
uniform float grediceIdleBreathAmplitude;
uniform vec3 grediceIdleBreathPivot;
vec3 grediceIdleBreath( vec3 point ) {
    if ( grediceIdleBreathAmplitude <= 0.0 ) return point;
    vec4 grediceIdleBreathAnchor = vec4( 0.0, 0.0, 0.0, 1.0 );
    #ifdef USE_INSTANCING
        grediceIdleBreathAnchor = instanceMatrix * grediceIdleBreathAnchor;
    #endif
    ${idleBreathingStretchGlsl('( modelMatrix * grediceIdleBreathAnchor ).xz')}
    return grediceIdleBreathPivot + ( point - grediceIdleBreathPivot ) * grediceIdleBreathStretch;
}
`;

/** Applied right after `begin_vertex`: moves the drawn surface. */
export const idleBreathingApplyLine =
    'vec3 grediceIdleBreathOffset = grediceIdleBreath( transformed ) - transformed;\ntransformed += grediceIdleBreathOffset;';
/** Applied right after `project_vertex`: later chunks see the rest surface. */
export const idleBreathingRestoreLine =
    'transformed -= grediceIdleBreathOffset;';

/**
 * Adds breathing to a built-in vertex shader. It runs right after
 * `begin_vertex`, before any wind offset another decorator appends there.
 *
 * Only the projected position breathes. Once `project_vertex` has placed the
 * vertex on screen the offset is taken back out, so `worldpos_vertex` and the
 * chunks after it (shadow-map lookups, cloud shadows, weather) see the rest
 * surface. The shadow map is drawn from the rest pose and refreshed only on
 * scene changes; looking it up from a breathing surface would let a crown
 * shadow itself in stripes whenever it shrinks below its rest shape.
 */
export function patchIdleBreathingVertexShader(vertexShader: string) {
    if (vertexShader.includes(idleBreathingMarker)) return vertexShader;
    const common = '#include <common>';
    const beginVertex = '#include <begin_vertex>';
    const projectVertex = '#include <project_vertex>';
    if (
        !vertexShader.includes(common) ||
        !vertexShader.includes(beginVertex) ||
        !vertexShader.includes(projectVertex)
    )
        throw new Error('Unsupported idle breathing vertex shader');
    return vertexShader
        .replace(common, `${common}\n${idleBreathingVertexShaderChunk}`)
        .replace(beginVertex, `${beginVertex}\n${idleBreathingApplyLine}`)
        .replace(
            projectVertex,
            `${projectVertex}\n${idleBreathingRestoreLine}`,
        );
}

/**
 * Composes breathing with the hooks a material already has. Call it only on
 * owned materials, before their first render: GLTF cache materials are shared
 * by every user of a model. The pivot comes from the instance or model matrix,
 * so a breathing material must not join merged static packets, whose vertices
 * are already in world space; without a registered signature it stays
 * identity-only there.
 */
export function bindIdleBreathingMaterial(
    material: Material,
    uniforms: IdleBreathingUniforms,
) {
    const previousCompile = material.onBeforeCompile;
    const previousKey = material.customProgramCacheKey;
    const onBeforeCompile: Material['onBeforeCompile'] = (shader, renderer) => {
        previousCompile.call(material, shader, renderer);
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = patchIdleBreathingVertexShader(
            shader.vertexShader,
        );
    };
    const customProgramCacheKey = () =>
        `${previousKey.call(material)}|${idleBreathingCacheKey}`;
    material.onBeforeCompile = onBeforeCompile;
    material.customProgramCacheKey = customProgramCacheKey;
    material.needsUpdate = true;
    instanceBreathingMaterials.add(material);
    return () => {
        if (material.onBeforeCompile === onBeforeCompile)
            material.onBeforeCompile = previousCompile;
        if (material.customProgramCacheKey === customProgramCacheKey)
            material.customProgramCacheKey = previousKey;
        instanceBreathingMaterials.delete(material);
        material.needsUpdate = true;
    };
}

/** Materials that already breathe about their instance origin. */
const instanceBreathingMaterials = new WeakSet<Material>();

/**
 * `clone` keeps a material's properties but not shader hooks set on the
 * instance, such as autumn wind; this copy keeps them too. It leaves out the
 * cloud-shadow decorator: the cloud layer finds the copy in the scene and
 * decorates it itself, so copying it would inject the cloud shader twice.
 */
function cloneWithShaderHooks(material: Material) {
    const copy = material.clone();
    const hooks = getMaterialShaderHooksWithoutCloudShadowAttenuation(material);
    copy.onBeforeCompile = hooks.onBeforeCompile;
    copy.customProgramCacheKey = hooks.customProgramCacheKey;
    return copy;
}

/**
 * A breathing copy of a shared model material for one instanced batch. The
 * caller owns and disposes it.
 */
export function createIdleBreathingMaterial(
    material: Material,
    uniforms: IdleBreathingUniforms,
) {
    const copy = cloneWithShaderHooks(material);
    bindIdleBreathingMaterial(copy, uniforms);
    return copy;
}

export type IdleBreathingWorldUniforms = {
    grediceIdleBreathAmplitude: IUniform<number>;
    grediceIdleBreathTime: IUniform<number>;
    grediceIdleBreathWorldPivot: IUniform<Vector3>;
};

/** `time` is the shared scene time uniform; the others belong to one entity. */
export function createIdleBreathingWorldUniforms(
    time: IUniform<number>,
    worldPivot = new Vector3(),
): IdleBreathingWorldUniforms {
    return {
        grediceIdleBreathAmplitude: { value: 0 },
        grediceIdleBreathTime: time,
        grediceIdleBreathWorldPivot: { value: worldPivot },
    };
}

/**
 * Breathing for a living thing drawn as several meshes, such as a palm or a
 * rose: every part stretches about the one world-space point the entity
 * stands on, so trunk, fronds and flowers stay joined. The phase comes from
 * that point's tile, as for an instanced canopy.
 */
export const idleBreathingWorldVertexShaderChunk = /* glsl */ `
${idleBreathingWorldMarker}
uniform float grediceIdleBreathTime;
uniform float grediceIdleBreathAmplitude;
uniform vec3 grediceIdleBreathWorldPivot;
vec3 grediceIdleBreathWorld( vec3 world ) {
    if ( grediceIdleBreathAmplitude <= 0.0 ) return world;
    ${idleBreathingStretchGlsl('grediceIdleBreathWorldPivot.xz')}
    return grediceIdleBreathWorldPivot + ( world - grediceIdleBreathWorldPivot ) * grediceIdleBreathStretch;
}
`;

/**
 * Replaces the projected position right after `project_vertex`. `transformed`
 * is left alone, so `worldpos_vertex` and every chunk after it (shadow-map
 * lookups, cloud shadows, weather) see the rest surface the static shadow map
 * was drawn from.
 */
export const idleBreathingWorldProjectBlock = /* glsl */ `{
    vec4 grediceIdleBreathPoint = vec4( transformed, 1.0 );
    #ifdef USE_BATCHING
        grediceIdleBreathPoint = batchingMatrix * grediceIdleBreathPoint;
    #endif
    #ifdef USE_INSTANCING
        grediceIdleBreathPoint = instanceMatrix * grediceIdleBreathPoint;
    #endif
    grediceIdleBreathPoint = modelMatrix * grediceIdleBreathPoint;
    grediceIdleBreathPoint.xyz = grediceIdleBreathWorld( grediceIdleBreathPoint.xyz );
    mvPosition = viewMatrix * grediceIdleBreathPoint;
    gl_Position = projectionMatrix * mvPosition;
}`;

/**
 * World-space breathing for a built-in vertex shader. Shaders without the
 * built-in chunks (custom overlays) are returned unchanged and hold still.
 */
export function patchIdleBreathingWorldVertexShader(vertexShader: string) {
    if (vertexShader.includes(idleBreathingWorldMarker)) return vertexShader;
    const common = '#include <common>';
    const projectVertex = '#include <project_vertex>';
    if (!vertexShader.includes(common) || !vertexShader.includes(projectVertex))
        return vertexShader;
    return vertexShader
        .replace(common, `${common}\n${idleBreathingWorldVertexShaderChunk}`)
        .replace(
            projectVertex,
            `${projectVertex}\n${idleBreathingWorldProjectBlock}`,
        );
}

/** Composes world-space breathing with the hooks a material already has. */
export function bindIdleBreathingWorldMaterial(
    material: Material,
    uniforms: IdleBreathingWorldUniforms,
) {
    const previousCompile = material.onBeforeCompile;
    const previousKey = material.customProgramCacheKey;
    const onBeforeCompile: Material['onBeforeCompile'] = (shader, renderer) => {
        previousCompile.call(material, shader, renderer);
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = patchIdleBreathingWorldVertexShader(
            shader.vertexShader,
        );
    };
    const customProgramCacheKey = () =>
        `${previousKey.call(material)}|${idleBreathingWorldCacheKey}`;
    material.onBeforeCompile = onBeforeCompile;
    material.customProgramCacheKey = customProgramCacheKey;
    material.needsUpdate = true;
    return () => {
        if (material.onBeforeCompile === onBeforeCompile)
            material.onBeforeCompile = previousCompile;
        if (material.customProgramCacheKey === customProgramCacheKey)
            material.customProgramCacheKey = previousKey;
        material.needsUpdate = true;
    };
}

type IdleBreathingMaterialBinding = {
    material: Material;
    release: () => void;
};

/** Materials one breathing entity has bound, by the material they replace. */
export type IdleBreathingSubtreeBindings = Map<
    Material,
    IdleBreathingMaterialBinding
>;

/**
 * Whether a material belongs to one element only. react-three-fiber marks the
 * materials it creates from JSX (`<meshStandardMaterial />`); those are
 * patched in place so their reactive props, such as a seasonal colour, keep
 * working. Anything else may be shared (a cached GLTF material, including
 * one attached with `<primitive object={...} />`), so the entity gets its own
 * copy.
 */
function isElementOwnedMaterial(material: Material) {
    if (!Object.hasOwn(material, '__r3f')) return false;
    const instance: unknown = Reflect.get(material, '__r3f');
    if (typeof instance !== 'object' || instance === null) return false;
    return Reflect.get(instance, 'type') !== 'primitive';
}

function bindSubtreeMaterial(
    material: Material,
    uniforms: IdleBreathingWorldUniforms,
    bindings: IdleBreathingSubtreeBindings,
    bound: WeakSet<Material>,
) {
    if (bound.has(material)) return material;
    // Custom shader materials (weather overlays) keep their own uniforms and
    // vertex code; copying them would detach shared uniforms. A material that
    // already breathes about its instance must not breathe twice.
    if (
        material instanceof ShaderMaterial ||
        instanceBreathingMaterials.has(material)
    )
        return material;
    const existing = bindings.get(material);
    if (existing) return existing.material;
    let binding: IdleBreathingMaterialBinding;
    if (isElementOwnedMaterial(material)) {
        binding = {
            material,
            release: bindIdleBreathingWorldMaterial(material, uniforms),
        };
    } else {
        const copy = cloneWithShaderHooks(material);
        bindIdleBreathingWorldMaterial(copy, uniforms);
        binding = { material: copy, release: () => copy.dispose() };
    }
    bindings.set(material, binding);
    bound.add(binding.material);
    return binding.material;
}

/**
 * Gives every mesh under `root` a breathing material bound to `uniforms`.
 * Safe to call every frame: meshes already bound are skipped, and a mesh
 * whose material changed since is bound again.
 */
export function bindIdleBreathingSubtree(
    root: Object3D,
    uniforms: IdleBreathingWorldUniforms,
    bindings: IdleBreathingSubtreeBindings,
    bound: WeakSet<Material>,
    parts?: readonly string[],
) {
    root.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        if (parts && !parts.includes(object.name)) return;
        const material: unknown = object.material;
        if (Array.isArray(material)) {
            let changed = false;
            const next = material.map((entry) => {
                if (!(entry instanceof Material)) return entry;
                const result = bindSubtreeMaterial(
                    entry,
                    uniforms,
                    bindings,
                    bound,
                );
                changed ||= result !== entry;
                return result;
            });
            if (changed) object.material = next;
            return;
        }
        if (!(material instanceof Material)) return;
        const result = bindSubtreeMaterial(material, uniforms, bindings, bound);
        if (result !== material) object.material = result;
    });
}

/**
 * Whether a weather overlay, such as snow cover or rain wetness, is drawn on
 * a living entity. Overlays are custom shaders that keep the rest surface, so
 * a plant they cover holds still instead of breathing through them. Some
 * entities keep their snow all season (the advent pine), whatever the
 * weather says.
 */
export function hasIdleBreathingOverlay(root: Object3D) {
    let covered = false;
    root.traverseVisible((object) => {
        if (covered || !(object instanceof Mesh)) return;
        const material: unknown = object.material;
        const materials = Array.isArray(material) ? material : [material];
        covered = materials.some(
            (entry) => entry instanceof ShaderMaterial && entry.visible,
        );
    });
    return covered;
}

const partBounds = new Box3();
const partBox = new Box3();

/**
 * World-space point the living parts of a prop breathe from: the centre of
 * the bottom of their joint bounds, or null while none of them is mounted.
 * The bounds come from the rest geometry, so breathing never moves the pivot.
 */
export function getIdleBreathingPartsPivot(
    root: Object3D,
    parts: readonly string[],
    target: Vector3,
) {
    partBounds.makeEmpty();
    root.traverse((object) => {
        if (!(object instanceof Mesh) || !parts.includes(object.name)) return;
        const geometry: unknown = object.geometry;
        if (!(geometry instanceof BufferGeometry)) return;
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        if (!geometry.boundingBox) return;
        partBox.copy(geometry.boundingBox).applyMatrix4(object.matrixWorld);
        partBounds.union(partBox);
    });
    if (partBounds.isEmpty()) return null;
    return target.set(
        (partBounds.min.x + partBounds.max.x) / 2,
        partBounds.min.y,
        (partBounds.min.z + partBounds.max.z) / 2,
    );
}

/**
 * Releases what `bindIdleBreathingSubtree` added: meshes under `root` get
 * their own materials back, copies are disposed and in-place hooks removed.
 */
export function releaseIdleBreathingSubtree(
    root: Object3D | null,
    bindings: IdleBreathingSubtreeBindings,
) {
    const originals = new Map<Material, Material>();
    for (const [original, binding] of bindings)
        if (binding.material !== original)
            originals.set(binding.material, original);
    root?.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const material: unknown = object.material;
        if (Array.isArray(material)) {
            if (material.some((entry) => originals.has(entry)))
                object.material = material.map(
                    (entry) => originals.get(entry) ?? entry,
                );
            return;
        }
        if (!(material instanceof Material)) return;
        const original = originals.get(material);
        if (original) object.material = original;
    });
    for (const binding of bindings.values()) binding.release();
    bindings.clear();
}
