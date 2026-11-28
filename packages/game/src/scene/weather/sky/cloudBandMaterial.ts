import {
    GreaterDepth,
    type IUniform,
    LessEqualDepth,
    ShaderMaterial,
    Vector2,
    Vector3,
    Vector4,
} from 'three';
import {
    type BandCloudShape,
    bandCloudLobes,
    bandColumns,
    cloudBandRules,
} from './cloudBand';

/**
 * The cloud band shader (GAME_ART.md "Weather > Clouds and overcast"): one
 * screen-space pass draws every band cloud and the overcast deck from soft
 * analytic lobes, no textures and no meshes. A port of the revised target's
 * band shader (`docs/game-party-style/weather-scene.html`).
 *
 * Two materials share every uniform: the sky pass (depth test LessEqual at
 * the far plane, so it draws only where no garden wrote depth) also adds
 * the haze toward the cloud tone down to mid-screen; the over-garden pass
 * (GreaterDepth) draws the band translucent where it hangs over the garden
 * (decision D1), never more than 10% of the view height below the garden's
 * top. Both are unlit: colours are the sRGB colour roles, written as they
 * are, so clouds stay light at every light level.
 *
 * Pixels are CSS pixels from the view's top-left corner, y down, as in the
 * target.
 */
export type CloudBandUniforms = {
    /** View size in CSS px and drawing-buffer px per CSS px. */
    uView: IUniform<Vector2>;
    uPixelRatio: IUniform<number>;
    uTime: IUniform<number>;
    /** Lobes of every cloud: centre x, y, radius x, y (local px). */
    uLobe: IUniform<Vector4[]>;
    /** Lobe weights, four to a vector; 0 skips the lobe. */
    uLobeAmp: IUniform<Vector4[]>;
    /** Per cloud: base centre x, base y (px), scale, alpha (0 hides it). */
    uCloudPos: IUniform<Vector4[]>;
    /** Per cloud: local bounds min x, min y, max x, max y. */
    uCloudBox: IUniform<Vector4[]>;
    /** Per cloud: tone offset, edge erosion, height (px), shape phase. */
    uCloudLook: IUniform<Vector4[]>;
    /** Deck opacity, how far it has grown down, scroll (px), seed. */
    uDeck: IUniform<number>;
    uDeckGrow: IUniform<number>;
    uDeckScroll: IUniform<number>;
    uDeckSeed: IUniform<number>;
    /** The band's lower limit per screen column (px), four to a vector. */
    uLimit: IUniform<Vector4[]>;
    /** Rain and storm decks lean cooler and greyer (0 to about 0.22). */
    uGrey: IUniform<number>;
    /** Lit top, shaded base and rim colours (sRGB). */
    uLit: IUniform<Vector3>;
    uShade: IUniform<Vector3>;
    uRim: IUniform<Vector3>;
    /** The sun or moon on screen (px): clouds are lit from its side. */
    uSunPx: IUniform<Vector2>;
    /** The bolt's warm glow around its root: colour, x, y, radius (px). */
    uGlowColor: IUniform<Vector3>;
    uGlowPos: IUniform<Vector3>;
    uGlow: IUniform<number>;
    /** Haze toward the cloud tone: amount, colour, full at this height (0 bottom, 1 top). */
    uHaze: IUniform<number>;
    uHazeColor: IUniform<Vector3>;
    uHazeFull: IUniform<number>;
};

/** Per pass: its alpha scale, the quad's lower edge (NDC) and the haze switch. */
export type CloudBandPassUniforms = CloudBandUniforms & {
    uOver: IUniform<number>;
    uBottomNdc: IUniform<number>;
    uHazeOn: IUniform<number>;
};

/** The band draws after rain (35), snow (36, 37) and the bolt (26). */
export const cloudBandRenderOrder = 38;

export function createCloudBandUniforms(
    clouds: readonly BandCloudShape[],
    seed = 1,
): CloudBandUniforms {
    const count = Math.max(1, clouds.length);
    const lobeCount = count * bandCloudLobes;
    const uniforms: CloudBandUniforms = {
        uView: { value: new Vector2(1280, 800) },
        uPixelRatio: { value: 1 },
        uTime: { value: 0 },
        // Vector4 defaults w to 1: start every slot empty instead.
        uLobe: {
            value: Array.from(
                { length: lobeCount },
                () => new Vector4(0, 0, 1, 1),
            ),
        },
        uLobeAmp: {
            value: Array.from(
                { length: Math.ceil(lobeCount / 4) },
                () => new Vector4(0, 0, 0, 0),
            ),
        },
        uCloudPos: {
            value: Array.from({ length: count }, () => new Vector4(0, 0, 1, 0)),
        },
        uCloudBox: {
            value: Array.from({ length: count }, () => new Vector4()),
        },
        uCloudLook: {
            value: Array.from({ length: count }, () => new Vector4()),
        },
        uDeck: { value: 0 },
        uDeckGrow: { value: 0 },
        uDeckScroll: { value: 0 },
        uDeckSeed: { value: seed * 1.37 },
        uLimit: {
            value: Array.from(
                { length: bandColumns / 4 },
                () => new Vector4(240, 240, 240, 240),
            ),
        },
        uGrey: { value: 0 },
        uLit: { value: new Vector3(0.97, 0.96, 1) },
        uShade: { value: new Vector3(0.77, 0.8, 0.96) },
        uRim: { value: new Vector3(0.98, 0.98, 1) },
        uSunPx: { value: new Vector2(120, 100) },
        uGlowColor: { value: new Vector3(1, 0.95, 0.82) },
        uGlowPos: { value: new Vector3(0, 0, 60) },
        uGlow: { value: 0 },
        uHaze: { value: 0 },
        uHazeColor: { value: new Vector3(0.9, 0.9, 1) },
        uHazeFull: { value: 0.7 },
    };
    clouds.forEach((cloud, index) => {
        cloud.lobes.forEach(([x, y, radiusX, radiusY, weight], lobe) => {
            const slot = index * bandCloudLobes + lobe;
            uniforms.uLobe.value[slot]?.set(x, y, radiusX, radiusY);
            uniforms.uLobeAmp.value[Math.floor(slot / 4)]?.setComponent(
                slot % 4,
                weight,
            );
        });
        uniforms.uCloudBox.value[index]?.set(...cloud.box);
        uniforms.uCloudLook.value[index]?.set(
            cloud.tone,
            cloud.erosion,
            cloud.height,
            cloud.phase,
        );
    });
    return uniforms;
}

const cloudBandVertexShader = /* glsl */ `
uniform float uBottomNdc;
void main() {
    // Only the band (and, in the sky pass, the haze) is drawn: from the top
    // edge down to its lower edge, at the far plane.
    gl_Position = vec4(position.x, position.y > 0.0 ? 1.0 : uBottomNdc, 0.999999, 1.0);
}
`;

function cloudBandFragmentShader(clouds: number, octaves: number) {
    const lobes = clouds * bandCloudLobes;
    return /* glsl */ `
precision highp float;
#define BAND_CLOUDS ${clouds}
#define LOBES ${bandCloudLobes}
#define BAND_COLS ${bandColumns}
#define OCTAVES ${octaves}
uniform vec2 uView, uSunPx;
uniform float uPixelRatio, uOver, uHazeOn;
uniform float uTime, uDeck, uDeckGrow, uDeckScroll, uDeckSeed, uGrey, uGlow;
uniform float uHaze, uHazeFull;
uniform vec4 uLimit[${bandColumns / 4}];
uniform vec4 uLobe[${lobes}];
uniform vec4 uLobeAmp[${Math.ceil(lobes / 4)}];
uniform vec4 uCloudPos[BAND_CLOUDS];
uniform vec4 uCloudBox[BAND_CLOUDS];
uniform vec4 uCloudLook[BAND_CLOUDS];
uniform vec3 uLit, uShade, uRim, uGlowColor, uGlowPos, uHazeColor;

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
        mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x),
        u.y
    );
}
// Analytic value-noise octaves, only to fray the soft edges.
float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    float norm = 0.0;
    for (int i = 0; i < OCTAVES; i++) {
        s += a * vnoise(p);
        norm += a;
        p = p * 2.07 + vec2(17.3, 9.1);
        a *= 0.5;
    }
    return s / norm;
}
// A soft lobe with compact support: 1 at the centre, 0 at the radius.
float bump(vec2 d) {
    float q = clamp(1.0 - dot(d, d), 0.0, 1.0);
    return q * q;
}
// The band's lower limit at a screen x (CSS px).
float limitAt(float x) {
    float f = clamp(x / uView.x * float(BAND_COLS) - 0.5, 0.0, float(BAND_COLS - 1));
    int c0 = int(floor(f));
    int c1 = min(c0 + 1, BAND_COLS - 1);
    return mix(uLimit[c0 / 4][c0 - 4 * (c0 / 4)], uLimit[c1 / 4][c1 - 4 * (c1 / 4)], f - float(c0));
}
vec3 greyed(vec3 c) {
    return mix(c, vec3(dot(c, vec3(0.3, 0.55, 0.15))), uGrey);
}
float hangShade(vec2 d) {
    return dot(normalize(vec3(d, sqrt(max(0.0, 1.0 - dot(d, d))) + 0.3)), normalize(vec3(0.25, -0.75, 0.6)));
}

void main() {
    // CSS px, y down.
    vec2 p = vec2(gl_FragCoord.x, uView.y * uPixelRatio - gl_FragCoord.y) / uPixelRatio;
    float L = limitAt(p.x);
    vec3 accC = vec3(0.0); // premultiplied
    float accA = 0.0;
    if (p.y < L + 1.0) {
        // ---- the overcast deck: one continuous layer across the band
        if (uDeck > 0.001) {
            float x = p.x + uDeckScroll;
            // Its soft lower edge ends at the limit; E is about where it is
            // half see-through. It grows down as cover rises.
            float F = clamp(0.42 * L, 34.0, 80.0);
            float E = mix(0.25 * (L - F), L - F, uDeckGrow);
            float body = smoothstep(E + 0.1 * F, E - 0.9 * F, p.y);
            float hang = 0.0;
            float hangS = 0.0;
            float hangW = 1e-5;
            // A row of large masses hanging along the edge...
            float cw = 210.0;
            float j0 = floor(x / cw);
            for (int k = -1; k <= 1; k++) {
                float j = j0 + float(k);
                float h1 = hash12(vec2(j, uDeckSeed));
                float h2 = hash12(vec2(j, uDeckSeed + 7.1));
                float h3 = hash12(vec2(j, uDeckSeed + 3.7));
                float h4 = hash12(vec2(j, uDeckSeed + 11.3));
                float rx = cw * mix(0.45, 0.95, h2);
                float ry = F * mix(0.35, 0.98, h3);
                vec2 d = vec2((x - (j + 0.5 + (h1 - 0.5) * 0.7) * cw) / rx, (p.y - (E - ry * 0.7 * h4)) / ry);
                float f = mix(0.7, 1.05, h3) * bump(d);
                hang += f;
                hangS += f * f * f * hangShade(d);
                hangW += f * f * f;
            }
            // ...a smaller row with gaps: a ragged, undulating lip...
            float cw2 = 128.0;
            float x2 = x + 53.0;
            float i0 = floor(x2 / cw2);
            for (int k = -1; k <= 1; k++) {
                float j = i0 + float(k);
                float g1 = hash12(vec2(j, uDeckSeed + 21.0));
                float g2 = hash12(vec2(j, uDeckSeed + 27.3));
                float g3 = hash12(vec2(j, uDeckSeed + 31.9));
                float amp = g1 < 0.35 ? 0.0 : mix(0.45, 0.8, g2);
                float rx = cw2 * mix(0.4, 0.62, g2);
                float ry = F * mix(0.32, 0.5, g3);
                vec2 d = vec2((x2 - (j + 0.5 + (g3 - 0.5) * 0.5) * cw2) / rx, (p.y - (E + F * 0.1)) / ry);
                float f = amp * bump(d);
                hang += f;
                hangS += f * f * f * hangShade(d);
                hangW += f * f * f;
            }
            // ...and small lumps at random heights with gaps, so the lip is
            // ragged rather than a smooth scallop.
            float cw3 = 74.0;
            float x3 = x + 17.0;
            float l0 = floor(x3 / cw3);
            for (int k = -1; k <= 1; k++) {
                float j = l0 + float(k);
                float e1 = hash12(vec2(j, uDeckSeed + 41.0));
                float e2 = hash12(vec2(j, uDeckSeed + 45.7));
                float e3 = hash12(vec2(j, uDeckSeed + 49.3));
                float amp = e1 < 0.45 ? 0.0 : mix(0.4, 0.75, e2);
                float rx = cw3 * mix(0.45, 0.8, e3);
                float ry = F * mix(0.2, 0.34, e2);
                vec2 d = vec2((x3 - (j + 0.5 + (e3 - 0.5) * 0.6) * cw3) / rx, (p.y - (E + F * mix(-0.35, 0.3, e2))) / ry);
                float f = amp * bump(d);
                hang += f;
                hangS += f * f * f * hangShade(d);
                hangW += f * f * f;
            }
            float D = body + hang;
            float n = fbm(vec2(x / 40.0, p.y / 26.0) + vec2(uDeckSeed, uTime * 0.02));
            float De = D + (n - 0.5) * 0.65 * (1.0 - smoothstep(0.35, 1.1, D));
            float cov = smoothstep(0.05, 0.6, De);
            // Brighter and darker masses inside, toward shade lower down.
            float masses = fbm(vec2(x / 240.0, p.y / 90.0) + vec2(uDeckSeed * 1.7, 4.0));
            // Hanging masses: lit from above, darker undersides.
            float lobeL = hangS / hangW * smoothstep(0.05, 0.5, hang);
            float s = 0.24 + 0.38 * smoothstep(0.1, 1.05, p.y / max(E, 1.0)) + (masses - 0.5) * 1.1 - 0.3 * lobeL;
            vec3 c = greyed(mix(uLit, uShade, clamp(s, 0.0, 1.0)));
            float a = uDeck * cov * mix(0.8, 0.92, smoothstep(E, 0.0, p.y));
            accC = c * a;
            accA = a;
        }
        // ---- separate clouds, back to front
        vec2 toSunBase = uSunPx;
        for (int i = 0; i < BAND_CLOUDS; i++) {
            vec4 cp = uCloudPos[i];
            if (cp.w <= 0.001) continue;
            vec2 q = (p - cp.xy) / cp.z;
            vec4 bx = uCloudBox[i];
            if (q.x < bx.x || q.x > bx.z || q.y < bx.y || q.y > bx.w) continue;
            vec4 look = uCloudLook[i];
            float d = 0.0;
            vec2 N = vec2(0.0);
            float lam = 0.0;
            float wsum = 0.0;
            vec2 toSun = normalize(toSunBase - p + vec2(1e-3, 0.0));
            // Light from the sun's side and a little from the front.
            vec3 Ldir = normalize(vec3(toSun, 0.75));
            for (int k = 0; k < LOBES; k++) {
                int idx = i * LOBES + k;
                float amp = uLobeAmp[idx / 4][idx - 4 * (idx / 4)];
                if (amp <= 0.0) continue;
                vec4 lobe = uLobe[idx];
                // Shapes change very slowly.
                float ph = float(k) * 1.7 + look.w;
                vec2 rr = lobe.zw * (1.0 + 0.05 * sin(uTime * 0.11 + ph));
                vec2 c = lobe.xy + vec2(3.0 * sin(uTime * 0.07 + ph * 1.3), 1.5 * sin(uTime * 0.09 + ph));
                vec2 dd = (q - c) / rr;
                float f = amp * bump(dd);
                d += f;
                N += f * dd;
                // Each lobe shades like a soft ball; the densest lobe at a
                // point wins, so the puffs read one by one.
                float w = f * f * f + 1e-6;
                vec3 nrm = normalize(vec3(dd, sqrt(max(0.0, 1.0 - dot(dd, dd))) + 0.2));
                lam += w * dot(nrm, Ldir);
                wsum += w;
            }
            if (d <= 0.0) continue;
            lam /= wsum;
            float hgt = look.z;
            // A flatter, slightly ragged base.
            float rag = (vnoise(vec2(q.x / 24.0, look.w)) - 0.5) * 0.12 * hgt;
            float base = smoothstep(0.12 * hgt, -0.05 * hgt, q.y + rag);
            float n = fbm(q / 30.0 + vec2(look.w, look.w * 0.37) + vec2(uTime * 0.015, 0.0));
            float de = (d + (n - 0.5) * 0.5 * look.y * (1.0 - smoothstep(0.3, 1.0, d))) * mix(1.0, base, look.y > 1.3 ? 0.7 : 1.0);
            float cov = smoothstep(0.04, 0.55, de);
            float op = mix(0.6, 0.9, smoothstep(0.4, 1.3, d));
            float a = clamp(cov * op * cp.w, 0.0, 0.92);
            // Gentle volume: lit tops, lavender-grey bases, lobe undersides a
            // little darker, the side toward the sun lighter, and a soft
            // brighter rim on that side. Under the deck the light is diffuse:
            // flatter shading, a darker body that sits into the deck, no rim.
            float diffuse = uDeckGrow;
            float facing = dot(normalize(N + vec2(0.0, 1e-4)), toSun);
            float t = clamp(-q.y / hgt, 0.0, 1.0);
            float s = 0.42 - mix(0.5, 0.28, diffuse) * lam + 0.5 * (1.0 - smoothstep(0.0, 0.5, t)) + 0.22 * diffuse + look.x;
            vec3 col = greyed(mix(uLit, uShade, clamp(s, 0.0, 1.0)));
            float edge = 1.0 - smoothstep(0.2, 0.8, d);
            col = mix(col, uRim, 0.5 * (1.0 - diffuse) * edge * max(0.0, facing));
            accC = col * a + accC * (1.0 - a);
            accA = a + accA * (1.0 - a);
        }
    }
    vec3 col = accA > 1e-4 ? accC / accA : uHazeColor;
    // Storm glow: only around the bolt's root, at most 40%.
    float g = uGlow * exp(-pow(distance(p, uGlowPos.xy) / max(uGlowPos.z, 1.0), 2.0));
    col = mix(col, uGlowColor, clamp(g, 0.0, 0.4));
    // Nothing of a cloud reaches below the band's limit.
    float a = accA * smoothstep(L, L - 8.0, p.y);
    // The haze (sky pass only): full at the band, gone by mid-screen. It is
    // sky, so the garden in front stays clear.
    float hz = uHazeOn * uHaze * smoothstep(0.5, uHazeFull, 1.0 - p.y / uView.y);
    float outA = a + hz * (1.0 - a);
    if (outA < 0.002) discard;
    vec3 outC = (col * a + uHazeColor * hz * (1.0 - a)) / outA;
    gl_FragColor = vec4(outC, outA * uOver);
}
`;
}

/** Fewer noise octaves on lower tiers: the frayed edge costs most. */
export const cloudBandOctaves = { high: 4, medium: 3, low: 2 } as const;

/**
 * One pass of the band: `overGarden` false is the sky pass (drawn where no
 * garden wrote depth, with the haze), true the translucent pass over the
 * garden.
 */
export function createCloudBandMaterial(
    uniforms: CloudBandUniforms,
    {
        clouds,
        octaves,
        overGarden,
    }: { clouds: number; octaves: number; overGarden: boolean },
) {
    const passUniforms: CloudBandPassUniforms = {
        ...uniforms,
        uOver: {
            value: overGarden ? cloudBandRules.overGardenOpacity : 1,
        },
        uBottomNdc: { value: 0.4 },
        uHazeOn: { value: overGarden ? 0 : 1 },
    };
    const material = new ShaderMaterial({
        name: overGarden ? 'CloudBandOverGarden' : 'CloudBand',
        transparent: true,
        depthTest: true,
        depthFunc: overGarden ? GreaterDepth : LessEqualDepth,
        depthWrite: false,
        uniforms: passUniforms,
        vertexShader: cloudBandVertexShader,
        fragmentShader: cloudBandFragmentShader(
            Math.max(1, clouds),
            Math.max(1, octaves),
        ),
    });
    return { material, uniforms: passUniforms };
}
