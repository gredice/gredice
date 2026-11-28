import { seasonalRoles } from '../../seasonalRoles';
import type { Season } from '../../seasonState';

/**
 * Colours of the wind's tumbling leaves (GAME_ART.md "Weather > Time of day
 * and seasons"): spring green and blossom pink in spring, the base canopy
 * greens in summer, the four autumn canopy roles in autumn, none in winter.
 * Leaves are lit like the canopy they came from, so these are albedos to
 * author: `screen_to_albedo` of each role's on-screen colour
 * (`assets/scripts/party_style.py`), as in `seasonalRoles.ts`.
 */
export const windLeafSummerAlbedos = {
    /** Canopy base `#43b93a` on screen. */
    canopy: '#30712c',
    /** Canopy highlight `#6fd040` on screen. */
    canopyLight: '#477e2f',
    /** Crop leaf highlight `#a4e352` on screen. */
    cropLeafLight: '#648a38',
} as const;

export const windLeafPalettes: Record<Season, readonly string[]> = {
    spring: [
        seasonalRoles.springGreen.albedo,
        seasonalRoles.blossomPink.albedo,
        seasonalRoles.springGreen.albedo,
        seasonalRoles.blossomWhite.albedo,
    ],
    summer: [
        windLeafSummerAlbedos.canopyLight,
        windLeafSummerAlbedos.cropLeafLight,
        windLeafSummerAlbedos.canopy,
    ],
    autumn: [
        seasonalRoles.autumnGold.albedo,
        seasonalRoles.autumnAmber.albedo,
        seasonalRoles.autumnOrange.albedo,
        seasonalRoles.autumnRed.albedo,
    ],
    winter: [],
};
