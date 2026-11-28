import { ShaderChunk } from 'three';

const marker = '// gredice:sky-rim';

/**
 * Strength of the sky-coloured rim on rounded surfaces. It scales with the
 * hemisphere light, so it follows time of day and weather by itself.
 */
export const skyRimStrength = 0.055;

/**
 * Adds a soft sky-coloured rim to every lit standard material, on the edges
 * that face up and away from the camera. Under an orthographic camera a
 * rounded shape otherwise shades like a flat disc; the rim gives it the
 * soft toy edge of GAME_ART.md. Flat faces of boxes barely change, because
 * the rim only builds up where a surface turns away from the view.
 *
 * It edits a shared three.js shader chunk, so it must run before the first
 * material compiles. Calling it again does nothing.
 */
export function installSkyRimShaderChunk() {
    if (ShaderChunk.lights_fragment_end.includes(marker)) return;
    ShaderChunk.lights_fragment_end = `${ShaderChunk.lights_fragment_end}
${marker}
#if defined( STANDARD ) && defined( RE_IndirectDiffuse ) && NUM_HEMI_LIGHTS > 0
{
    float skyRimFacing = saturate( dot( geometryNormal, geometryViewDir ) );
    float skyRimUp = dot( geometryNormal, hemisphereLights[ 0 ].direction );
    // Fades out on the last sliver before the silhouette, where a single
    // aliased pixel row otherwise shows a light fringe against the sky.
    float skyRim = pow( 1.0 - skyRimFacing, 3.0 ) *
        smoothstep( 0.0, 0.08, skyRimFacing ) *
        smoothstep( -0.15, 0.65, skyRimUp );
    reflectedLight.indirectDiffuse += hemisphereLights[ 0 ].skyColor * ( skyRim * ${skyRimStrength.toFixed(4)} );
}
#endif
`;
}
