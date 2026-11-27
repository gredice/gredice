import {
    weatherSnowLightFloor,
    weatherSnowLightTint,
    weatherSnowSunlitGain,
} from '../scene/weatherSurfaceMaterial';

/**
 * Snow that is starting to settle or melting (GAME_ART.md "Weather >
 * Snow"): below `opaqueFrom` snow amount the overlay is a translucent,
 * even dusting whose opacity ramps smoothly with the amount on each face
 * (`ramp`, on the amount times the face's slope cover), worked out per
 * fragment without the per-vertex noise, so it never shows the mesh's
 * triangles. From `opaqueFrom` it is opaque again (the full-cover look,
 * cut by the noise), so fully covered props stay in the static cache.
 */
export const snowCoverRules = {
    ramp: [0.02, 0.12],
    opaqueFrom: 0.3,
    /**
     * Share of a slow-settling surface's settle range (`settleCm`) after
     * which its dusting grows its thickness, reaching the normal thickness
     * at the end of the range. Before it the see-through dusting lies flat,
     * so its edge skirts draw no light lines along tile joints (grass: below
     * about 2.9 cm). From it the snow thickens with the cover, so grass has
     * its normal thickness from 3.5 cm: tufts and lips bury gradually,
     * verges show no green line, and the integrated ground snow (from
     * 5.4 cm) and the opaque cover (from 6 cm) take over without a height
     * step.
     */
    settleThicknessFrom: 0.8,
} as const;

/**
 * Centimetres of lying snow that make full snow coverage (1): the scene
 * maps the weather's `snowAccumulation` to `snowCoverage` as cm / 30
 * (`scene/Environment.tsx` reads this constant). Also turns a preset's
 * `settleCm` into the overlay's snow amount, so the two always agree.
 */
export const lyingSnowFullCoverageCm = 30;

/**
 * The overlay's snow amount range over which a surface with `settleCm`
 * goes from no dusting to its full partial-cover look: centimetres of lying
 * snow through the coverage scale, times the surface's coverage multiplier
 * (its snow amount is the game coverage times that multiplier).
 */
export function resolveSnowSettleAmountRange(
    settleCm: readonly [number, number],
    coverageMultiplier: number,
) {
    return [
        (settleCm[0] / lyingSnowFullCoverageCm) * coverageMultiplier,
        (settleCm[1] / lyingSnowFullCoverageCm) * coverageMultiplier,
    ] as const;
}

/**
 * How much of its partial-cover look a surface shows at this snow amount
 * (the CPU twin of the overlay fragment's settle factor): a linear rise over
 * the settle range, 1 without one.
 */
export function resolveSnowSettle(
    amount: number,
    settleRange: readonly [number, number] | undefined,
) {
    if (!settleRange) return 1;
    const span = Math.max(settleRange[1] - settleRange[0], 0.0001);
    return Math.min(1, Math.max(0, (amount - settleRange[0]) / span));
}

/**
 * The share of its normal thickness a slow-settling surface's snow has at
 * this snow amount (the CPU twin of the overlay vertex's settle thickness):
 * none while the dusting is see-through, a smooth rise over the last part
 * of the settle range (`snowCoverRules.settleThicknessFrom`), 1 without one.
 */
export function resolveSnowSettleThickness(
    amount: number,
    settleRange: readonly [number, number] | undefined,
) {
    if (!settleRange) return 1;
    const from =
        settleRange[0] +
        (settleRange[1] - settleRange[0]) * snowCoverRules.settleThicknessFrom;
    const span = Math.max(settleRange[1] - from, 0.0001);
    const t = Math.min(1, Math.max(0, (amount - from) / span));
    return t * t * (3 - 2 * t);
}

export const snowOverlayVertexShader = `
#include <common>
#include <fog_pars_vertex>

attribute float aSnowLayer;

uniform float uSnowAmount;
uniform float uMaxThickness;
uniform float uSlopeExponent;
uniform float uNoiseScale;
uniform float uNoiseAmplitude;
uniform vec3 uBoundsMin;
uniform vec3 uBoundsMax;
// x, y: the up-facing range that takes full cover; z: 1 when set.
uniform vec3 uSlopeRange;
// The settle range (see the fragment); y > 0 marks a slow-settling surface.
uniform vec2 uSnowSettle;

varying float vCoverage;
varying float vNoise;
varying vec3 vNormal;
varying float vThickness;
varying float vSideDepth;
varying float vSideFactor;

float hash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);

    float n000 = hash(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash(i + vec3(1.0, 1.0, 1.0));

    vec3 u = f * f * (3.0 - 2.0 * f);

    float nx00 = mix(n000, n100, u.x);
    float nx10 = mix(n010, n110, u.x);
    float nx01 = mix(n001, n101, u.x);
    float nx11 = mix(n011, n111, u.x);

    float nxy0 = mix(nx00, nx10, u.y);
    float nxy1 = mix(nx01, nx11, u.y);

    return mix(nxy0, nxy1, u.z) * 2.0 - 1.0;
}

void main() {
    vec3 transformed = position;
    vec3 normalDir = normalize(normal);
    mat4 snowObjectMatrix = modelMatrix;
    #ifdef USE_INSTANCING
        snowObjectMatrix = modelMatrix * instanceMatrix;
    #endif
    mat3 modelRot = mat3(snowObjectMatrix);
    vec3 worldUp = vec3(0.0, 1.0, 0.0);
    vec3 up = normalize(transpose(modelRot) * worldUp);
    vec3 worldNormal = normalize(modelRot * normalDir);

    float slopeAlignment = clamp(dot(worldNormal, worldUp), 0.0, 1.0);
    float slopeCoverage = pow(slopeAlignment, uSlopeExponent);
    // A lighter canopy cap is covered all over (GAME_ART.md "Weather >
    // Snow"): every face down to a steep underside takes the cover and the
    // shell grows along its normals, so no green crescent shows below it.
    float slopeRangeCover = uSlopeRange.z * smoothstep(
        uSlopeRange.x,
        uSlopeRange.y,
        dot(worldNormal, worldUp)
    );
    slopeCoverage = mix(slopeCoverage, slopeRangeCover, uSlopeRange.z);

    float n = noise(transformed * uNoiseScale);
    float baseThickness = uMaxThickness * (1.0 + n * uNoiseAmplitude);

    vec3 boundsCenter = 0.5 * (uBoundsMax + uBoundsMin);
    vec3 boundsHalfSize = 0.5 * (uBoundsMax - uBoundsMin);
    vec3 worldCenter = (snowObjectMatrix * vec4(boundsCenter, 1.0)).xyz;
    vec3 worldPos = (snowObjectMatrix * vec4(position, 1.0)).xyz;
    float worldCenterHeight = dot(worldUp, worldCenter);
    vec3 axisX = modelRot[0];
    vec3 axisY = modelRot[1];
    vec3 axisZ = modelRot[2];
    float projectionX = abs(dot(worldUp, axisX)) * boundsHalfSize.x;
    float projectionY = abs(dot(worldUp, axisY)) * boundsHalfSize.y;
    float projectionZ = abs(dot(worldUp, axisZ)) * boundsHalfSize.z;
    float worldTop = worldCenterHeight + projectionX + projectionY + projectionZ;
    float distanceFromTop = max(worldTop - dot(worldUp, worldPos), 0.0);
    float safeThickness = max(baseThickness, 0.0001);

    float sideFactor =
        (1.0 - smoothstep(0.4, 0.85, slopeAlignment)) * (1.0 - uSlopeRange.z);
    float distanceForSide = mix(distanceFromTop, 0.0, sideFactor);
    float sideBand = clamp(1.0 - distanceForSide / safeThickness, 0.0, 1.0);
    float coverage = clamp(uSnowAmount * mix(slopeCoverage, sideBand, sideFactor), 0.0, 1.0);

    float thickness = coverage * baseThickness;
    float sideDisplacement = clamp(thickness - distanceForSide, 0.0, thickness);
    float vertexLayer = clamp(aSnowLayer, 0.0, 1.0);
    float displacementAmount = mix(thickness, sideDisplacement, sideFactor) * vertexLayer;
    // A slow-settling surface's see-through dusting lies flat on it: no
    // thickness, so its edge skirts close to nothing and draw no light line
    // along tile joints. Over the last part of its settle range it grows
    // its normal thickness, so the integrated ground snow and the opaque
    // cover take over without a height step.
    if (uSnowSettle.y > 0.00001) {
        displacementAmount *= smoothstep(
            mix(
                uSnowSettle.x,
                uSnowSettle.y,
                ${snowCoverRules.settleThicknessFrom.toFixed(3)}
            ),
            uSnowSettle.y,
            uSnowAmount
        );
    }
    vec3 displacementDir = normalize(mix(normalDir, up, sideFactor));

    transformed += displacementDir * displacementAmount;

    vCoverage = coverage;
    vNoise = n;
    vec3 transformedNormal = normalDir;
    #ifdef USE_INSTANCING
        transformedNormal = normalize(mat3(instanceMatrix) * transformedNormal);
    #endif
    vNormal = normalize(normalMatrix * transformedNormal);
    vThickness = thickness;
    vSideDepth = distanceForSide;
    vSideFactor = sideFactor;

    vec4 transformedPosition = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
        transformedPosition = instanceMatrix * transformedPosition;
    #endif
    vec4 mvPosition = modelViewMatrix * transformedPosition;
    gl_Position = projectionMatrix * mvPosition;

    #include <fog_vertex>
}
`;

export const snowOverlayFragmentShader = `
#include <common>
#include <fog_pars_fragment>
#include <lights_pars_begin>

uniform vec3 uSnowColor;
uniform float uNoiseInfluence;
// 1 while the overlay blends a partial dusting, 0 once it is opaque.
uniform float uSnowBlend;
uniform float uSnowAmount;
// x, y: the snow amount over which a slow-settling surface (grass) grows
// its dusting from none to the full partial cover; (-1, 0) settles at once.
uniform vec2 uSnowSettle;

varying float vCoverage;
varying float vNoise;
varying vec3 vNormal;
varying float vThickness;
varying float vSideDepth;
varying float vSideFactor;

void main() {
    float coverage = clamp(vCoverage + vNoise * uNoiseInfluence, 0.0, 1.0);
    float cover = clamp(vCoverage, 0.0, 1.0);

    if (vSideFactor > 0.001 && vThickness > 0.0001) {
        float normalizedSide = clamp((vThickness - vSideDepth) / vThickness, 0.0, 1.0);
        float sideShare = mix(1.0, normalizedSide, clamp(vSideFactor, 0.0, 1.0));
        coverage *= sideShare;
        cover *= sideShare;
    }
    float strength = smoothstep(0.05, 0.85, coverage);
    // A partial dusting fades in evenly; full cover keeps its noisy edge.
    float alpha = smoothstep(
        ${snowCoverRules.ramp[0].toFixed(3)},
        ${snowCoverRules.ramp[1].toFixed(3)},
        cover
    );
    // A slow-settling surface (grass) takes a light, even dusting first and
    // the full cover only by the end of its settle range; one factor for
    // the whole surface, so tile joints never show.
    alpha *= clamp(
        (uSnowAmount - uSnowSettle.x) /
            max(uSnowSettle.y - uSnowSettle.x, 0.0001),
        0.0,
        1.0
    );

    if (uSnowBlend > 0.5 ? alpha < 0.004 : strength < 0.01) {
        discard;
    }

    vec3 normal = normalize(vNormal);

    // Lit like the covered path of the integrated weather surface: the scene
    // lights, scaled so uSnowColor is what a sunlit top shows at midday, then
    // tone mapped and colour converted like every other surface, so snow
    // never clips to paper white and turns blue-violet at night.
    vec3 totalLight = ambientLightColor;
    #if NUM_HEMI_LIGHTS > 0
        for (int i = 0; i < NUM_HEMI_LIGHTS; i++) {
            totalLight += getHemisphereLightIrradiance(
                hemisphereLights[i],
                normal
            );
        }
    #endif
    #if NUM_DIR_LIGHTS > 0
        for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
            totalLight +=
                directionalLights[i].color *
                max(dot(normal, directionalLights[i].direction), 0.0);
        }
    #endif

    // The same share of the light's tint as the integrated ground snow, so
    // snow on props and on the ground match.
    totalLight = mix(
        vec3(dot(totalLight, vec3(0.2126, 0.7152, 0.0722))),
        totalLight,
        ${weatherSnowLightTint.toFixed(2)}
    );

    vec3 baseSnow = mix(uSnowColor * 0.85, uSnowColor, strength);
    // Never darker than the light floor, like the integrated snow.
    gl_FragColor = vec4(
        max(
            baseSnow *
                totalLight *
                (RECIPROCAL_PI / ${weatherSnowSunlitGain.toFixed(2)}),
            baseSnow * ${weatherSnowLightFloor.toFixed(2)}
        ),
        uSnowBlend > 0.5 ? alpha : 1.0
    );

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
}
`;
