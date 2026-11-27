import { seasonalRoles } from '../scene/seasonalRoles';

/**
 * Glazed pot colours in the toy style of GAME_ART.md.
 *
 * Each value is the linear albedo, written as sRGB hex the way three.js reads
 * a colour string. A sunlit top face shows a brighter colour; the comment
 * gives that on-screen target. `assets/scripts/party-pass-pots-bottles.py`
 * holds the same table (`POT_SCREEN`). PotLowBowl is the bowl of the autumn
 * aster pot, so it takes the seasonal terracotta role.
 */
export const potGlazeColors = {
    PotLowBowl: seasonalRoles.terracotta.albedo, // terracotta, shows #e4764a
    PotRoundedBowl: '#357453', // jade, shows #4cbf86
    PotBulbousNeck: '#923f66', // bubblegum pink, shows #ec60a4
    PotTallTapered: '#987829', // butter yellow, shows #f0bd38
    PotHourglass: '#3c588a', // cornflower blue, shows #5b8fe3
    PotStraightShortTub: '#5f3d8c', // violet, shows #9a5ce6
    PotNarrowFootBowl: '#964e41', // coral, shows #ef7a63
    PotSquatRidged: '#2a686f', // teal, shows #35aab6
    PotTallSlenderCone: '#873440', // raspberry, shows #de4a63
    PotWideLippedCup: '#925c2a', // amber, shows #ec9436
} as const;

export type PotVariantName = keyof typeof potGlazeColors;

/** Glazed ceramic sits in the gloss band. */
export const potGlazeRoughness = 0.38;

/** Bed soil role from GAME_ART.md, shows #8f5530. */
export const potSoilColor = '#583928';
export const potSoilRoughness = 0.85;
