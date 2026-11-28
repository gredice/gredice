import { NeutralToneMapping } from 'three';

/**
 * Shared constants for the toy-diorama look described in GAME_ART.md.
 *
 * Light intensities keep the scene's existing exposure: a sunlit top face
 * receives roughly 3.3 times the light that would show its albedo unchanged,
 * which is what every authored colour in the game already assumes.
 */

/** Keeps authored hue and saturation. ACES filmic washed bright colours out. */
export const gameToneMapping = NeutralToneMapping;

export const gameLightRig = {
    /**
     * Share of the background colour (darkened by `groundSkyScale`) in the
     * hemisphere ground colour by day. The rest is the frame's warm bounce.
     */
    groundBackgroundWeight: 0.15,
    groundSkyScale: 0.42,
    /**
     * Lowest elevation (y of the unit direction) the key light comes from. A
     * real low sun only lights the far sides of the garden and leaves every
     * top face dark; the toy look keeps the key on the tops at dawn and dusk
     * and keeps the shadows short enough to read.
     */
    keyMinElevation: 0.8,
    /**
     * Highest elevation the key comes from. A summer noon sun stands almost
     * straight up and leaves both visible sides of a block in shade; capped,
     * the lit side keeps about 0.6 of the top (GAME_ART.md three values).
     */
    keyMaxElevation: 0.9,
    /**
     * Elevation the frame intensities are authored at. A key lifted only to
     * `keyMinElevation` gets brighter by part of the difference, so the tops
     * stay close to midday without the sunlit sides outshining them.
     */
    keyReferenceElevation: 0.95,
    keyLowElevationCompensation: 0.6,
    shadowRadius: 2.2,
    /** Cast shadows keep a little key light so they never go black. */
    shadowIntensity: 0.88,
    /**
     * Night shadows as a share of day shadows. Kept firm so the periwinkle
     * fill shows in them and the night garden does not read as day.
     */
    nightShadowVisibility: 0.8,
    /**
     * Share of the shadow strength removed around sunrise and sunset, when
     * the low key throws long shadows across the garden.
     */
    twilightShadowSoftening: 0.45,
} as const;

/**
 * One state of the light rig at a visual time of day. Colours are on-screen
 * sRGB; intensities are three.js light intensities like the midday rig.
 */
export type GameLightFrame = {
    /** Visual time of day, 0 to 1, as `visualDayNight.ts` uses it. */
    at: number;
    keyColor: string;
    keyIntensity: number;
    /**
     * The hemisphere sky colour comes from the background palette by day.
     * Each frame moves it toward `skyTint` by `skyTintWeight`.
     */
    skyTint: string;
    skyTintWeight: number;
    /** Hemisphere ground colour: the light bouncing up onto side faces. */
    groundColor: string;
    hemisphereIntensity: number;
    ambientColor: string;
    ambientIntensity: number;
};

/**
 * The 6000 K midday the palette was fitted to. The fill leans periwinkle
 * (sky tint and ambient with red close to green), so cast shadows on sand
 * and path shift toward lilac instead of olive.
 */
const middayFrame = {
    keyColor: '#fff3ef',
    keyIntensity: 7.5,
    skyTint: '#b8bcff',
    skyTintWeight: 0.4,
    groundColor: '#f8dab8',
    hemisphereIntensity: 4.2,
    ambientColor: '#c6c8ff',
    ambientIntensity: 1.6,
} as const;

/**
 * Night is a light blue-violet board, not a dark scene. The key (the moon,
 * or a fixed night key when the moon is down) is a pale, nearly white
 * lavender at about half the midday strength, so the tops keep their own hue
 * at about 0.8 of midday: grass stays green, wood stays orange. The
 * blue-violet comes from a strong periwinkle fill and firmer shadows, so
 * shaded sides, cast shadows and neutrals read blue-violet. The fill keeps
 * some green in it: a redder violet turned trunks crimson.
 */
const nightFrame = {
    keyColor: '#f0eeff',
    keyIntensity: 3.8,
    skyTint: '#c6c8f8',
    skyTintWeight: 1,
    groundColor: '#8ea8f0',
    hemisphereIntensity: 4,
    ambientColor: '#a0b2ff',
    ambientIntensity: 1.8,
} as const;

/**
 * The light rig across the day (GAME_ART.md "Time of day and seasons"):
 * coral-pink before sunrise, peach and gold at sunrise, fresh and clear in
 * the morning, the 6000 K midday the palette was fitted to, gold and coral at
 * sunset, lilac at dusk and a light blue-violet night. The warm keys are
 * pale enough that greens keep most of their value, so no time of day dims
 * the tops much below midday. Frames are sorted by `at` and eased between
 * with a smoothstep.
 */
export const gameLightFrames: readonly GameLightFrame[] = [
    { at: 0, ...nightFrame },
    { at: 0.14, ...nightFrame },
    {
        at: 0.185,
        keyColor: '#ffdcd2',
        keyIntensity: 7.4,
        skyTint: '#c8bcff',
        skyTintWeight: 0.7,
        groundColor: '#f2c4c8',
        hemisphereIntensity: 4.4,
        ambientColor: '#cec8ff',
        ambientIntensity: 1.6,
    },
    {
        at: 0.215,
        keyColor: '#ffe2bc',
        keyIntensity: 8.2,
        skyTint: '#c4c6ff',
        skyTintWeight: 0.4,
        groundColor: '#ffd4aa',
        hemisphereIntensity: 4.3,
        ambientColor: '#c6d0ff',
        ambientIntensity: 1.6,
    },
    {
        at: 0.29,
        keyColor: '#fff2e4',
        keyIntensity: 7.6,
        skyTint: '#a8c5ff',
        skyTintWeight: 0,
        groundColor: '#ffdcb4',
        hemisphereIntensity: 4.2,
        ambientColor: '#bcd9ff',
        ambientIntensity: 1.6,
    },
    { at: 0.38, ...middayFrame },
    { at: 0.7, ...middayFrame },
    {
        at: 0.755,
        keyColor: '#ffeacc',
        keyIntensity: 7.7,
        skyTint: '#a8c5ff',
        skyTintWeight: 0,
        groundColor: '#ffd8aa',
        hemisphereIntensity: 4.2,
        ambientColor: '#bcd9ff',
        ambientIntensity: 1.6,
    },
    {
        at: 0.795,
        keyColor: '#ffdcb6',
        keyIntensity: 8.4,
        skyTint: '#c8c0ff',
        skyTintWeight: 0.45,
        groundColor: '#ffcaa6',
        hemisphereIntensity: 4.3,
        ambientColor: '#cccaff',
        ambientIntensity: 1.6,
    },
    {
        at: 0.835,
        keyColor: '#f8dcf2',
        keyIntensity: 7.4,
        skyTint: '#c6b8ff',
        skyTintWeight: 0.85,
        groundColor: '#dcb6dc',
        hemisphereIntensity: 4.5,
        ambientColor: '#ccc2ff',
        ambientIntensity: 1.6,
    },
    { at: 0.885, ...nightFrame },
    { at: 1, ...nightFrame },
];

/**
 * Night key details. When the moon is down the key comes from a fixed
 * direction that lights the tops and the camera-left sides, like the
 * midday sun; a visible moon takes over its direction and adds light.
 */
export const gameNightLightRig = {
    /** Hemisphere sky colour of the night fill (also the sky palette's). */
    skyColor: nightFrame.skyTint,
    /** Unit direction of the night key while the moon is down. */
    keyDirection: [0.28, 0.8, -0.53],
    /** Extra key intensity and colour under a full, high moon. */
    moonKeyBoost: 1.2,
    moonColor: '#e0e4ff',
} as const;

/**
 * Weather keeps its colour (GAME_ART.md): cloud and fog take the key light
 * away but brighten the fill, tinted pale lavender instead of grey, so the
 * garden stays light. Fog takes the colour of the sky at the horizon so a
 * fogged prop fades into the background.
 */
export const gameWeatherLightRig = {
    /** Share of the key light that full cloud cover and full fog remove. */
    keyCloudLoss: 0.82,
    /**
     * Fog is a light, lilac weather (GAME_ART "Fog and mist"): it takes 40%
     * of the key, like the target (`0.4 × fog`), so the garden keeps its
     * shape and colour under the mist instead of going flat and grey.
     */
    keyFogLoss: 0.4,
    /**
     * Share of the key that the heaviest weather still keeps. Without any
     * key, mist and storm lit every face with the lavender fill alone, which
     * flattened the three values and took a third of the saturation out.
     */
    keyWeatherFloor: 0.15,
    /**
     * Extra fill, as a share of the frame's fill, under full cover. It makes
     * up most of the lost key, so a cloudy garden is about as light as a
     * sunny one, only flatter.
     */
    cloudFillBoost: 0.8,
    /**
     * Lower than the cloud boost: fog already lightens the garden with its
     * own colour, and a stronger fill pushed the tops into the tone mapping
     * shoulder, where colours lose saturation.
     */
    fogFillBoost: 0.25,
    /**
     * Fill and ambient colour under full cloud cover, and how far cover
     * moves to it: a pale lavender, so the garden shifts toward blue-violet
     * without greying the warm colours or turning snow blue.
     */
    overcastSkyColor: '#dcdaf5',
    overcastSkyWeight: 0.75,
    /**
     * Under cloud the ground is not sunlit, so its bounce loses warmth and
     * strength and the tops stay the lightest faces.
     */
    overcastGroundColor: '#c0b4d0',
    overcastGroundWeight: 0.6,
    /**
     * Share of the cloud key loss and cloud fill boost that applies at
     * night. With the full loss the night garden under overcast was lit by
     * the violet fill alone and washed to pink soil and mint grass; night
     * cloud keeps more of the pale key so colours stay (GAME_ART "Weather >
     * Time of day and seasons").
     */
    cloudNightScale: 0.25,
    /**
     * How much of today's cloud, rain and storm light the island takes, by
     * cloud cover (user decision 2026-11-25: "on lower cloud coverage the
     * island should be brighter, but dark like now when cloud coverage is
     * higher"). One monotone curve through these `[cover, share]` points
     * scales every term that darkens, flattens, tints or hazes the garden
     * under cloud, rain and storm: the key loss and fill boost, the lavender
     * fill and ground tint, the fade of the key's cast shadows, and the fog,
     * depth fog and ground mist that come with rain, snow or thunder
     * (`resolveWeatherCoverDimming`). From 0.75 up the share is exactly 1,
     * so high cover looks as before, the presets' 0.75 (snow) and 0.85
     * (cloudy, rain) included; the live symbols' 0.66 keeps 60%, 0.6 half
     * and 0.4 a sixth, close to the sunny garden. The sky (deck, storm
     * violet, band haze) and the moving cloud shadows keep their own cover
     * rules.
     *
     * The climb from 0.66 to 0.75 is steep on purpose: a key that has come
     * back only partly opens the day shade veil (`gameShadeVeil.keyShare*`)
     * while the lit sides still get too little direct light to stay out of
     * it, so every face takes the veil and orange soil and cream walls turn
     * pink. Shares between about 0.65 and 0.95 at high cover do that; the
     * curve crosses them between the presets and live covers, never at one.
     */
    coverDimming: {
        points: [
            [0, 0],
            [0.2, 0.03],
            [0.4, 0.16],
            [0.6, 0.5],
            [0.66, 0.6],
            [0.75, 1],
            [1, 1],
        ],
        /**
         * Fog that is its own weather (not brought by rain, snow or thunder)
         * holds the share at 1 over this range of fog, so fog and mist days
         * keep exactly their light: their cover (0.2 and 0.6) would otherwise
         * brighten them. A storm's or a shower's fog, and the thin haze
         * under 0.15 that overcast carries, follow the curve.
         */
        ownFogHold: [0.15, 0.6],
        /**
         * Share of the night's cloud fill boost that lower cover keeps, 0 to
         * 1. At night cloud lights the garden more than it dims it (the fill
         * boost outweighs the small night key loss), so letting the fill
         * follow the curve made lower-cover nights darker than full cover,
         * and partly cloudy nights darker than clear ones. At 1 the night
         * keeps the cloud's fill at every cover and the curve only gives
         * back key, colour and clarity; by day the fill follows the curve.
         */
        nightFillHold: 1,
    },
    /** Tint mixed into the fog colour so it never reads as plain grey. */
    fogTint: '#c9cfff',
    fogTintWeight: 0.5,
    /**
     * Fog strength at the garden centre under full fog. Kept low so a misty
     * garden keeps its colours and only the back fades into the sky.
     */
    fogCenterAmount: 0.06,
    /**
     * Depth over which fog builds, in world units. Long, so fog thickens
     * gently from the front of the garden to the back instead of hiding it.
     */
    fogDepthSpan: 70,
} as const;

/**
 * Rain and storm turn the sky grey (user feedback 2026-11-26: "when the
 * cloud coverage is high and stormy/raining, the background should have
 * less color"). Only the backdrop takes it: the sky gradient, the cloud
 * band, its deck and haze (`weather/sky/skyGrey.ts`); the island keeps its
 * light, tint and fog. The amount is the cover curve
 * (`gameWeatherLightRig.coverDimming`, full from cover 0.75, so a
 * low-cover shower keeps its colour) times the wet: rain over `rainRamp`
 * (light rain 0.6 takes about half, heavy rain all of it) or the damped
 * storm amount at the cover the band draws (thunder always brings the
 * deck, so every storm greys like overcast). Each colour moves toward
 * `tint` at its own luminance, so the sky gets no darker and the lightning
 * flash budget holds.
 */
export const gameWeatherSkyGrey = {
    /** Rain amount where the grey starts and where it is full. */
    rainRamp: [0.2, 1],
    /**
     * Share of the colour a full grey takes away at midday, sunset and
     * night (blended by the weather roles' time weights). Sunset keeps a
     * little more and leans rose-grey, so a rainy dusk still reads as dusk;
     * night keeps more and leans slate blue, so it still reads as night.
     */
    dayStrength: 0.8,
    sunsetStrength: 0.65,
    nightStrength: 0.5,
    /** The grey each moves toward, as on-screen sRGB: soft and cool. */
    dayTint: '#d3d7de',
    sunsetTint: '#dcd5de',
    nightTint: '#a9b0d6',
} as const;

/**
 * Height gradient of the toy surface shader (`surfaceGradientShaderChunk.ts`).
 * Under the orthographic camera a flat side shows one flat colour, so faces
 * that do not point up get a little darker and cooler near the floor and a
 * little lighter and warmer toward the top. It scales light, not colour, and
 * leaves the terrain alone: up-facing faces keep their light so the floor
 * stays continuous, and it fades out at the floor so terrain sides and the
 * grass banks keep theirs. Heights are world y: terrain blocks are 0.4
 * tall, so the floor of a one-layer garden is at 0.4.
 */
export const gameSurfaceGradient = {
    floorHeight: 0.4,
    /** Height above `floorHeight` where the top tint is reached. */
    span: 1.4,
    /** Diffuse light multiplier at the floor: a little darker and cooler. */
    baseTint: [0.93, 0.945, 0.99],
    /** Diffuse light multiplier at the top: a little lighter and warmer. */
    topTint: [1.06, 1.05, 1.02],
    /** World heights over which the gradient fades in above the terrain. */
    fadeIn: [0.38, 0.46],
    /**
     * Up-facing surfaces keep their colour so the floor and every terrain
     * top stay continuous. The gradient fades in between these world-normal
     * y values.
     */
    upFacingStart: 0.9,
    upFacingEnd: 0.6,
} as const;

/**
 * Shade veil of the toy surface shader (`surfaceGradientShaderChunk.ts`).
 * Light alone cannot turn a green, gold or orange surface blue-violet
 * without darkening it, so faces the key does not reach (shaded sides and
 * cast shadows) get their fill cooled and lifted, plus a little periwinkle
 * light added on top of their colour. Sunlit tops keep their own colour, and
 * emissive glow is untouched.
 *
 * By day the veil is light: the fill of shaded faces leans periwinkle with a
 * little less green, so shadows on sand and path read lilac instead of olive
 * and a gold canopy's underside leans amber instead of olive. At night it is
 * stronger, like a party board at night.
 *
 * Night follows the rig through the hemisphere ground colour, with no extra
 * uniform: only the night fill's ground bounce is clearly blue (blue leads
 * red and green by a share of blue above `blueStart`); the warm day bounce,
 * the lilac dusk and the lavender overcast stay below it.
 */
export const gameShadeVeil = {
    /** Share of the ground bounce's blue that leads red and green. */
    blueStart: 0.3,
    blueEnd: 0.45,
    /**
     * Share of the diffuse light that comes straight from the key. Faces
     * below `directStart` take the full veil, faces above `directEnd` none.
     */
    directStart: 0.12,
    directEnd: 0.4,
    /**
     * Key light over hemisphere sky light (luminance) where the day veil
     * fades in. A clear day is about 3; cloud and fog bring it under 0.3,
     * where the light is even and nothing reads as shaded.
     */
    keyShareStart: 0.4,
    keyShareEnd: 1,
    /** Periwinkle the veil adds, as on-screen sRGB. */
    color: '#6f78ff',
    day: {
        /**
         * Fill tint of shaded faces, kept at the same luminance before
         * `lift` scales it: a little less green and more blue.
         */
        tint: [0.9, 0.87, 1.5],
        /** Lifts shaded faces toward 0.4 of the top (GAME_ART.md). */
        lift: 1.1,
        /**
         * Added periwinkle, as a share of the hemisphere sky light. Kept low
         * by day: more turned the soil sides of the terrain pink.
         */
        strength: 0.03,
    },
    night: {
        /** A little bluer, so cast shadows on pale sand do not stay beige. */
        tint: [0.92, 0.92, 1.25],
        /**
         * Keeps night shaded sides light instead of a dark plum. Higher, and
         * cast shadows on the lawn came out as light as the lit lawn.
         */
        lift: 1.25,
        strength: 0.045,
    },
} as const;
