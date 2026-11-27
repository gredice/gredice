import * as THREE from 'three';
import { plantInstanceBreathSpeedJitterGlsl } from '../../../scene/idleBreathing';
import { cropLeafPalette } from './cropPalette';
import { PLANT_FOLIAGE_UP_BEND } from './plantPartRendering';
import { SeededRNG } from './rng';

export const LEGACY_MID_BILLBOARD_CIRCLE_TRIANGLE_COUNT = 18;
export const MID_BILLBOARD_CARD_TRIANGLE_COUNT = 2;
/**
 * The mid view draws the same single leafy clump as the far view, so the
 * silhouette does not jump between the two levels. Produce and flowers add
 * accent dots; a plant without leaves shows its stem instead of a clump.
 */
export const MID_BILLBOARD_CANOPY_CARD_COUNT = 1;
/** Accent dots on a tall plant that carries fruit or flowers up high. */
export const MID_BILLBOARD_RAISED_ACCENT_COUNT = 3;
export const MID_BILLBOARD_SHADER_VARIANT_COUNT = 2;
export const PLANT_BILLBOARD_PLANE_TRIANGLE_COUNT = 2;

interface PlantBillboardShapeSummary {
    accentCenterY?: number;
    accentColor?: string;
    canopyWidth?: number;
    hasFoliage: boolean;
    height?: number;
}

/**
 * Number of accent dots the mid view draws for one plant: three spread over
 * a tall plant whose produce or flowers sit up in the foliage, one for a
 * root shoulder or a head at the soil.
 */
export function getMidBillboardAccentCount({
    accentCenterY,
    accentColor,
    height,
}: PlantBillboardShapeSummary) {
    if (!accentColor) {
        return 0;
    }
    if (
        height === undefined ||
        accentCenterY === undefined ||
        height < 0.5 ||
        accentCenterY < height * 0.35
    ) {
        return 1;
    }
    return MID_BILLBOARD_RAISED_ACCENT_COUNT;
}

export function getPlantBillboardPrimitiveTriangleCount(
    level: 'far' | 'mid',
    summaries: readonly PlantBillboardShapeSummary[],
) {
    if (level === 'far') {
        return summaries.length * PLANT_BILLBOARD_PLANE_TRIANGLE_COUNT;
    }

    return summaries.reduce(
        (total, summary) =>
            total +
            (summary.hasFoliage
                ? MID_BILLBOARD_CARD_TRIANGLE_COUNT *
                  MID_BILLBOARD_CANOPY_CARD_COUNT
                : PLANT_BILLBOARD_PLANE_TRIANGLE_COUNT) +
            MID_BILLBOARD_CARD_TRIANGLE_COUNT *
                getMidBillboardAccentCount(summary),
        0,
    );
}

/**
 * Coverage from which a card pixel counts as solid. The opaque pass draws
 * and depth-writes pixels at or above it; the blended pass draws the fringe
 * below it.
 */
export const PLANT_BILLBOARD_SOLID_COVERAGE = 0.995;

/**
 * Each card mesh draws in two passes over the same triangles: material 0 is
 * the opaque inside, material 1 the blended edge.
 */
export const PLANT_BILLBOARD_DRAW_PASS_COUNT = 2;

/**
 * A two-triangle carrier for the analytic card silhouettes. The legacy mid
 * canopy used an 18-segment circle for every lobe and accent. It carries one
 * draw group per pass, so a mesh with the two pass materials draws both; a
 * mesh with a single material ignores the groups.
 */
export const midBillboardCardGeometry = (() => {
    const geometry = new THREE.PlaneGeometry(2, 2);
    const indexCount = geometry.index?.count ?? 6;
    for (let pass = 0; pass < PLANT_BILLBOARD_DRAW_PASS_COUNT; pass += 1) {
        geometry.addGroup(0, indexCount, pass);
    }
    return geometry;
})();

/** A card on `midBillboardCardGeometry`, placed relative to the plant base. */
export interface PlantBillboardCard {
    centerX: number;
    centerY: number;
    halfHeight: number;
    halfWidth: number;
}

/**
 * The leafy clump that stands for a plant in the far and mid views. It sits
 * on the soil, is never a thin sliver, and covers about as much as the 3D
 * plant's foliage does on screen, so switching to the detailed plant does not
 * jump. The 3D canopy width runs to the tips of the outermost leaves, so the
 * solid clump stays a little narrower than it.
 *
 * The garden camera looks down at about 35 degrees, so a low, wide rosette
 * such as lettuce shows its top as well as its side and looks nearly as tall
 * as it is wide. Its clump keeps that round footprint instead of a flat pad.
 */
export function getPlantBillboardClump({
    canopyWidth,
    height,
}: {
    canopyWidth: number;
    height: number;
}): PlantBillboardCard {
    const footprintHeight = Math.min(
        Math.max(canopyWidth * 0.8, 0.16) * 0.85,
        (height * 0.82 + canopyWidth * 0.58) * 0.8,
    );
    const clumpHeight = Math.max(height * 0.88, footprintHeight, 0.2);
    const clumpWidth = Math.max(canopyWidth * 0.8, clumpHeight * 0.7, 0.16);
    return {
        centerX: 0,
        centerY: clumpHeight * 0.5 - 0.02,
        halfHeight: clumpHeight / 2,
        halfWidth: clumpWidth / 2,
    };
}

interface PlantBillboardAccentSummary {
    accentCenterY: number;
    accentColor?: string;
    accentRadius?: number;
    canopyWidth: number;
    hasFoliage: boolean;
    height: number;
}

/**
 * The three dots of a tall plant around their shared centre, in clump widths,
 * before the per-plant jitter and mirror: a large dot high on one side, a
 * middle one across from it and a small one low. Each hangs at its own
 * height, so they read as fruit along the stems, never as a row of two dots
 * over a third (which looks like a face).
 */
export const PLANT_BILLBOARD_ACCENT_DOTS = [
    { scale: 1, x: 0.2, y: 0.14 },
    { scale: 0.82, x: -0.18, y: -0.02 },
    { scale: 0.68, x: 0.08, y: -0.2 },
] as const;

/** Largest per-plant shift of a dot from its place, in clump widths. */
export const PLANT_BILLBOARD_ACCENT_JITTER = { x: 0.07, y: 0.035 } as const;

/** Largest dot radius the far clump can encode, in clump widths. */
export const PLANT_BILLBOARD_ACCENT_RADIUS_LIMIT = 0.4;

/**
 * Share of a produce organ's transform radius that its mesh fills; the
 * lathe-turned fruit meshes are about half a unit across their widest point.
 */
const PRODUCE_MESH_RADIUS_FRACTION = 0.55;

/**
 * Radius of the largest produce or flower dot, in plant units. It follows
 * the size of the produce the 3D plant shows (`accentRadius`), so a young
 * root or a small unripe fruit gets a small dot, but it never grows past the
 * fixed size the cards used before, and never shrinks below a readable dot.
 */
export function getPlantBillboardAccentRadius(
    summary: Pick<PlantBillboardAccentSummary, 'accentRadius' | 'canopyWidth'>,
    count: number,
) {
    const fixed =
        count === 1
            ? Math.max(summary.canopyWidth * 0.1, 0.07)
            : Math.max(summary.canopyWidth * 0.075, 0.055);
    if (summary.accentRadius === undefined) {
        return fixed;
    }
    const minimum = Math.min(
        fixed,
        Math.max(summary.canopyWidth * 0.05, 0.035),
    );
    return THREE.MathUtils.clamp(
        summary.accentRadius * PRODUCE_MESH_RADIUS_FRACTION,
        minimum,
        fixed,
    );
}

export interface PlantBillboardAccentDot {
    /** Radius in clump widths. */
    radius: number;
    /** Centre across the clump card, 0 at its left edge and 1 at its right. */
    u: number;
    /** Centre up the clump card, 0 at its base and 1 at its top. */
    v: number;
}

function fract(value: number) {
    return value - Math.floor(value);
}

/**
 * Share of a dot card's radius the round dot fills; the rest leaves room for
 * its soft edge. The far clump paints its dots at the same share.
 */
export const PLANT_BILLBOARD_DOT_FILL = 0.9;

/**
 * Where the produce or flower dots of one plant sit in its clump card: one
 * at the shared centre, or three laid out from `PLANT_BILLBOARD_ACCENT_DOTS`,
 * shifted and mirrored by the plant's seed so a bed of tomatoes does not
 * repeat one pattern. Every dot stays inside the card. The far clump paints
 * the same dots in its fragment shader (`plantClumpAccentDots`) and the mid
 * view places its dot cards here, so the dots do not move between the two.
 *
 * `aspect` is the clump card's width over its height. `seed` runs from 0 to
 * 2π: batched cards use the plant's sway phase (`getMidBillboardSwayPhase`),
 * which the far clump receives as `instanceSwayPhase`; a standalone card
 * passes `getPlantBillboardAccentSeed`.
 */
export function getPlantBillboardAccentDots(
    accent: { centerV: number; count: number; radius: number },
    aspect: number,
    seed: number,
): PlantBillboardAccentDot[] {
    if (accent.count <= 0) {
        return [];
    }
    if (accent.count < 2) {
        return [
            {
                radius: accent.radius,
                u: 0.5,
                v: Math.max(accent.centerV, accent.radius * aspect),
            },
        ];
    }
    const mirror = fract(seed * 0.618034) > 0.5 ? -1 : 1;
    return PLANT_BILLBOARD_ACCENT_DOTS.map((dot, index) => {
        const radius = accent.radius * dot.scale;
        const jitterX = Math.sin(seed * (1.3 + index * 0.9) + index * 2.1);
        const jitterY = Math.sin(seed * (2.3 + index * 0.7) + index * 1.3 + 1);
        const u =
            0.5 + (dot.x + jitterX * PLANT_BILLBOARD_ACCENT_JITTER.x) * mirror;
        const v =
            accent.centerV +
            (dot.y + jitterY * PLANT_BILLBOARD_ACCENT_JITTER.y) * aspect;
        return {
            radius,
            u: THREE.MathUtils.clamp(u, radius, 1 - radius),
            v: THREE.MathUtils.clamp(v, radius * aspect, 1 - radius * aspect),
        };
    });
}

/**
 * Packs the produce or flower dots of a far clump into one float for the
 * `instanceAccent` attribute's alpha (or the `uAccent` uniform): the whole
 * part is the number of dots (0, 1 or 3); the fraction holds the height of
 * their centre in the clump card (0 at its base, 1 at its top) and the
 * radius of the largest dot in clump widths, six bits each.
 */
export function packPlantBillboardClumpAccent({
    centerV,
    count,
    radius,
}: {
    centerV: number;
    count: number;
    radius: number;
}) {
    if (count <= 0) {
        return 0;
    }
    const centerStep = Math.round(THREE.MathUtils.clamp(centerV, 0, 1) * 63);
    const radiusStep = Math.round(
        THREE.MathUtils.clamp(
            radius / PLANT_BILLBOARD_ACCENT_RADIUS_LIMIT,
            0,
            1,
        ) * 63,
    );
    return count + (centerStep + radiusStep * 64) / 4096;
}

export function unpackPlantBillboardClumpAccent(value: number) {
    const count = Math.floor(value);
    const steps = Math.round((value - count) * 4096);
    return {
        centerV: (steps % 64) / 63,
        count,
        radius:
            (Math.floor(steps / 64) / 63) * PLANT_BILLBOARD_ACCENT_RADIUS_LIMIT,
    };
}

/**
 * Height of the dots' shared centre. Three dots stay low enough that the
 * highest one sits inside the clump's crown, not on its rim.
 */
function getPlantBillboardAccentAnchorY(
    summary: PlantBillboardAccentSummary,
    clump: PlantBillboardCard,
    count: number,
    radius: number,
) {
    const highestDot =
        PLANT_BILLBOARD_ACCENT_DOTS[0].y + PLANT_BILLBOARD_ACCENT_JITTER.y;
    return count === 1
        ? summary.accentCenterY
        : Math.min(
              summary.accentCenterY,
              clump.centerY +
                  clump.halfHeight -
                  radius * 1.2 -
                  highestDot * clump.halfWidth * 2,
          );
}

/**
 * Produce or flowers painted into the far clump (see
 * `packPlantBillboardClumpAccent`). The far view has no accent cards, so
 * this keeps a ripe tomato red and a carrot orange at every zoom for no
 * extra triangles, in the same place and size as the mid view's dots.
 */
export function getPlantBillboardClumpAccent(
    summary: PlantBillboardAccentSummary,
) {
    const count = getMidBillboardAccentCount(summary);
    if (count === 0) {
        return 0;
    }

    const clump = getPlantBillboardClump(summary);
    const bottom = clump.centerY - clump.halfHeight;
    const radius = getPlantBillboardAccentRadius(summary, count);
    const anchorY = getPlantBillboardAccentAnchorY(
        summary,
        clump,
        count,
        radius,
    );
    return packPlantBillboardClumpAccent({
        centerV: (anchorY - bottom) / (clump.halfHeight * 2),
        count,
        radius: radius / (clump.halfWidth * 2),
    });
}

/**
 * Accent dots for produce or flowers on a mid plant: one at the soil for a
 * root or a head, three among the fruit on a tall plant. They decode the
 * same packed value the far clump paints (`getPlantBillboardClumpAccent`)
 * and lay it out with the same seed (`getPlantBillboardAccentDots`), so the
 * dots keep their place and size when the view changes between far and mid.
 */
export function getMidBillboardAccentCards(
    summary: PlantBillboardAccentSummary,
    seed: number,
): PlantBillboardCard[] {
    const packed = getPlantBillboardClumpAccent(summary);
    if (packed === 0) {
        return [];
    }
    const clump = getPlantBillboardClump(summary);
    const bottom = clump.centerY - clump.halfHeight;
    const clumpWidth = clump.halfWidth * 2;
    const clumpHeight = clump.halfHeight * 2;
    return getPlantBillboardAccentDots(
        unpackPlantBillboardClumpAccent(packed),
        clumpWidth / clumpHeight,
        seed,
    ).map((dot) => ({
        centerX: (dot.u - 0.5) * clumpWidth,
        centerY: bottom + dot.v * clumpHeight,
        halfHeight: dot.radius * clumpWidth,
        halfWidth: dot.radius * clumpWidth,
    }));
}

export function getMidBillboardSwayPhase(
    position: readonly [number, number, number],
) {
    const phaseHash =
        Math.sin(
            position[0] * 12.9898 + position[1] * 37.719 + position[2] * 78.233,
        ) * 43_758.5453;
    return (phaseHash - Math.floor(phaseHash)) * Math.PI * 2;
}

export const midBillboardVertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uSwayAmplitude;
    uniform float uSwaySpeed;
    uniform float uSwayPhase;
    uniform float uWindStrength;
    uniform vec2 uWindDirection;
    uniform float uBreathAmplitude;
    uniform float uBreathSpeed;
    uniform float uBreathPhase;
    uniform float uDepthBias;
    uniform float uOpacity;
    uniform vec3 uTint;
    uniform vec4 uAccent;
    uniform float uAccentSeed;

    #ifdef USE_INSTANCING
        attribute vec3 instanceTint;
        attribute float instanceOpacity;
        attribute float instanceSwayPhase;
        attribute vec4 instanceAccent;
    #endif

    varying float vMidBillboardOpacity;
    varying vec2 vMidBillboardUv;
    varying vec3 vMidBillboardTint;
    varying vec4 vMidBillboardAccent;
    varying float vMidBillboardAspect;
    varying float vMidBillboardSeed;

    void main() {
        vec4 billboardCenter = vec4(0.0, 0.0, 0.0, 1.0);
        float swayPhase = uSwayPhase;
        float breathPhase = uBreathPhase;
        vMidBillboardOpacity = uOpacity;
        vMidBillboardTint = uTint;
        vMidBillboardAccent = uAccent;
        vMidBillboardSeed = uAccentSeed;
        mat3 cardBasis = mat3(modelMatrix);

        #ifdef USE_INSTANCING
            billboardCenter = instanceMatrix * billboardCenter;
            swayPhase += instanceSwayPhase;
            breathPhase += instanceSwayPhase;
            vMidBillboardOpacity = instanceOpacity;
            vMidBillboardTint = instanceTint;
            vMidBillboardAccent = instanceAccent;
            vMidBillboardSeed = instanceSwayPhase;
            cardBasis = cardBasis * mat3(instanceMatrix);
        #endif

        // Width over height of the card in the world, so painted dots stay
        // round on a stretched card.
        vMidBillboardAspect = length(cardBasis[0]) / max(length(cardBasis[1]), 0.0001);

        // Idle breathing: every card of one plant swells together.
        float breathSpeed = uBreathSpeed;
        #ifdef USE_INSTANCING
            breathSpeed *= ${plantInstanceBreathSpeedJitterGlsl};
        #endif
        float breathScale = 1.0 + uBreathAmplitude * sin(
            uTime * breathSpeed + breathPhase
        );

        vec3 worldCenter = (modelMatrix * billboardCenter).xyz;
        float heightFactor = smoothstep(0.0, 1.5, max(worldCenter.y, 0.0));
        float primaryWave = sin(
            uTime * uSwaySpeed +
            swayPhase +
            worldCenter.y * 2.15
        );
        float secondaryWave = cos(
            uTime * (uSwaySpeed * 1.31) +
            swayPhase * 1.7 +
            worldCenter.x * 1.35 +
            worldCenter.z * 0.85
        );
        vec2 windDirection = length(uWindDirection) > 0.0
            ? normalize(uWindDirection)
            : vec2(1.0, 0.0);
        float windBias = sin(
            dot(worldCenter.xz, windDirection) * 0.85 +
            uTime * (uSwaySpeed * 0.72) +
            swayPhase * 0.4
        );
        float amplitude = uSwayAmplitude * (1.0 + uWindStrength * 0.75);
        float sway = (
            primaryWave +
            secondaryWave * 0.45 +
            windBias * uWindStrength * 0.9
        ) * amplitude * heightFactor;
        vec2 directionalSway = windDirection * sway;
        // Accents sit in front of the clump and stems behind it from every
        // camera angle, so the offset is along the view direction.
        vec3 towardCamera = transpose(mat3(viewMatrix)) * vec3(0.0, 0.0, 1.0);
        vec3 worldSway = vec3(
            directionalSway.x + secondaryWave * amplitude * 0.2 * heightFactor,
            0.0,
            directionalSway.y + primaryWave * amplitude * 0.22 * heightFactor
        ) + towardCamera * uDepthBias;

        mat3 inverseModelBasis = inverse(mat3(modelMatrix));

        #ifdef USE_INSTANCING
            vec3 viewOffset = (
                instanceMatrix * vec4(position * breathScale, 0.0)
            ).xyz;
            vec3 worldOffset =
                transpose(mat3(viewMatrix)) * viewOffset;
            csm_Position =
                inverse(mat3(instanceMatrix)) *
                inverseModelBasis *
                (worldOffset + worldSway);
        #else
            csm_Position =
                position * breathScale + inverseModelBasis * worldSway;
        #endif

        vMidBillboardUv = uv;
    }
`;

/** Card silhouettes, selected per mesh with the `uShape` uniform. */
export const PLANT_BILLBOARD_SHAPE = {
    /** A round dot: produce or flowers on a mid plant. */
    dot: 0,
    /** A leafy clump on a flat base: one card per far or mid plant. */
    clump: 1,
    /** A rounded rod: a mid plant without leaves. */
    stem: 2,
} as const;

export type PlantBillboardShape =
    (typeof PLANT_BILLBOARD_SHAPE)[keyof typeof PLANT_BILLBOARD_SHAPE];

/**
 * How far the clump leans toward the crop leaf highlight at its base and at
 * its top. The 3D leaves do the same by height
 * (`buildDevelopmentalPlantRenderData`), so the clump reads as one lit mass
 * with a lighter cap at every zoom.
 */
export const PLANT_BILLBOARD_CAP_LIFT = { base: 0.08, top: 0.34 } as const;

/**
 * One program for every plant card, lit by the scene like the 3D leaves so
 * the colour does not jump when the level of detail changes, at any time of
 * day.
 */
export const midBillboardFragmentShader = /* glsl */ `
    uniform float uShape;
    uniform float uCapStrength;
    uniform vec3 uFoliageHighlight;

    varying float vMidBillboardOpacity;
    varying vec2 vMidBillboardUv;
    varying vec3 vMidBillboardTint;
    varying vec4 vMidBillboardAccent;
    varying float vMidBillboardAspect;
    varying float vMidBillboardSeed;

    float plantClumpLobe(vec2 point, vec2 center, vec2 radius) {
        return (length((point - center) / radius) - 1.0) * min(radius.x, radius.y);
    }

    // Signed distance, in uv, to a leafy bush on a flat base: a round body
    // under a crown of three leaf lobes.
    float plantClumpDistance(vec2 point) {
        float distance = plantClumpLobe(point, vec2(0.5, 0.36), vec2(0.46, 0.33));
        distance = min(distance, plantClumpLobe(point, vec2(0.27, 0.6), vec2(0.23, 0.25)));
        distance = min(distance, plantClumpLobe(point, vec2(0.73, 0.6), vec2(0.23, 0.25)));
        distance = min(distance, plantClumpLobe(point, vec2(0.5, 0.73), vec2(0.25, 0.24)));
        return max(distance, 0.03 - point.y);
    }

    // One dot of a tall plant's layout, as getPlantBillboardAccentDots
    // computes it: returns its centre in card uv and its radius in clump
    // widths.
    vec3 plantClumpAccentDot(
        vec2 base,
        float scale,
        float index,
        float seed,
        float mirror,
        float radius,
        float centerV,
        float aspect
    ) {
        float dotRadius = radius * scale;
        float jitterX = sin(seed * (1.3 + index * 0.9) + index * 2.1);
        float jitterY = sin(seed * (2.3 + index * 0.7) + index * 1.3 + 1.0);
        float u = 0.5 + (base.x + jitterX * ${PLANT_BILLBOARD_ACCENT_JITTER.x.toFixed(3)}) * mirror;
        float v = centerV + (base.y + jitterY * ${PLANT_BILLBOARD_ACCENT_JITTER.y.toFixed(3)}) * aspect;
        return vec3(
            clamp(u, dotRadius, 1.0 - dotRadius),
            clamp(v, dotRadius * aspect, 1.0 - dotRadius * aspect),
            dotRadius
        );
    }

    // Signed distance, in clump widths, from point to the edge of one dot,
    // which fills PLANT_BILLBOARD_DOT_FILL of its radius like a mid dot
    // card. Keeps the nearest dot in nearest (offset from its centre, in dot
    // radii) and nearestEdge.
    void plantClumpAccentNearest(
        vec2 point,
        vec3 dot,
        float aspect,
        inout vec2 nearest,
        inout float nearestEdge
    ) {
        vec2 offset = (point - dot.xy) * vec2(1.0, 1.0 / aspect);
        float edge = length(offset) - dot.z * ${PLANT_BILLBOARD_DOT_FILL.toFixed(3)};
        if (edge < nearestEdge) {
            nearest = offset / dot.z;
            nearestEdge = edge;
        }
    }

    // Distance, in clump widths, to the produce dots painted into a far
    // clump. The accent alpha is packed by packPlantBillboardClumpAccent:
    // whole part = dot count, fraction = centre height and largest dot
    // radius, six bits each (unpackPlantBillboardClumpAccent decodes the
    // same). The layout follows getPlantBillboardAccentDots with the plant's
    // seed. offset returns the point relative to the nearest dot, in dot
    // radii.
    float plantClumpAccentDistance(vec2 point, out vec2 offset) {
        float count = floor(vMidBillboardAccent.a);
        float steps = floor(fract(vMidBillboardAccent.a) * 4096.0 + 0.5);
        float centerV = mod(steps, 64.0) / 63.0;
        float radius = max(
            floor(steps / 64.0) / 63.0 * ${PLANT_BILLBOARD_ACCENT_RADIUS_LIMIT.toFixed(3)},
            0.001
        );
        float aspect = max(vMidBillboardAspect, 0.0001);
        vec2 nearest = vec2(0.0);
        float nearestEdge = 1e4;
        if (count > 1.5) {
            float seed = vMidBillboardSeed;
            float mirror = fract(seed * 0.618034) > 0.5 ? -1.0 : 1.0;
            ${PLANT_BILLBOARD_ACCENT_DOTS.map(
                (dot, index) =>
                    `plantClumpAccentNearest(point, plantClumpAccentDot(vec2(${dot.x.toFixed(3)}, ${dot.y.toFixed(3)}), ${dot.scale.toFixed(3)}, ${index.toFixed(1)}, seed, mirror, radius, centerV, aspect), aspect, nearest, nearestEdge);`,
            ).join('\n            ')}
        } else {
            plantClumpAccentNearest(
                point,
                vec3(0.5, max(centerV, radius * aspect), radius),
                aspect,
                nearest,
                nearestEdge
            );
        }
        offset = nearest;
        return nearestEdge;
    }

    void main() {
        vec2 cardPoint = vMidBillboardUv * 2.0 - 1.0;
        float signedEdge;
        vec2 normalOffset;
        vec3 color = vMidBillboardTint;

        if (uShape > 1.5) {
            // Stem: full height, rounded sides only.
            signedEdge = 1.0 - abs(cardPoint.x);
            normalOffset = vec2(cardPoint.x * 0.7, 0.0);
        } else if (uShape > 0.5) {
            signedEdge = -plantClumpDistance(vMidBillboardUv);
            normalOffset = (vMidBillboardUv - vec2(0.5, 0.4)) * vec2(0.9, 0.7);
            float capLift = mix(
                ${PLANT_BILLBOARD_CAP_LIFT.base.toFixed(2)},
                ${PLANT_BILLBOARD_CAP_LIFT.top.toFixed(2)},
                smoothstep(0.25, 0.85, vMidBillboardUv.y)
            );
            color = mix(color, uFoliageHighlight, capLift * uCapStrength);
        } else {
            signedEdge = ${PLANT_BILLBOARD_DOT_FILL.toFixed(3)} - length(cardPoint);
            normalOffset = cardPoint * 0.45;
        }

        // Solid inside the outline, fading out over about a pixel outside it.
        float edgeWidth = max(fwidth(signedEdge), 0.002);
        float coverage = smoothstep(-edgeWidth, 0.0, signedEdge);
        float accent = 0.0;

        if (uShape > 0.5 && uShape < 1.5 && vMidBillboardAccent.a >= 1.0) {
            vec2 accentOffset;
            float accentEdge = -plantClumpAccentDistance(vMidBillboardUv, accentOffset);
            float accentWidth = max(fwidth(accentEdge), 0.002);
            accent = smoothstep(-accentWidth, accentWidth, accentEdge);
            color = mix(color, vMidBillboardAccent.rgb, accent);
            normalOffset = mix(normalOffset, accentOffset * 0.45, accent);
            coverage = max(coverage, smoothstep(-accentWidth, 0.0, accentEdge));
        }

        // Every card draws twice (see plantCardPassMaterialProps): an opaque
        // pass that writes depth for the solid inside, so overlapping plants
        // sort per pixel, and a blended pass for the soft fringe outside it,
        // which lands on whatever is already behind. Neither pass writes
        // depth where the card is partly transparent, so no soil-coloured
        // halo shows where one plant's card crosses another's.
        #ifdef OPAQUE
            if (coverage < ${PLANT_BILLBOARD_SOLID_COVERAGE.toFixed(3)}) {
                discard;
            }
        #else
            if (
                coverage <= 0.01 ||
                coverage >= ${PLANT_BILLBOARD_SOLID_COVERAGE.toFixed(3)}
            ) {
                discard;
            }
        #endif

        float normalDepth = sqrt(
            max(1.0 - dot(normalOffset, normalOffset), 0.0)
        );
        csm_FragNormal = normalize(
            vec3(normalOffset, max(normalDepth, 0.35))
        );
        if (uShape > 0.5 && uShape < 1.5) {
            // The leafy clump is lit like the 3D leaves, with its normal
            // bent toward world up (plantLeafMaterial.ts); produce dots keep
            // their own round shading.
            csm_FragNormal = normalize(
                csm_FragNormal +
                normalize(viewMatrix[1].xyz) *
                    (${PLANT_FOLIAGE_UP_BEND.toFixed(3)} * (1.0 - accent))
            );
        }
        csm_DiffuseColor = vec4(color, vMidBillboardOpacity * coverage);
    }
`;

const plantBillboardFoliageHighlight = new THREE.Color(
    cropLeafPalette.highlight,
);

/** View-space offsets, in world units, that keep accents in front. */
export const PLANT_BILLBOARD_DEPTH_BIAS: Record<PlantBillboardShape, number> = {
    [PLANT_BILLBOARD_SHAPE.clump]: 0,
    [PLANT_BILLBOARD_SHAPE.dot]: 0.06,
    [PLANT_BILLBOARD_SHAPE.stem]: -0.04,
};

/** Dot layout seed of a standalone plant card, from 0 to 2π. */
export function getPlantBillboardAccentSeed(seed: string) {
    return new SeededRNG(`${seed}:accent-layout`).nextRange(0, Math.PI * 2);
}

/**
 * Material uniforms every plant card needs besides the sway set. `accent`
 * paints produce dots into a standalone far clump, as `instanceAccent` and
 * `instanceSwayPhase` do for batched cards: an albedo, the packed value from
 * `getPlantBillboardClumpAccent` and the layout seed.
 */
export function createPlantBillboardShapeUniforms(
    shape: PlantBillboardShape,
    capStrength = shape === PLANT_BILLBOARD_SHAPE.clump ? 1 : 0,
    accent?: { color: string; seed: number; value: number },
) {
    const accentColor = new THREE.Color(accent?.color ?? '#ffffff');
    return {
        uAccent: {
            value: new THREE.Vector4(
                accentColor.r,
                accentColor.g,
                accentColor.b,
                accent?.value ?? 0,
            ),
        },
        uAccentSeed: { value: accent?.seed ?? 0 },
        uCapStrength: { value: capStrength },
        uDepthBias: { value: PLANT_BILLBOARD_DEPTH_BIAS[shape] },
        uFoliageHighlight: { value: plantBillboardFoliageHighlight },
        uShape: { value: shape },
    };
}
