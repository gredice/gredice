import {
    AddEquation,
    CustomBlending,
    DstColorFactor,
    OneFactor,
    ZeroFactor,
} from 'three';

/**
 * Contact shadows multiply the colour already on screen. A fully covered spot
 * keeps this much of each display channel: warm sunlight drops out more than
 * the cool sky fill, so shadows read blue-tinted and never black (GAME_ART.md).
 */
export const contactShadowTint = [0.48, 0.55, 0.76] as const;

/**
 * Overall strength of static blobs. Tiers with shadow maps already draw the
 * sun's cast shadow, so the blob only adds a soft contact line there.
 */
export const staticContactShadowStrength = {
    withShadowMaps: 0.5,
    withoutShadowMaps: 1,
} as const;

/** Lifts every blob just above the surface it lies on. */
export const contactShadowSurfaceLift = 0.006;

/**
 * Where a blob is cut at a terrain edge, it fades out over this distance
 * before the cut: a share of its spread, so a wide crown pool ends in a long,
 * soft falloff instead of a ruled line along the island rim, while a small
 * prop's blob keeps its shape.
 */
export const staticContactShadowEdgeFade = {
    max: 0.16,
    min: 0.05,
    perSpread: 0.5,
} as const;

/** The edge fade length for a blob with this spread; the shader repeats it. */
export function resolveStaticContactShadowEdgeFade(spread: number) {
    const { max, min, perSpread } = staticContactShadowEdgeFade;
    return Math.min(max, Math.max(min, spread * perSpread));
}

/**
 * How high a snow overlay can rise, as a multiple of its `maxThickness`. Its
 * noise adds up to 35% (`noiseAmplitude` in `EntityInstancesBlock`), so by
 * default a blob rises to the highest drift, not the average, and is never
 * buried in a bump. Surfaces whose drifts are known to stay lower set their
 * own crest (`getContactShadowReceiverSnow`).
 */
export const contactShadowSnowCrest = 1.35;

/**
 * A blob raised above snow also covers the bottom of whatever stands in that
 * snow, where the object is behind the blob from the camera. The blob fades as
 * it rises so that band stays light: full strength up to `start` above the
 * surface, `minScale` of it from `end`.
 */
export const contactShadowSnowFade = {
    end: 0.3,
    minScale: 0.55,
    start: 0.04,
} as const;

/**
 * The lawn-to-path grass bank (`terrainVergeDimensions`) rises 0.03 above the
 * floor and reaches about 0.1 into the lawn and up to 0.2 over the path, and
 * from the camera it covers about 0.05 more of the floor behind it. Blob
 * fragments within this distance of a bank are pulled toward the camera by
 * `contactShadowVergeDepthBias` units, so the bank no longer hides them. At
 * the game camera's 35° elevation that clears surfaces up to about 0.04 above
 * the blob, which covers the bank top and nothing taller.
 */
export const contactShadowVergeReach = 0.25;
export const contactShadowVergeDepthBias = 0.06;

/** Blending for `out = destination * shaderColour`, keeping destination alpha. */
export const contactShadowMultiplyBlending = {
    blendDst: ZeroFactor,
    blendDstAlpha: OneFactor,
    blendEquation: AddEquation,
    blendEquationAlpha: AddEquation,
    blendSrc: DstColorFactor,
    blendSrcAlpha: ZeroFactor,
    blending: CustomBlending,
} as const;

function clampUnit(value: number) {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/**
 * The snow coverage blobs rise with: the scene's coverage once snow overlays
 * draw at this quality tier, and none before, when the ground is bare.
 */
export function resolveContactShadowSnowCoverage(
    snowCoverage: number,
    snowOverlayMinCoverage: number,
) {
    const coverage = clampUnit(snowCoverage);
    return coverage > 0 && coverage >= snowOverlayMinCoverage ? coverage : 0;
}

/**
 * Height above a surface where a blob lies: just above the surface, or above
 * the highest drift of the snow that covers it. The vertex shader in
 * `StaticContactShadows.tsx` repeats this per instance.
 */
export function resolveContactShadowLift(
    snowCoverage: number,
    snow: {
        coverageMultiplier: number;
        /** Highest drift as a multiple of `maxThickness`. */
        crest: number;
        lift: number;
        maxThickness: number;
    },
) {
    const coverage = clampUnit(snowCoverage);
    if (coverage <= 0 || snow.maxThickness <= 0) {
        return contactShadowSurfaceLift;
    }
    const amount = clampUnit(coverage * snow.coverageMultiplier);
    return (
        contactShadowSurfaceLift +
        snow.lift +
        amount * snow.maxThickness * snow.crest
    );
}

/**
 * How much of its strength a blob keeps when it lies `snowHeight` above its
 * surface because of snow (`contactShadowSnowFade`). The vertex shader in
 * `StaticContactShadows.tsx` repeats this per instance.
 */
export function resolveContactShadowSnowStrength(snowHeight: number) {
    const { end, minScale, start } = contactShadowSnowFade;
    const t = clampUnit((snowHeight - start) / (end - start));
    const eased = t * t * (3 - 2 * t);
    return 1 - (1 - minScale) * eased;
}
