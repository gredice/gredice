import { Color, ShaderChunk } from 'three';
import { gameShadeVeil, gameSurfaceGradient } from './gameArtStyle';

const marker = '// gredice:surface-gradient';

function glslFloat(value: number) {
    return value.toFixed(4);
}

function glslVec3(values: readonly number[]) {
    return `vec3( ${values.map(glslFloat).join(', ')} )`;
}

/**
 * GLSL that tints the diffuse light of faces that do not point up: a little
 * darker and cooler near the floor and a little lighter and warmer toward
 * the top, so a flat side under the orthographic camera is not one flat
 * colour. Up-facing surfaces and the terrain keep their light, so the floor
 * stays continuous.
 *
 * It needs no extra varying: the world position comes back from the view
 * position, and the world up axis in view space is the second column of the
 * view matrix.
 */
export function buildSurfaceGradientShaderChunk() {
    const {
        baseTint,
        fadeIn,
        floorHeight,
        span,
        topTint,
        upFacingEnd,
        upFacingStart,
    } = gameSurfaceGradient;
    return `
${marker}
#if defined( STANDARD ) && !defined( GREDICE_NO_SURFACE_GRADIENT )
{
    vec3 surfaceGradientWorld = transpose( mat3( viewMatrix ) ) *
        ( -vViewPosition - viewMatrix[ 3 ].xyz );
    float surfaceGradientHeight = smoothstep(
        ${glslFloat(floorHeight)},
        ${glslFloat(floorHeight + span)},
        surfaceGradientWorld.y
    );
    float surfaceGradientUp = dot( geometryNormal, viewMatrix[ 1 ].xyz );
    float surfaceGradientWeight = ( 1.0 - smoothstep(
        ${glslFloat(upFacingEnd)},
        ${glslFloat(upFacingStart)},
        surfaceGradientUp
    ) ) * smoothstep(
        ${glslFloat(fadeIn[0])},
        ${glslFloat(fadeIn[1])},
        surfaceGradientWorld.y
    );
    vec3 surfaceGradientTint = mix(
        vec3( 1.0 ),
        mix(
            ${glslVec3(baseTint)},
            ${glslVec3(topTint)},
            surfaceGradientHeight
        ),
        surfaceGradientWeight
    );
    reflectedLight.directDiffuse *= surfaceGradientTint;
    reflectedLight.indirectDiffuse *= surfaceGradientTint;
}
#endif
${buildShadeVeilShaderChunk()}`;
}

const lumaWeights = [0.2126, 0.7152, 0.0722] as const;

/** A fill tint scaled to keep its luminance, then lifted. */
function shadeVeilTint(tint: readonly number[], lift: number) {
    const luma = tint.reduce(
        (sum, value, index) => sum + value * (lumaWeights[index] ?? 0),
        0,
    );
    return tint.map((value) => (value / luma) * lift);
}

/**
 * GLSL for the shade veil (GAME_ART.md: shadows tinted blue by the fill,
 * night is a light blue-violet board): faces the key does not reach get
 * their fill cooled and lifted, plus a little periwinkle light, so shaded
 * sides and cast shadows read lilac by day and blue-violet at night even on
 * green, gold and orange surfaces. It applies to the terrain too, so shadows
 * on the floor take it. Night is read from the hemisphere ground colour.
 */
export function buildShadeVeilShaderChunk() {
    const {
        blueEnd,
        blueStart,
        color,
        day,
        directEnd,
        directStart,
        keyShareEnd,
        keyShareStart,
        night,
    } = gameShadeVeil;
    const veilColor = new Color(color);
    return `
#if defined( STANDARD ) && NUM_HEMI_LIGHTS > 0
{
    vec3 shadeVeilGround = hemisphereLights[ 0 ].groundColor;
    float shadeVeilBlue = ( shadeVeilGround.b -
        max( shadeVeilGround.r, shadeVeilGround.g ) ) /
        max( shadeVeilGround.b, 0.0001 );
    float shadeVeilNight = smoothstep(
        ${glslFloat(blueStart)},
        ${glslFloat(blueEnd)},
        shadeVeilBlue
    );
    vec3 shadeVeilWeights = vec3( ${lumaWeights.map(glslFloat).join(', ')} );
    // By day the veil marks shade cast by a clear key. Under cloud and fog
    // the key is weak against the fill and every face would count as shaded,
    // so the day veil fades out there; the night veil does not depend on it.
    float shadeVeilSky = max(
        dot( hemisphereLights[ 0 ].skyColor, shadeVeilWeights ),
        0.0001
    );
    float shadeVeilKey = 0.0;
    #if NUM_DIR_LIGHTS > 0
        shadeVeilKey = dot( directionalLights[ 0 ].color, shadeVeilWeights );
    #endif
    float shadeVeilAmount = max(
        shadeVeilNight,
        smoothstep(
            ${glslFloat(keyShareStart)},
            ${glslFloat(keyShareEnd)},
            shadeVeilKey / shadeVeilSky
        )
    );
    float shadeVeilDirect = dot( reflectedLight.directDiffuse, shadeVeilWeights );
    float shadeVeilTotal = shadeVeilDirect +
        dot( reflectedLight.indirectDiffuse, shadeVeilWeights );
    float shadeVeilShade = shadeVeilAmount * ( 1.0 - smoothstep(
        ${glslFloat(directStart)},
        ${glslFloat(directEnd)},
        shadeVeilDirect / max( shadeVeilTotal, 0.0001 )
    ) );
    if ( shadeVeilShade > 0.0 ) {
        vec3 shadeVeilTint = mix(
            ${glslVec3(shadeVeilTint(day.tint, day.lift))},
            ${glslVec3(shadeVeilTint(night.tint, night.lift))},
            shadeVeilNight
        );
        float shadeVeilStrength = mix(
            ${glslFloat(day.strength)},
            ${glslFloat(night.strength)},
            shadeVeilNight
        );
        reflectedLight.indirectDiffuse *= mix(
            vec3( 1.0 ),
            shadeVeilTint,
            shadeVeilShade
        );
        reflectedLight.indirectDiffuse += ${glslVec3([veilColor.r, veilColor.g, veilColor.b])} *
            ( shadeVeilSky * shadeVeilStrength * shadeVeilShade );
    }
}
#endif
`;
}

/**
 * Adds the height gradient of the toy surface shader (GAME_ART.md) to every
 * lit standard material, after the direct and indirect light are gathered,
 * so it composes with the sky rim, weather overlays, ground patches and
 * cloud shadows. A material can opt out with the
 * `GREDICE_NO_SURFACE_GRADIENT` define.
 *
 * It edits a shared three.js shader chunk, so it must run before the first
 * material compiles. Calling it again does nothing.
 */
export function installSurfaceGradientShaderChunk() {
    if (ShaderChunk.lights_fragment_end.includes(marker)) return;
    ShaderChunk.lights_fragment_end = `${ShaderChunk.lights_fragment_end}${buildSurfaceGradientShaderChunk()}`;
}
