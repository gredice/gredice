import { Color, type IUniform, Vector3 } from 'three';

/**
 * The storm glow on the cloud band (GAME_ART.md "Weather > Storm and
 * lightning"): the storm layer (WP5) writes the bolt root's world position,
 * a world radius and the amount here; the band (`SkyClouds.tsx`) projects
 * them to the screen every frame and warms the band only around the root,
 * at most 40% toward the glow colour.
 */
export type SkyCloudGlowUniforms = {
    /** Glow colour (linear), from the `boltGlow` role. */
    uGlowColor: IUniform<Color>;
    /** World position of the bolt's root (any depth: the band is flat). */
    uGlowPos: IUniform<Vector3>;
    /** 0 to 1; the band never moves more than 40% toward the glow. */
    uGlow: IUniform<number>;
    /** World radius of the glow. */
    uGlowRadius: IUniform<number>;
};

const sharedSkyCloudGlowUniforms: SkyCloudGlowUniforms = {
    uGlowColor: { value: new Color(1, 0.94, 0.8) },
    uGlowPos: { value: new Vector3() },
    uGlow: { value: 0 },
    uGlowRadius: { value: 0.8 },
};

/** The one strike glow the band reads (WP5 writes it). */
export function getSkyCloudGlowUniforms() {
    return sharedSkyCloudGlowUniforms;
}
