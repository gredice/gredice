import { treeEntityScale } from '../entities/treeEntityScale';
import type { SnowMaterialOptions } from './SnowOverlay';

/**
 * A canopy's lighter cap takes snow on every face down to a steep underside
 * (GAME_ART.md "Weather > Snow": no green crescent between the dome's snow
 * and the cap's own). One place to change how far down the cover reaches.
 */
export const canopyCapSlopeRange = [-0.7, -0.2] as const;

/**
 * A canopy dome takes snow on its upper part with one soft edge (the
 * target's cover range), instead of a band down its sides that left a green
 * crescent and a jagged second band under the dome's snow.
 */
export const canopyDomeSlopeRange = [0.2, 0.6] as const;

/**
 * Grass takes snow more slowly than paths and roofs (GAME_ART.md "Weather >
 * Snow"). With the shared cover ramp on top, flat grass shows no dusting
 * below about 1 cm of lying snow, a light see-through dusting at 2 cm
 * (about 45% of the cover, so it reads as dusted snow next to the white
 * paths and roofs, not as a paler lawn), about 80% at 3 cm and the full
 * cover at 3.5 cm. Ending at 3.5 cm keeps the dusting whole well before the
 * integrated ground snow can take a grass tile over (from 5.4 cm on flat
 * grass, see `resolveSnowSurfaceIntegrationReadiness`) and before the
 * opaque cover (6 cm), and melting runs the same way back. The dusting lies
 * flat until about 2.9 cm and grows its thickness by 3.5 cm
 * (`snowCoverRules.settleThicknessFrom`). The same values on every grass
 * piece (tops, slopes, corners, rim lips and verges), so neighbouring tiles
 * match.
 */
export const grassSettleCm = [0.5, 3.5] as const;

/**
 * The overlay measures a face's slope through the entity's model matrix
 * without the inverse transpose, so on an entity squashed sideways (the
 * Tree is drawn at 0.125 wide, 0.5 tall) a steep face reads as almost flat:
 * the tangent of its angle from up shrinks by (horizontal / vertical)^2.
 * Turns an up range given as the true world normal's up component into the
 * overlay's measure for an entity at that scale.
 */
export function overlaySlopeRangeForScale(
    range: readonly [number, number],
    horizontalScale: number,
    verticalScale: number,
) {
    const squash = (horizontalScale / verticalScale) ** 2;
    const convert = (up: number) => {
        if (up <= 0) return up;
        const tangent = (Math.sqrt(Math.max(0, 1 - up * up)) / up) * squash;
        return 1 / Math.sqrt(1 + tangent * tangent);
    };
    return [convert(range[0]), convert(range[1])] as const;
}

/**
 * Snow on a bare tree's branches (GAME_ART.md "Weather > Snow"): the
 * branches rise steeply (60 to 75 degrees), so the upper side of a branch
 * faces about 60 to 75 degrees from up. Faces within about 50 degrees of up
 * are fully covered, fading out by about 70 degrees, so the cover reads as
 * a cap on each tip and a thin line along the tops of the less steep
 * branches. It stops short of a steep branch's upper side: a wider band
 * (full to 63 degrees) matched the snowy ground behind the tree, so the
 * branches read as split lengthwise or cut into pieces (2026-11-25 audit).
 */
export const treeBranchUpRange = [0.35, 0.65] as const;

export const snowPresets = {
    grassFlat: {
        maxThickness: 0.1,
        slopeExponent: 2.4,
        noiseScale: 0.2,
        coverageMultiplier: 1.5,
        settleCm: grassSettleCm,
    },
    grassAngle: {
        maxThickness: 0.18,
        slopeExponent: 2.4,
        noiseScale: 0.2,
        coverageMultiplier: 1.4,
        settleCm: grassSettleCm,
    },
    grassCorner: {
        maxThickness: 0.16,
        slopeExponent: 1.8,
        noiseScale: 0.2,
        coverageMultiplier: 1.3,
        settleCm: grassSettleCm,
    },
    grassReverseCorner: {
        maxThickness: 0.16,
        slopeExponent: 1.8,
        noiseScale: 0.2,
        coverageMultiplier: 1.3,
        settleCm: grassSettleCm,
    },
    sand: {
        maxThickness: 0.12,
        slopeExponent: 2.8,
        noiseScale: 0.2,
        coverageMultiplier: 0.9,
    },
    sandAngle: {
        maxThickness: 0.12,
        slopeExponent: 1.4,
        noiseScale: 0.2,
        coverageMultiplier: 0.85,
    },
    sandCorner: {
        maxThickness: 0.12,
        slopeExponent: 1.2,
        noiseScale: 0.2,
        coverageMultiplier: 0.8,
    },
    sandReverseCorner: {
        maxThickness: 0.12,
        slopeExponent: 1.2,
        noiseScale: 0.2,
        coverageMultiplier: 0.8,
    },
    snow: {
        maxThickness: 0.15,
        slopeExponent: 3,
        noiseScale: 0.2,
    },
    snowAngle: {
        maxThickness: 0.15,
        slopeExponent: 1.2,
        noiseScale: 0.2,
        coverageMultiplier: 0.8,
    },
    snowCorner: {
        maxThickness: 0.15,
        slopeExponent: 1,
        noiseScale: 0.2,
        coverageMultiplier: 0.75,
    },
    snowReverseCorner: {
        maxThickness: 0.15,
        slopeExponent: 1,
        noiseScale: 0.2,
        coverageMultiplier: 0.75,
    },
    giftBox: {
        maxThickness: 0.1,
        slopeExponent: 2.5,
        noiseScale: 1.5,
        coverageMultiplier: 2,
    },
    treeCanopyInner: {
        maxThickness: 0.5,
        slopeExponent: 0.1,
        noiseScale: 91,
        coverageMultiplier: 0.6,
        slopeRange: canopyDomeSlopeRange,
    },
    /**
     * Thin lines on the tops of a bare tree's branches. No noise in the
     * cover, so a line's edge follows the branch's slope cleanly instead
     * of fraying on thin geometry.
     */
    treeBranches: {
        maxThickness: 0.028,
        slopeExponent: 1,
        noiseScale: 6,
        noiseAmplitude: 0.1,
        noiseInfluence: 0,
        coverageMultiplier: 1,
        slopeRange: overlaySlopeRangeForScale(
            treeBranchUpRange,
            treeEntityScale[0],
            treeEntityScale[1],
        ),
    },
    pine: {
        maxThickness: 0.09,
        slopeExponent: 1.8,
        noiseScale: 7.5,
        coverageMultiplier: 0.6,
    },
    hay: {
        maxThickness: 0.2,
        slopeExponent: 1.4,
        noiseScale: 4,
        coverageMultiplier: 0.85,
    },
    mulch: {
        maxThickness: 0.01,
        slopeExponent: 2.6,
        noiseScale: 3,
    },
    tulip: {
        maxThickness: 0.06,
        slopeExponent: 1.8,
        noiseScale: 5,
        coverageMultiplier: 0.6,
    },
    bushCore: {
        maxThickness: 0.08,
        slopeExponent: 0.6,
        noiseScale: 2.4,
        coverageMultiplier: 0.65,
        slopeRange: canopyDomeSlopeRange,
    },
    /** The bush's lighter cap: covered all over, so no green crescent. */
    bushFoliage: {
        maxThickness: 0.07,
        slopeExponent: 1.5,
        noiseScale: 5,
        coverageMultiplier: 2,
        slopeRange: canopyCapSlopeRange,
    },
    stone: {
        maxThickness: 0.09,
        slopeExponent: 2.8,
        noiseScale: 2.2,
    },
    tool: {
        maxThickness: 0.01,
        slopeExponent: 3.5,
        noiseScale: 4.5,
        coverageMultiplier: 0.9,
    },
} satisfies Record<string, SnowMaterialOptions>;

export type SnowPresetKey = keyof typeof snowPresets;
