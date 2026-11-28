/**
 * Bright seasonal colour roles from "Seasonal roles" in GAME_ART.md.
 *
 * `screen` is the sRGB colour a sunlit top face shows. `albedo` is the colour
 * to author: the linear albedo written as sRGB hex, the way three.js reads a
 * colour string, so it is darker than `screen` (a sunlit face shows about 3.2
 * times its albedo through neutral tone mapping). Seasons change hue, not
 * brightness or saturation.
 *
 * `assets/scripts/party_style.py` holds the same table (`SEASONAL_ROLES`), plus
 * the remap from every old seasonal colour to these roles.
 * `seasonalRoles.unit.ts` keeps the two in sync.
 */
export const seasonalRoles = {
    /** Canopy and loose leaves, first autumn stop. */
    autumnGold: {
        screen: '#f0c832',
        albedo: '#987f25',
        roughness: 0.55,
        season: 'autumn',
    },
    /** Canopy and loose leaves, second stop. */
    autumnAmber: {
        screen: '#f09a38',
        albedo: '#986229',
        roughness: 0.55,
        season: 'autumn',
    },
    /** Canopy and loose leaves, third stop. */
    autumnOrange: {
        screen: '#ee6c2b',
        albedo: '#944523',
        roughness: 0.55,
        season: 'autumn',
    },
    /** Canopy and loose leaves, last stop. Replaces russet brown. */
    autumnRed: {
        screen: '#e44a2e',
        albedo: '#8a3327',
        roughness: 0.55,
        season: 'autumn',
    },
    /** Body of leaf piles and leaf beds under the loose leaves. */
    leafPile: {
        screen: '#d9733a',
        albedo: '#84492c',
        roughness: 0.6,
        season: 'autumn',
    },
    /** Pumpkin skin, harvest and Halloween. */
    pumpkin: {
        screen: '#f0803a',
        albedo: '#98522a',
        roughness: 0.4,
        season: 'autumn',
    },
    /** Lighter pumpkin or squash, second pumpkin of a group. */
    pumpkinLight: {
        screen: '#f2a640',
        albedo: '#9d6b2b',
        roughness: 0.4,
        season: 'autumn',
    },
    /** Deeper pumpkin, third pumpkin of a group, lantern inside by day. */
    pumpkinShade: {
        screen: '#e2662a',
        albedo: '#894126',
        roughness: 0.4,
        season: 'autumn',
    },
    /** Hay, straw, dry grass, seed heads. */
    hay: {
        screen: '#f2cb5a',
        albedo: '#9d833b',
        roughness: 0.8,
        season: 'autumn',
    },
    /** Darker straw, wicker, dry stems. */
    hayShade: {
        screen: '#dcab48',
        albedo: '#856833',
        roughness: 0.8,
        season: 'autumn',
    },
    /** Harvest apples. */
    appleRed: {
        screen: '#ec3c3a',
        albedo: '#922d2c',
        roughness: 0.3,
        season: 'autumn',
    },
    /** Acorns, chestnut flesh, hedgehog face. */
    nutCaramel: {
        screen: '#dc9a4c',
        albedo: '#855f35',
        roughness: 0.45,
        season: 'autumn',
    },
    /** Acorn caps, mushroom caps, hedgehog spines. */
    acornCap: {
        screen: '#c28a50',
        albedo: '#765537',
        roughness: 0.6,
        season: 'autumn',
    },
    /** Conker and chestnut shells, charred wood, hedgehog body. */
    conker: {
        screen: '#c4683a',
        albedo: '#77432c',
        roughness: 0.35,
        season: 'autumn',
    },
    /** Terracotta pot of the aster pot. */
    terracotta: {
        screen: '#e4764a',
        albedo: '#8a4a34',
        roughness: 0.4,
        season: 'autumn',
    },
    /** Asters and other autumn flowers. */
    asterViolet: {
        screen: '#c05ddc',
        albedo: '#753d85',
        roughness: 0.6,
        season: 'autumn',
    },
    /** Blanket stripes, patches, bunting, mug rims. */
    textileRust: {
        screen: '#e45f3a',
        albedo: '#8a3e2c',
        roughness: 0.8,
        season: 'autumn',
    },
    /** Linen, paper, mushroom stems, ribbons. */
    cream: {
        screen: '#f2e4c6',
        albedo: '#9d9380',
        roughness: 0.8,
        season: 'autumn',
    },
    /** Cool accent: enamel, work shirt, gift box. */
    enamelBlue: {
        screen: '#3f8ff0',
        albedo: '#2c5b98',
        roughness: 0.35,
        season: 'autumn',
    },
    /** Dark metal: rake head, pans, wheels, brazier. */
    iron: {
        screen: '#8a95b5',
        albedo: '#555c6e',
        roughness: 0.4,
        season: 'autumn',
    },
    /** Lantern, ember and pumpkin glow by day; emissive in seasonalEmissive. */
    lanternGlow: {
        screen: '#f2b84a',
        albedo: '#9d7731',
        roughness: 0.5,
        season: 'autumn',
    },
    /** Halloween accent. */
    halloweenPurple: {
        screen: '#9a4ce0',
        albedo: '#5f3588',
        roughness: 0.4,
        season: 'halloween',
    },
    /** Halloween slime and potion accent. */
    halloweenLime: {
        screen: '#b4e22e',
        albedo: '#6e8927',
        roughness: 0.45,
        season: 'halloween',
    },
    /** Ghost sheet and cobweb. */
    ghostLilac: {
        screen: '#e2d4f2',
        albedo: '#92899d',
        roughness: 0.75,
        season: 'halloween',
    },
    /** Small facial features only: eyes, smiles, coal. Never black. */
    inkViolet: {
        screen: '#5c4590',
        albedo: '#3c3159',
        roughness: 0.5,
        season: 'halloween',
    },
    /** Snow cover, snow blocks, snowman. */
    snow: {
        screen: '#d6e2f2',
        albedo: '#8a929d',
        roughness: 0.8,
        season: 'winter',
    },
    /** Ice and icicles. */
    iceBlue: {
        screen: '#6ac6f0',
        albedo: '#457e98',
        roughness: 0.15,
        season: 'winter',
    },
    /** Pine and fir needles, wreath greenery. */
    evergreen: {
        screen: '#42b848',
        albedo: '#307033',
        roughness: 0.55,
        season: 'winter',
    },
    /** Gift boxes, ribbons, ornaments. */
    holidayRed: {
        screen: '#dc2f4c',
        albedo: '#852834',
        roughness: 0.35,
        season: 'winter',
    },
    /** Stars, bells, gold ribbon. */
    holidayGold: {
        screen: '#f2c040',
        albedo: '#9d7c2b',
        roughness: 0.35,
        season: 'winter',
    },
    /** Fairy lights and winter lamps by day; emissive in seasonalEmissive. */
    lampWarm: {
        screen: '#f2cc66',
        albedo: '#9d8442',
        roughness: 0.5,
        season: 'winter',
    },
    /** Fresh spring leaves and buds. */
    springGreen: {
        screen: '#8ee04e',
        albedo: '#588836',
        roughness: 0.5,
        season: 'spring',
    },
    /** Blossom. */
    blossomPink: {
        screen: '#f26aaf',
        albedo: '#9d4571',
        roughness: 0.5,
        season: 'spring',
    },
    /** White blossom with a pink tint. */
    blossomWhite: {
        screen: '#f2d4e2',
        albedo: '#9d8992',
        roughness: 0.5,
        season: 'spring',
    },
} as const;

export type SeasonalRoleName = keyof typeof seasonalRoles;

/**
 * Emissive colour of the glow roles. Their `screen` colour above is what the
 * glowing part shows by day; this brighter target is for `emissive` only.
 */
export const seasonalEmissive = {
    lanternGlow: '#ffb43a',
    lampWarm: '#ffd36b',
} as const;

/**
 * Albedo stops a deciduous canopy passes through in autumn, after its summer
 * green: gold, amber, orange, red. Replaces the muted gold to russet stops.
 */
export const autumnCanopyStops = [
    seasonalRoles.autumnGold.albedo,
    seasonalRoles.autumnAmber.albedo,
    seasonalRoles.autumnOrange.albedo,
    seasonalRoles.autumnRed.albedo,
] as const;
