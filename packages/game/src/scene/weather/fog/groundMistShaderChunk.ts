import type { BlockData } from '@gredice/client';
import {
    getEffectiveGardenStackBlockHeight,
    isWaterBlockName,
} from '@gredice/js/gardenBlocks';
import { type IUniform, type Scene, ShaderChunk, ShaderLib } from 'three';
import type { GardenStack } from '../../../types/Stack';

/**
 * Ground mist and back haze (GAME_ART.md "Weather > Fog and mist"), applied
 * inside every lit built-in material and in the static cache replay.
 *
 * - Ground mist: rounded bands 1.45 units apart in depth, broken into pills
 *   along the screen axis and sliding sideways. Densest at the local ground,
 *   gone 0.42 units up. At most 0.45 on the ground and 0.3 on anything
 *   standing on it.
 * - Back haze: by screen height, not depth: none below the view centre,
 *   rising to at most 0.2 at the top edge, the same at any zoom.
 *
 * The mist mixes the final on-screen colour (after tone mapping and colour
 * space conversion) toward the mist role, in approximately linear light like
 * the target, so a fully misted pixel shows the role colour and the static
 * cache, which stores on-screen colour, can add the same mist in its replay.
 * ALU only: no texture, no extra varying.
 *
 * Every lit material shares one set of uniforms. They are typed arrays, which
 * `UniformsUtils.clone` copies by reference, so one write reaches every
 * compiled program, like the cloud shadow uniforms. Like those, it assumes
 * one active weather scene per page.
 */
export const groundMistRules = {
    /** Distance between mist bands in depth, in world units. */
    bandSpacing: 1.45,
    /** Band profile across its row: full inside, gone at the edge (row shares). */
    bandCore: 0.1,
    bandEdge: 0.42,
    /**
     * Pill frequency along the screen axis and phase offset per row: pills
     * about 2.5 units long, so a big farm shows patches, not long bars.
     */
    pillFrequency: 1.15,
    pillRowOffset: 2.17,
    /**
     * A slower second wave, its own phase per row, makes the pills uneven
     * in length and spacing (its share of the pill wave).
     */
    pillBeatFrequency: 0.47,
    pillBeatShare: 0.38,
    /**
     * Every row varies by its own hash, so a big farm shows no even white
     * stripes: pill frequency ±20%, band width (edge share) 0.8 to 1×,
     * density ±15%, and one row in about eight fades to a quarter.
     */
    rowFrequency: [0.8, 1.2],
    rowWidth: [0.8, 1.0],
    /**
     * Each band sits up to this share of a row off the row's centre, so the
     * rows are unevenly spaced (with rowWidth, a band still fades out
     * before its row ends).
     */
    rowShift: 0.1,
    /**
     * Where many rows show at once (a farm filling the view), the bands
     * soften toward the mist floor, so the field reads as mist, not stripes:
     * full contrast up to `fullBandRows` rows on screen, down to
     * `minBandScale` of it.
     */
    fullBandRows: 4.5,
    minBandScale: 0.55,
    rowDensity: [0.85, 1.15],
    rowGapShare: 0.12,
    rowGapDensity: 0.25,
    /** `sin` range that turns into a pill: gone below, full above. */
    pillLow: -0.45,
    pillHigh: 0.6,
    /**
     * Mist everywhere on the ground, plus the bands on top of it: a softer
     * band contrast, so many rows on a farm read as mist, not stripes.
     */
    baseDensity: 0.1,
    bandDensity: 0.4,
    /** Mist fades out from this far below the ground to this far above it. */
    fadeBottom: -0.03,
    fadeTop: 0.42,
    /** Most mist on the ground and on anything standing on it. */
    groundCap: 0.45,
    standingCap: 0.3,
    /**
     * Up to this height above the ground a surface counts as ground. The
     * shaders cannot tell the terrain's material from a bed's, so the
     * ground is the thin layer at the block top: a bed skirt, a leg or a
     * stem gets the standing cap from 0.035 units (about 3 px at zoom 100)
     * up, and only its contact line takes the ground's.
     */
    groundBandBottom: 0.012,
    groundBandTop: 0.035,
    /** Most back haze, at the top edge of the view. */
    hazeMax: 0.2,
    /** Haze from the view centre (0) to this share of the half height. */
    hazeTop: 0.95,
    /**
     * Pill slide in phase radians per second, and per wind class (about
     * 0.19 units per second in still air at the pill frequency).
     */
    phaseSpeed: 0.22,
    phaseSpeedPerWind: 0.09,
    phaseStart: 1.3,
    /**
     * Below this fog amount the bands hold still and the layer holds no
     * render lease: at 0.1 the densest band is about 0.05, which moves the
     * frame by a few RGB at most.
     */
    activeFoggy: 0.1,
} as const;

const marker = '// gredice:ground-mist';

function glslFloat(value: number) {
    return value.toFixed(4);
}

/** Uniform storage shared by every program (see the module comment). */
const mistParams = new Float32Array(4);
const mistColor = new Float32Array([0.89, 0.87, 0.99, 1]);
const mistAxis = new Float32Array([
    -Math.SQRT1_2,
    Math.SQRT1_2,
    -Math.SQRT1_2,
    -Math.SQRT1_2,
]);
const mistView = new Float32Array([0, 1, 0, 0.25]);
const mistCenter = new Float32Array([0, 0, 0, 1]);

export type GroundMistUniformValues = {
    /** Fog amount, 0 to 1; 0 turns the mist off. */
    amount: number;
    /** Pill phase in radians (`resolveGroundMistPhaseSpeed`). */
    phase: number;
    /** World height of the garden's ground (`resolveGroundMistLevel`). */
    groundY: number;
    /** Back haze at the top edge, 0 to `hazeMax`; 0 in the avatar view. */
    haze: number;
    /** Mist role as on-screen sRGB, 0 to 1. */
    color: readonly [number, number, number];
    /** Screen right and its perpendicular (into the view) on the ground. */
    alongX: number;
    alongZ: number;
    /** Screen up in world space and half the view height in world units. */
    up: readonly [number, number, number];
    halfHeight: number;
    /** Any world point on the view axis, such as the camera position. */
    center: readonly [number, number, number];
    /** Band contrast, `minBandScale` to 1 (`resolveGroundMistBandScale`). */
    bandScale?: number;
};

/**
 * Band contrast for how many mist rows the garden shows on screen: its
 * visible height (view units) over the on-screen row spacing (`upDepth` is
 * how far screen up leans into the depth axis, about 0.58 in the iso view).
 */
export function resolveGroundMistBandScale({
    upDepth,
    visibleHeight,
}: {
    upDepth: number;
    visibleHeight: number;
}) {
    const spacing = groundMistRules.bandSpacing * Math.abs(upDepth);
    if (!(spacing > 1e-6) || !(visibleHeight > 0)) return 1;
    const rows = visibleHeight / spacing;
    return Math.min(
        1,
        Math.max(
            groundMistRules.minBandScale,
            groundMistRules.fullBandRows / rows,
        ),
    );
}

/**
 * The mist amount and haze the garden asked for. They reach the shared
 * uniforms only while the garden's own scene renders (`attachGroundMistToScene`),
 * so other canvases on the page (item previews, viewers), which compile the
 * same lit programs, never show the garden's mist.
 */
const requested = { amount: 0, haze: 0 };
let suspendDepth = 0;
let sceneRendering = false;

function applyRequested() {
    const off = suspendDepth > 0 || !sceneRendering;
    mistParams[0] = off ? 0 : requested.amount;
    mistParams[3] = off ? 0 : requested.haze;
}

function finite(value: number) {
    return Number.isFinite(value) ? value : 0;
}

/**
 * Writes the shared uniforms. Returns whether anything changed, so a caller
 * without a render lease knows when to request a frame.
 */
export function writeGroundMistUniforms(values: GroundMistUniformValues) {
    const alongLength = Math.hypot(values.alongX, values.alongZ) || 1;
    const ax = values.alongX / alongLength;
    const az = values.alongZ / alongLength;
    let changed =
        requested.amount !== finite(values.amount) ||
        requested.haze !== finite(values.haze);
    requested.amount = finite(values.amount);
    requested.haze = finite(values.haze);
    const next = [
        [
            mistParams,
            [
                mistParams[0] ?? 0,
                values.phase,
                values.groundY,
                mistParams[3] ?? 0,
            ],
        ],
        [mistColor, [values.color[0], values.color[1], values.color[2], 1]],
        // The depth axis is the along axis turned a quarter, as the target's
        // `axisD = vec2(-axisR.y, axisR.x)`.
        [mistAxis, [ax, az, -az, ax]],
        [
            mistView,
            [
                values.up[0],
                values.up[1],
                values.up[2],
                1 / Math.max(1e-4, values.halfHeight),
            ],
        ],
        [
            mistCenter,
            [
                values.center[0],
                values.center[1],
                values.center[2],
                values.bandScale ?? 1,
            ],
        ],
    ] as const;
    for (const [target, source] of next) {
        for (let index = 0; index < 4; index += 1) {
            const safe = finite(source[index] ?? 0);
            if (target[index] !== Math.fround(safe)) {
                target[index] = safe;
                changed = true;
            }
        }
    }
    applyRequested();
    return changed;
}

/** Turns the mist and haze off (layer unmounted or weather off). */
export function clearGroundMistUniforms() {
    const changed = requested.amount !== 0 || requested.haze !== 0;
    requested.amount = 0;
    requested.haze = 0;
    applyRequested();
    return changed;
}

/** The requested amount and haze, for profiling and tests. */
export function readGroundMistUniforms() {
    return {
        amount: requested.amount,
        phase: mistParams[1] ?? 0,
        groundY: mistParams[2] ?? 0,
        haze: requested.haze,
    };
}

/** The values the shaders see right now (0 outside the garden's render). */
export function readAppliedGroundMist() {
    return { amount: mistParams[0] ?? 0, haze: mistParams[3] ?? 0 };
}

/**
 * Turns the mist on for the garden scene's renders only: on in its
 * `onBeforeRender`, off again in its `onAfterRender`. The static cache's
 * capture and replay render the same scene, so they follow it too. Returns
 * the function that detaches it.
 */
export function attachGroundMistToScene(
    scene: Pick<Scene, 'onAfterRender' | 'onBeforeRender'>,
) {
    const previousBefore = scene.onBeforeRender;
    const previousAfter = scene.onAfterRender;
    const before: Scene['onBeforeRender'] = (...args) => {
        previousBefore.apply(scene, args);
        sceneRendering = true;
        applyRequested();
    };
    const after: Scene['onAfterRender'] = (...args) => {
        sceneRendering = false;
        applyRequested();
        previousAfter.apply(scene, args);
    };
    scene.onBeforeRender = before;
    scene.onAfterRender = after;
    return () => {
        if (scene.onBeforeRender === before)
            scene.onBeforeRender = previousBefore;
        if (scene.onAfterRender === after) scene.onAfterRender = previousAfter;
        sceneRendering = false;
        applyRequested();
    };
}

/**
 * Turns the mist off while the static cache captures, so the cache holds
 * the garden without mist and its replay adds the moving mist on top.
 * Returns the function that turns it back on.
 */
export function suspendGroundMist() {
    suspendDepth += 1;
    applyRequested();
    let resumed = false;
    return () => {
        if (resumed) return;
        resumed = true;
        suspendDepth = Math.max(0, suspendDepth - 1);
        applyRequested();
    };
}

/** The shared uniform objects, for a `ShaderMaterial` (the cache replay). */
export function getGroundMistUniforms(): Record<string, IUniform> {
    return {
        grediceMistParams: { value: mistParams },
        grediceMistColor: { value: mistColor },
        grediceMistAxis: { value: mistAxis },
        grediceMistView: { value: mistView },
        grediceMistCenter: { value: mistCenter },
    };
}

/** Pill slide speed in radians per second at a wind class. */
export function resolveGroundMistPhaseSpeed(windClass: number) {
    const wind = Number.isFinite(windClass) ? Math.max(0, windClass) : 0;
    return (
        groundMistRules.phaseSpeed + groundMistRules.phaseSpeedPerWind * wind
    );
}

const r = groundMistRules;

/** Uniform declarations and the mist function, valid GLSL 1 and 3. */
export const groundMistShaderFunctions = /* glsl */ `
uniform vec4 grediceMistParams;
uniform vec4 grediceMistColor;
uniform vec4 grediceMistAxis;
uniform vec4 grediceMistView;
uniform vec4 grediceMistCenter;

float grediceMistRowHash( float row, float salt ) {
    return fract( sin( row * 12.9898 + salt * 78.233 ) * 43758.5453 );
}

float grediceGroundMistBands( vec3 position ) {
    float along = dot( position.xz, grediceMistAxis.xy );
    float depth = dot( position.xz, grediceMistAxis.zw ) / ${glslFloat(r.bandSpacing)};
    float row = floor( depth + 0.5 );
    // Each row its own width, pill rhythm and density (rowWidth stays
    // under 0.5 / bandEdge, so a band is gone before its row ends).
    float edge = ${glslFloat(r.bandEdge)} * mix(
        ${glslFloat(r.rowWidth[0])},
        ${glslFloat(r.rowWidth[1])},
        grediceMistRowHash( row, 1.0 )
    );
    float shift = ( grediceMistRowHash( row, 6.0 ) - 0.5 ) *
        ${glslFloat(2 * r.rowShift)};
    float band = 1.0 - smoothstep(
        ${glslFloat(r.bandCore)},
        edge,
        abs( depth - row - shift )
    );
    float frequency = ${glslFloat(r.pillFrequency)} * mix(
        ${glslFloat(r.rowFrequency[0])},
        ${glslFloat(r.rowFrequency[1])},
        grediceMistRowHash( row, 2.0 )
    );
    float density = mix(
        ${glslFloat(r.rowDensity[0])},
        ${glslFloat(r.rowDensity[1])},
        grediceMistRowHash( row, 3.0 )
    ) * mix(
        1.0,
        ${glslFloat(r.rowGapDensity)},
        step( ${glslFloat(1 - r.rowGapShare)}, grediceMistRowHash( row, 4.0 ) )
    );
    float phase = along * frequency +
        row * ${glslFloat(r.pillRowOffset)} +
        grediceMistParams.y * ( 0.8 + 0.3 * sin( row * 1.7 ) );
    float wave = mix(
        sin( phase ),
        sin(
            phase * ${glslFloat(r.pillBeatFrequency)} +
                grediceMistRowHash( row, 5.0 ) * 6.2832
        ),
        ${glslFloat(r.pillBeatShare)}
    );
    float pills = smoothstep(
        ${glslFloat(r.pillLow)},
        ${glslFloat(r.pillHigh)},
        wave
    );
    return band * pills * density;
}

// Mist share at a world position: ground bands, then the back haze, capped
// lower on anything standing than on the ground itself.
float grediceGroundMist( vec3 position ) {
    float height = position.y - grediceMistParams.z;
    float mist = grediceMistParams.x * (
        ${glslFloat(r.baseDensity)} +
        ${glslFloat(r.bandDensity)} * grediceGroundMistBands( position ) *
            grediceMistCenter.w
    ) * ( 1.0 - smoothstep(
        ${glslFloat(r.fadeBottom)},
        ${glslFloat(r.fadeTop)},
        height
    ) );
    float up = dot( position - grediceMistCenter.xyz, grediceMistView.xyz ) *
        grediceMistView.w;
    mist = max(
        mist,
        grediceMistParams.w * smoothstep( 0.0, ${glslFloat(r.hazeTop)}, up )
    );
    float cap = mix(
        ${glslFloat(r.groundCap)},
        ${glslFloat(r.standingCap)},
        smoothstep(
            ${glslFloat(r.groundBandBottom)},
            ${glslFloat(r.groundBandTop)},
            height
        )
    );
    return clamp( mist, 0.0, cap );
}

// Mixes an on-screen colour toward the mist in (approximately) linear light,
// as the target mixes before tone mapping, so mist lightens like air rather
// than tinting like paint. Squaring stands in for the sRGB curve.
vec3 grediceMixGroundMist( vec3 color, float share ) {
    vec3 mistLinear = grediceMistColor.rgb * grediceMistColor.rgb;
    return sqrt( max( mix( color * color, mistLinear, share ), vec3( 0.0 ) ) );
}
`;

/**
 * Block for the static cache replay shader: after the cloud shadow, mix the
 * cached on-screen colour toward the mist at the pixel's world position.
 * Expects `pixel`, `cachedDepth`, `cacheDepth`, `inverseViewProjection` and
 * `cachedColor` in scope, as `StaticOpaqueSceneCache.tsx` has them.
 */
export const groundMistReplayFragment = /* glsl */ `
                ${marker} (WP4)
                if (
                    grediceMistParams.x + grediceMistParams.w > 0.0001 &&
                    cachedDepth < 0.9999999
                ) {
                    vec2 mistUv = (vec2(pixel) + vec2(0.5)) /
                        vec2(textureSize(cacheDepth, 0));
                    vec4 mistClip = inverseViewProjection * vec4(
                        mistUv * 2.0 - 1.0,
                        cachedDepth * 2.0 - 1.0,
                        1.0
                    );
                    vec3 mistWorld = mistClip.xyz / max(mistClip.w, 0.000001);
                    cachedColor = grediceMixGroundMist(
                        cachedColor,
                        grediceGroundMist(mistWorld)
                    );
                }
`;

const litMaterialGuard =
    '#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG ) || defined( TOON )';

function buildFogParsChunk() {
    return `
${marker}
${litMaterialGuard}
#ifndef GREDICE_GROUND_MIST
#define GREDICE_GROUND_MIST
${groundMistShaderFunctions}
#endif
#endif
`;
}

function buildFogChunk() {
    // The world position comes back from the view position, as in the
    // surface gradient chunk, so no varying is needed. It runs after the
    // scene fog, on the on-screen colour.
    return `
${marker}
#ifdef GREDICE_GROUND_MIST
if ( grediceMistParams.x + grediceMistParams.w > 0.0001 ) {
    vec3 grediceMistWorld = transpose( mat3( viewMatrix ) ) *
        ( -vViewPosition - viewMatrix[ 3 ].xyz );
    gl_FragColor.rgb = grediceMixGroundMist(
        gl_FragColor.rgb,
        grediceGroundMist( grediceMistWorld )
    );
}
#endif
`;
}

/** Built-in lit shaders that take the mist, by `ShaderLib` key. */
const litShaderLibKeys = ['standard', 'physical', 'lambert', 'phong', 'toon'];

/**
 * Adds the ground mist to every lit built-in material (standard, physical,
 * Lambert, Phong, toon) through the shared fog chunks, and registers its
 * shared uniforms with those shaders. It edits shared three.js shader
 * chunks, so it must run before the first material compiles. Calling it
 * again does nothing.
 */
export function installGroundMistShaderChunk() {
    if (ShaderChunk.fog_fragment.includes(marker)) return;
    ShaderChunk.fog_pars_fragment = `${ShaderChunk.fog_pars_fragment}${buildFogParsChunk()}`;
    ShaderChunk.fog_fragment = `${ShaderChunk.fog_fragment}${buildFogChunk()}`;
    const uniforms = getGroundMistUniforms();
    for (const key of litShaderLibKeys) {
        const shader: unknown = Reflect.get(ShaderLib, key);
        if (typeof shader !== 'object' || shader === null) continue;
        const target: unknown = Reflect.get(shader, 'uniforms');
        if (typeof target !== 'object' || target === null) continue;
        for (const [name, uniform] of Object.entries(uniforms)) {
            Reflect.set(target, name, uniform);
        }
    }
}

function isSolidTerrainBlockName(name: string) {
    return name.startsWith('Block_') && !isWaterBlockName(name);
}

/**
 * The garden's ground height for the mist: the most common top of the
 * terrain columns (the unbroken run of terrain blocks at the bottom of each
 * stack), so mist is measured from the block top, not world zero.
 *
 * Known gap (WP6): one level for the whole garden keeps the mist ALU only,
 * so on a raised terrain step (more than 0.42 above the main ground) the
 * mist is gone, and the walls of a sunken area take the ground's full mist.
 * The default island and the farm are flat. Measuring from the local block
 * top needs the stack top per vertex (an instanced attribute on terrain and
 * every standing thing) or a height lookup.
 */
export function resolveGroundMistLevel(
    stacks: readonly GardenStack[] | null | undefined,
    blockHeight: (name: string) => number | undefined,
) {
    const counts = new Map<number, number>();
    for (const stack of stacks ?? []) {
        let top = stack.position.y;
        let terrain = false;
        for (const [index, block] of stack.blocks.entries()) {
            if (!isSolidTerrainBlockName(block.name)) break;
            terrain = true;
            top += getEffectiveGardenStackBlockHeight({
                blockHeight: blockHeight(block.name) ?? 0,
                blockName: block.name,
                supportBlockName: stack.blocks[index - 1]?.name,
            });
        }
        if (!terrain) continue;
        const key = Math.round(top * 100) / 100;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let level = 0;
    let best = 0;
    for (const [height, count] of counts) {
        if (count > best || (count === best && height < level)) {
            best = count;
            level = height;
        }
    }
    return level;
}

/** Block heights by name from the block data, for `resolveGroundMistLevel`. */
export function createGroundMistBlockHeightLookup(
    blockData: readonly BlockData[] | null | undefined,
) {
    const heights = new Map<string, number>();
    for (const block of blockData ?? []) {
        heights.set(
            block.information.name,
            Math.max(0, block.attributes.height ?? 0),
        );
    }
    return (name: string) => heights.get(name);
}

/** Reference of the shader's per-row hash (`grediceMistRowHash`). */
export function groundMistRowHash(row: number, salt: number) {
    const value = Math.sin(row * 12.9898 + salt * 78.233) * 43758.5453;
    return value - Math.floor(value);
}

/** Reference of one row's variance in the shader, for tests. */
export function resolveGroundMistRowVariation(row: number) {
    const mix = (range: readonly [number, number], t: number) =>
        range[0] + (range[1] - range[0]) * t;
    const gap = groundMistRowHash(row, 4) >= 1 - r.rowGapShare;
    return {
        edge: r.bandEdge * mix(r.rowWidth, groundMistRowHash(row, 1)),
        shift: (groundMistRowHash(row, 6) - 0.5) * 2 * r.rowShift,
        frequency:
            r.pillFrequency * mix(r.rowFrequency, groundMistRowHash(row, 2)),
        density:
            mix(r.rowDensity, groundMistRowHash(row, 3)) *
            (gap ? r.rowGapDensity : 1),
        gap,
    };
}

/** Reference of the shader's mist share, for tests and measurements. */
export function sampleGroundMist({
    amount,
    bands,
    haze = 0,
    height,
    screenUp = -1,
}: {
    amount: number;
    /** Band and pill value, 0 to 1. */
    bands: number;
    haze?: number;
    /** Height above the ground. */
    height: number;
    /** Screen height as a share of the half view, −1 to 1. */
    screenUp?: number;
}) {
    const smooth = (edge0: number, edge1: number, value: number) => {
        const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
        return t * t * (3 - 2 * t);
    };
    let mist =
        amount *
        (r.baseDensity + r.bandDensity * bands) *
        (1 - smooth(r.fadeBottom, r.fadeTop, height));
    mist = Math.max(mist, haze * smooth(0, r.hazeTop, screenUp));
    const cap =
        r.groundCap +
        (r.standingCap - r.groundCap) *
            smooth(r.groundBandBottom, r.groundBandTop, height);
    return Math.min(cap, Math.max(0, mist));
}
