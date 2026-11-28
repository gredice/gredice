export type WaterColors = {
    deep: string;
    shallow: string;
    foam: string;
};

/**
 * Pond and stream water at a clear midday, as the colour a sunlit top face
 * shows on screen: `shallow` is the water role from GAME_ART.md, `deep` the
 * slightly deeper tone of open water and deep pits, and `foam` the soft light
 * edge at a bank. `waterAlbedoPalette` holds the albedo the lit water
 * shader uses to show them.
 */
export const defaultWaterColors: WaterColors = {
    deep: '#2490e8',
    shallow: '#35b4ff',
    foam: '#c8efff',
};

export type LinearRgb = readonly [number, number, number];

/**
 * Linear albedo of every water surface. Water is lit by the scene like any
 * other surface, so time of day, weather, moonlight and shadows reach it
 * through the lights and the albedo stays fixed. Each value shows the
 * commented on-screen colour on a sunlit top face at a clear midday (gain
 * 3.2 and neutral tone mapping, as `assets/scripts/party_style.py` models
 * it); `waterColorState.unit.ts` checks the round trip.
 */
export const waterAlbedoPalette = {
    standard: {
        /**
         * Water role `#35b4ff`. Its full blue is past what tone mapping can
         * show, so this is the closest reachable colour, about `#2fbaf4`
         * under the model and `#3daef6` under the bluer midday rig.
         */
        shallow: [0, 0.186, 0.35],
        /** `#2490e8`. */
        deep: [0.0161, 0.099, 0.2666],
        /**
         * The side of the water body, `#69acf7` when sunlit. A lit side gets
         * about 0.6 of the top's light and shows `#4896e3`, a shaded side
         * about 0.4 and shows `#3179bb`. It carries some red and green so
         * the dimmer, cooler side light does not push it past the
         * saturation range into a heavy royal blue.
         */
        side: [0.055, 0.18, 0.42],
        /** `#c8efff`, the light edge at a bank. */
        foam: [0.4632, 0.8459, 1],
    },
    /** Swamp water: clean green-teal with yellow-green algae rafts. */
    swamp: {
        /** `#47bd99`. */
        shallow: [0.0322, 0.1715, 0.112],
        /** `#36ad90`. */
        deep: [0.024, 0.1431, 0.0996],
        /**
         * `#43b4a6` on a side at 0.6 of the top's light and `#2c9487` at
         * 0.4, a little bluer than the top so a shaded side stays light.
         */
        side: [0.05, 0.26, 0.22],
        /** `#d4f0b4`. */
        foam: [0.2399, 0.3149, 0.1688],
        /** `#8ccf3a`, leaning yellow-green, never olive. */
        algae: [0.0945, 0.2075, 0.0257],
    },
} satisfies Record<
    'standard' | 'swamp',
    Record<'deep' | 'foam' | 'shallow' | 'side', LinearRgb> & {
        algae?: LinearRgb;
    }
>;

/** Lit water in small props (bucket, well, watering can). */
export const litWaterSurfaceAlbedo: LinearRgb =
    waterAlbedoPalette.standard.shallow;
/** Wet roughness band from GAME_ART.md, for block and prop water alike. */
export const litWaterSurfaceRoughness = 0.12;
/**
 * Most direct-light specular a flat water face may add, in linear light.
 * Every water top shares one normal under the orthographic camera, so a sun
 * at the mirror angle would otherwise flash the whole pond white at once;
 * capped, it gives a soft sheen instead.
 */
export const waterSurfaceSheenCap = 0.12;
/**
 * How far the drifting glint on a water top moves toward the bank colour at
 * its brightest. The bank albedo is several times the water's, so a little
 * goes a long way: at 0.12 a glint over a single tile turned the whole tile
 * a milky `#6cbdf9`; at this strength its peak is about `#4dc1f5`.
 */
export const waterGlintStrength = 0.06;
