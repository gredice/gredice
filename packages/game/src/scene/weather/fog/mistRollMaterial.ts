import {
    Color,
    DoubleSide,
    type IUniform,
    ShaderMaterial,
    Vector4,
} from 'three';
import { getMistRollGeometryData, mistRollLobeSlots } from './mistRollGeometry';

/**
 * The mist roll shader (GAME_ART.md "Weather > Fog and mist"): every rim
 * and sky roll in one instanced draw of view-facing quads, each a soft mist
 * bank drawn with the band clouds' analytic falloff
 * (`sky/cloudBandMaterial.ts`): summed compact lobes, low-frequency value
 * noise that only frays the soft edge, and a smooth coverage ramp. No
 * textures, unlit two-tone shading in the mist roles, so the rolls stay
 * light and lilac at any light level.
 */
export const mistRollMaterialRules = {
    /**
     * Coverage ramp over the summed lobe density (the band's 0.04 to 0.55,
     * widened): mist fades in over most of each lobe's radius, so the edge
     * is a soft gradient rather than an outline.
     */
    coverage: [0.04, 0.75],
    /**
     * Opacity of the thin outer body against the dense core (the band's
     * 0.6 to 0.9 body ramp, as a share of the peak), so the middle reads
     * denser than the wisps.
     */
    edgeBody: 0.55,
    /**
     * Density where the body ramp starts (thinner mist keeps `edgeBody`)
     * and where it reaches full opacity, so only the middle of the bank
     * reads dense.
     */
    bodyFrom: 0.4,
    coreDensity: 1.25,
    /**
     * How far the noise moves the density at the soft edge (the band's
     * erosion), and the density over which it fades in from the support's
     * rim, so the fray never draws past the lobes (no hard cut).
     */
    erosion: 0.55,
    frayIn: 0.18,
    /**
     * Density over which the fray fades back out toward the core, so the
     * noise only roughens the thin edge and the dense middle stays smooth.
     */
    frayOut: [0.3, 1],
    /**
     * Noise frequency in form widths: about six bumps along a roll, the
     * band's low-frequency fray (a roll is 240 to 300 px; the band's 30 px).
     */
    noiseScale: 6.5,
    /** Noise drift with the scene clock, form widths a second (still under reduced motion). */
    noiseDrift: 0.012,
    /** Value-noise octaves: two keep the fray soft and cheap. */
    octaves: 2,
    /**
     * Shading: a lighter top, the mist's low role toward the base, and the
     * lobes' soft-ball light from above and in front (the band's `lam`).
     */
    shadeBase: 0.16,
    shadeLow: 0.55,
    shadeLobe: 0.28,
    lightDirection: [0.2, 0.8, 0.55],
    /**
     * Share of the form's height, from the base, over which the low role
     * gives way to the lit top, so the lower half reads as the underside.
     */
    shadeRamp: 0.6,
    /**
     * How far the shade colour leans from `mist` toward `mistLow`: under
     * half way, so the base stays light lilac and never turns grey.
     */
    shadeMix: 0.45,
    /**
     * Slide and bob speeds, radians a second (the amplitudes are in
     * `mistRollRules`): a slow drift with a bob twice as fast, so a roll
     * breathes without reading as something that moves on its own.
     */
    slideSpeed: 0.25,
    bobSpeed: 0.5,
} as const;

export type MistRollUniforms = {
    uTime: IUniform<number>;
    uMotion: IUniform<number>;
    uLit: IUniform<Color>;
    uShade: IUniform<Color>;
    uOpacity: IUniform<number>;
    /** Every form's lobes, `mistRollLobeSlots` to a form: centre, radii. */
    uLobe: IUniform<Vector4[]>;
    /** Lobe weights, one per slot; 0 skips the slot. */
    uLobeWeight: IUniform<number[]>;
    /** Each form's half height (form units), for the top-to-base shading. */
    uFormHalfHeight: IUniform<number[]>;
};

function glslFloat(value: number) {
    return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

const vertexShader = /* glsl */ `
attribute vec4 aRoll;
attribute float aForm;
uniform float uTime;
uniform float uMotion;
varying vec2 vLocal;
varying float vRollOpacity;
varying float vForm;
varying float vPhase;

void main() {
    mat4 model = modelMatrix * instanceMatrix;
    vec3 centre = ( model * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
    // The roll's length in the world (along its edge, or the screen's
    // right for a sky roll) and its height.
    vec3 along = model[ 0 ].xyz;
    float height = length( model[ 1 ].xyz );
    vec3 toCamera = isOrthographic
        ? vec3( viewMatrix[ 0 ][ 2 ], viewMatrix[ 1 ][ 2 ], viewMatrix[ 2 ][ 2 ] )
        : cameraPosition - centre;
    // The quad holds the roll's own axis, so a rim roll lies along its edge
    // at a fixed distance, and turns its height to face the camera, so it
    // shows its full height from any side.
    vec3 side = cross( normalize( toCamera ), normalize( along ) );
    float sideLength = length( side );
    vec3 up = sideLength > 1e-4 ? side / sideLength : vec3( 0.0, 1.0, 0.0 );
    if ( up.y < 0.0 ) up = -up;
    vec3 world = centre + along * position.x + up * height * position.y;
    // Slide along the roll and bob a little; still under reduced motion.
    world += normalize( along ) * aRoll.y * sin( uTime * ${glslFloat(mistRollMaterialRules.slideSpeed)} + aRoll.w ) * uMotion;
    world.y += aRoll.z * sin( uTime * ${glslFloat(mistRollMaterialRules.bobSpeed)} + aRoll.w ) * uMotion;
    vLocal = position.xy;
    vRollOpacity = aRoll.x;
    vForm = aForm;
    vPhase = aRoll.w;
    gl_Position = projectionMatrix * viewMatrix * vec4( world, 1.0 );
}
`;

function createFragmentShader(forms: number) {
    const rules = mistRollMaterialRules;
    const [lx, ly, lz] = rules.lightDirection;
    return /* glsl */ `
#define FORMS ${forms}
#define LOBES ${mistRollLobeSlots}
#define OCTAVES ${rules.octaves}
uniform vec3 uLit;
uniform vec3 uShade;
uniform float uOpacity;
uniform float uTime;
uniform float uMotion;
uniform vec4 uLobe[ FORMS * LOBES ];
uniform float uLobeWeight[ FORMS * LOBES ];
uniform float uFormHalfHeight[ FORMS ];
varying vec2 vLocal;
varying float vRollOpacity;
varying float vForm;
varying float vPhase;

float hash12( vec2 p ) {
    vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
    p3 += dot( p3, p3.yzx + 33.33 );
    return fract( ( p3.x + p3.y ) * p3.z );
}
float vnoise( vec2 p ) {
    vec2 i = floor( p );
    vec2 f = fract( p );
    vec2 u = f * f * ( 3.0 - 2.0 * f );
    return mix(
        mix( hash12( i ), hash12( i + vec2( 1.0, 0.0 ) ), u.x ),
        mix( hash12( i + vec2( 0.0, 1.0 ) ), hash12( i + vec2( 1.0, 1.0 ) ), u.x ),
        u.y
    );
}
// Analytic value-noise octaves, only to fray the soft edge (as the band).
float fbm( vec2 p ) {
    float s = 0.0;
    float a = 0.5;
    float norm = 0.0;
    for ( int i = 0; i < OCTAVES; i++ ) {
        s += a * vnoise( p );
        norm += a;
        p = p * 2.07 + vec2( 17.3, 9.1 );
        a *= 0.5;
    }
    return s / norm;
}
// The band's soft lobe with compact support: 1 at the centre, 0 at the radius.
float bump( vec2 d ) {
    float q = clamp( 1.0 - dot( d, d ), 0.0, 1.0 );
    return q * q;
}

void main() {
    int form = int( clamp( floor( vForm + 0.5 ), 0.0, float( FORMS - 1 ) ) );
    vec2 q = vLocal;
    vec3 light = normalize( vec3( ${glslFloat(lx)}, ${glslFloat(ly)}, ${glslFloat(lz)} ) );
    float d = 0.0;
    float lam = 0.0;
    float wsum = 1e-6;
    for ( int k = 0; k < LOBES; k++ ) {
        int idx = form * LOBES + k;
        float weight = uLobeWeight[ idx ];
        if ( weight <= 0.0 ) continue;
        vec4 lobe = uLobe[ idx ];
        vec2 dd = ( q - lobe.xy ) / lobe.zw;
        float f = weight * bump( dd );
        d += f;
        // Each lobe shades like a soft ball; the densest lobe at a point wins.
        float w = f * f * f + 1e-6;
        vec3 nrm = normalize( vec3( dd, sqrt( max( 0.0, 1.0 - dot( dd, dd ) ) ) + 0.2 ) );
        lam += w * dot( nrm, light );
        wsum += w;
    }
    if ( d <= 0.0 ) discard;
    lam /= wsum;
    // Fray only the soft edge, fading in from the support's rim, so the
    // mist never ends in a cut.
    float n = fbm(
        q * ${glslFloat(rules.noiseScale)} +
        vec2( vPhase, vPhase * 0.37 ) +
        vec2( uTime * ${glslFloat(rules.noiseDrift)} * uMotion, 0.0 )
    );
    float fray = smoothstep( 0.0, ${glslFloat(rules.frayIn)}, d ) * ( 1.0 - smoothstep( ${glslFloat(rules.frayOut[0])}, ${glslFloat(rules.frayOut[1])}, d ) );
    float de = d + ( n - 0.5 ) * ${glslFloat(rules.erosion)} * fray;
    float coverage = smoothstep( ${glslFloat(rules.coverage[0])}, ${glslFloat(rules.coverage[1])}, de );
    float body = mix( ${glslFloat(rules.edgeBody)}, 1.0, smoothstep( ${glslFloat(rules.bodyFrom)}, ${glslFloat(rules.coreDensity)}, d ) );
    float alpha = uOpacity * vRollOpacity * coverage * body;
    if ( alpha < 0.002 ) discard;
    // Lighter top, the low role toward the base, soft lobe volume.
    float t = clamp( 0.5 + 0.5 * q.y / max( uFormHalfHeight[ form ], 1e-4 ), 0.0, 1.0 );
    float s = ${glslFloat(rules.shadeBase)} +
        ${glslFloat(rules.shadeLow)} * ( 1.0 - smoothstep( 0.0, ${glslFloat(rules.shadeRamp)}, t ) ) -
        ${glslFloat(rules.shadeLobe)} * ( lam - 0.5 );
    vec3 color = mix( uLit, uShade, clamp( s, 0.0, 1.0 ) );
    gl_FragColor = vec4( color, alpha );
    #include <colorspace_fragment>
}
`;
}

/** The shared roll material; `time` is the scene clock uniform. */
export function createMistRollMaterial(time: IUniform<number>) {
    const forms = getMistRollGeometryData();
    const slots = forms.length * mistRollLobeSlots;
    const uniforms: MistRollUniforms = {
        uTime: time,
        uMotion: { value: 1 },
        uLit: { value: new Color() },
        uShade: { value: new Color() },
        uOpacity: { value: 0 },
        // Empty slots keep radius 1 and weight 0.
        uLobe: {
            value: Array.from({ length: slots }, () => new Vector4(0, 0, 1, 1)),
        },
        uLobeWeight: { value: Array.from({ length: slots }, () => 0) },
        uFormHalfHeight: { value: forms.map((form) => form.size[1] / 2) },
    };
    forms.forEach((form, formIndex) => {
        form.lobes.slice(0, mistRollLobeSlots).forEach((lobe, lobeIndex) => {
            const slot = formIndex * mistRollLobeSlots + lobeIndex;
            const [cx, cy, rx, ry, weight] = lobe;
            uniforms.uLobe.value[slot]?.set(cx, cy, rx, ry);
            uniforms.uLobeWeight.value[slot] = weight;
        });
    });
    const material = new ShaderMaterial({
        name: 'Weather:MistRollMaterial',
        uniforms,
        vertexShader,
        fragmentShader: createFragmentShader(Math.max(1, forms.length)),
        transparent: true,
        depthWrite: false,
        depthTest: true,
        // A roll's axis may point either way along its edge, which turns
        // the quad's winding: both faces draw the same soft form.
        side: DoubleSide,
        fog: false,
        toneMapped: false,
    });
    return { material, uniforms };
}
