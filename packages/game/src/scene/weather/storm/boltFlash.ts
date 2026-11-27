import { weatherRoleSets } from '../weatherRoles';
import { lightningMotion } from './lightningSchedule';

/**
 * The flash budget of one strike (GAME_ART.md "Weather > Storm and
 * lightning > Safety", WCAG 2.3.1): the area whose relative luminance
 * changes by 0.1 or more stays under 21,800 px inside one 341 × 256 px
 * window, and under 2% of the frame. The bolt and its glow are sized in
 * pixels, so the budget holds at every zoom; on a small view both shrink
 * until they fit.
 */
export const lightningFlashLimits = {
    /** WCAG 2.3.1: a quarter of a 10° field at 1024 × 768 (341 × 256). */
    windowWidthPx: 341,
    windowHeightPx: 256,
    maxAreaPx: 21_800,
    maxFrameShare: 0.02,
    /** A change of relative luminance below this is not a flash. */
    luminanceStep: 0.1,
    /** Keep this share of the budget as headroom for rounding and blur. */
    headroom: 0.9,
    /** The bolt may take at most this share of the budget; the glow the rest. */
    boltShare: 0.6,
} as const;

/**
 * The glow on the deck around the bolt's root reaches out 0.3 of the width
 * of the stretch of deck it hangs from (300 px, so 90 px), but never more
 * than this many pixels (GAME_ART: about 60 px), and less where the flash
 * budget of a small view needs it (`resolveBoltSizing`): about 59 px on a
 * 1280 × 800 view, about 33 px on a 390 × 844 phone.
 */
export const boltGlowMaxRadiusPx = 64;

/** Glow radius in pixels for a cloud of the given width, before the budget. */
export function resolveBoltGlowRadiusPx(cloudWidthPx: number) {
    return Math.min(0.3 * Math.max(0, cloudWidthPx), boltGlowMaxRadiusPx);
}

function srgbToLinear(channel: number) {
    return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of an sRGB hex colour. */
export function relativeLuminance(hex: string) {
    const value = Number.parseInt(hex.slice(1), 16);
    const r = srgbToLinear(((value >> 16) & 255) / 255);
    const g = srgbToLinear(((value >> 8) & 255) / 255);
    const b = srgbToLinear((value & 255) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

let glowMaxStep: number | null = null;

/**
 * The luminance step of a full (100%) mix toward the glow, on the darkest
 * cloud tone of any weather and time, toward the dimmest glow role. Linear
 * in the mix: the band shader mixes sRGB values, which changes luminance a
 * little less than a linear-light mix, so this bound is on the safe side.
 */
export function resolveBoltGlowMaxLuminanceStep() {
    if (glowMaxStep !== null) return glowMaxStep;
    let darkestCloud = 1;
    let dimmestGlow = 1;
    for (const set of Object.values(weatherRoleSets)) {
        for (const tone of [
            set.cloudFair,
            set.cloudOvercast,
            set.cloudRain,
            set.cloudStorm,
            set.cloudSnow,
        ]) {
            for (const hex of tone) {
                darkestCloud = Math.min(darkestCloud, relativeLuminance(hex));
            }
        }
        dimmestGlow = Math.min(dimmestGlow, relativeLuminance(set.boltGlow));
    }
    glowMaxStep = dimmestGlow - darkestCloud;
    return glowMaxStep;
}

/**
 * The glow amount the storm layer writes for an envelope's glow: never past
 * the 40% the band shader allows, so the glow falls off from the root as a
 * soft Gaussian (`peak × exp(−(d / radius)²)`) with no flat disc in the
 * middle, while it still holds its peak for the first 0.2 s of a strike.
 */
export function resolveBoltGlowAmount(envelopeGlow: number) {
    return Math.min(lightningMotion.glowMax, Math.max(0, envelopeGlow));
}

/**
 * How far out, as a share of the glow radius, the glow can still change
 * luminance by 0.1: the band shader mixes `amount × exp(−(d / radius)²)`
 * toward the glow role (`resolveBoltGlowMix`), at most 40% at the root.
 */
export function resolveBoltGlowReachShare() {
    const fullStep = resolveBoltGlowMaxLuminanceStep();
    const neededMix = lightningFlashLimits.luminanceStep / fullStep;
    const peak = resolveBoltGlowAmount(lightningMotion.glowAmount);
    if (!(fullStep > 0) || neededMix > peak) return 0;
    return Math.sqrt(Math.log(peak / neededMix));
}

export type BoltGeometryMeasure = {
    /** `resolveBoltSilhouetteArea` of the bolt geometry. */
    silhouetteArea: number;
    /** `resolveBoltSpan` of the bolt geometry. */
    span: { width: number; height: number };
};

/** Pixels the bolt covers at its widest (the width bounce). */
export function resolveBoltAreaPx(
    boltHeightPx: number,
    { silhouetteArea, span }: BoltGeometryMeasure,
) {
    const scale = boltHeightPx / Math.max(1e-6, span.height);
    return silhouetteArea * scale * scale * (1 + lightningMotion.widthBounce);
}

/** The flash budget of a view in pixels. */
export function resolveFlashBudgetPx(
    viewWidthPx: number,
    viewHeightPx: number,
) {
    const frame = Math.max(0, viewWidthPx) * Math.max(0, viewHeightPx);
    return (
        Math.min(
            lightningFlashLimits.maxAreaPx,
            lightningFlashLimits.maxFrameShare * frame,
        ) * lightningFlashLimits.headroom
    );
}

export type BoltSizing = {
    /** Bolt height on screen; the anchor's height unless the view is small. */
    boltHeightPx: number;
    /** Glow radius on screen. */
    glowRadiusPx: number;
};

/**
 * Bolt height and glow radius that keep a strike inside the flash budget of
 * the view: the bolt keeps its 150 px (96 px from the band) and the glow
 * its 0.3 of the cloud width on a desktop view; on a small view the bolt
 * shrinks to its share and the glow takes what is left.
 */
export function resolveBoltSizing({
    anchorHeightPx,
    cloudWidthPx,
    geometry,
    viewHeightPx,
    viewWidthPx,
}: {
    anchorHeightPx: number;
    cloudWidthPx: number;
    geometry: BoltGeometryMeasure;
    viewHeightPx: number;
    viewWidthPx: number;
}): BoltSizing {
    const budget = resolveFlashBudgetPx(viewWidthPx, viewHeightPx);
    const fullArea = resolveBoltAreaPx(anchorHeightPx, geometry);
    const boltBudget = budget * lightningFlashLimits.boltShare;
    const boltHeightPx =
        fullArea > boltBudget && fullArea > 0
            ? anchorHeightPx * Math.sqrt(boltBudget / fullArea)
            : anchorHeightPx;
    const boltArea = resolveBoltAreaPx(boltHeightPx, geometry);
    const reachShare = resolveBoltGlowReachShare();
    const reachBudget = Math.sqrt(Math.max(0, budget - boltArea) / Math.PI);
    const glowRadiusPx = Math.min(
        resolveBoltGlowRadiusPx(cloudWidthPx),
        reachShare > 0 ? reachBudget / reachShare : boltGlowMaxRadiusPx,
    );
    return { boltHeightPx, glowRadiusPx };
}

export type BoltFlashFootprint = {
    boltAreaPx: number;
    /** Pixels where the glow can change luminance by 0.1 or more. */
    glowAreaPx: number;
    areaPx: number;
    /** Bounding box of bolt and glow together, in pixels. */
    widthPx: number;
    heightPx: number;
};

/**
 * An upper bound of the flash area of one strike: the bolt's silhouette at
 * its widest plus the disc where the glow can change luminance by 0.1 on
 * the darkest cloud tone, and the box both fit in.
 */
export function resolveBoltFlashFootprint({
    boltHeightPx,
    geometry,
    glowRadiusPx,
}: {
    boltHeightPx: number;
    geometry: BoltGeometryMeasure;
    glowRadiusPx: number;
}): BoltFlashFootprint {
    const boltAreaPx = resolveBoltAreaPx(boltHeightPx, geometry);
    const reach = glowRadiusPx * resolveBoltGlowReachShare();
    const glowAreaPx = Math.PI * reach * reach;

    // The bolt leans out by at most the outward lean plus its jitter.
    const lean = lightningMotion.leanOutward + lightningMotion.leanJitter;
    const scale = boltHeightPx / Math.max(1e-6, geometry.span.height);
    const boltWidth =
        geometry.span.width * scale * (1 + lightningMotion.widthBounce);
    const rotatedWidth =
        boltWidth * Math.cos(lean) + boltHeightPx * Math.sin(lean);
    const rotatedHeight =
        boltHeightPx * Math.cos(lean) + boltWidth * Math.sin(lean);
    // The glow sits at the bolt's root, which the lean moves sideways.
    const rootShift = (boltHeightPx / 2) * Math.sin(lean);
    return {
        boltAreaPx,
        glowAreaPx,
        areaPx: boltAreaPx + glowAreaPx,
        widthPx: Math.max(rotatedWidth, 2 * reach) + rootShift,
        heightPx: rotatedHeight + reach,
    };
}

/**
 * The glow as the band shader applies it (`sky/cloudBandMaterial.ts`) to
 * the amount the storm layer writes (`resolveBoltGlowAmount`): the share
 * toward the glow role at a distance from the root, never more than 40%.
 */
export function resolveBoltGlowMix(
    envelopeGlow: number,
    distance: number,
    radius: number,
) {
    const amount = resolveBoltGlowAmount(envelopeGlow);
    if (!(amount > 0)) return 0;
    const d = distance / Math.max(radius, 1e-4);
    return amount * Math.exp(-d * d);
}
