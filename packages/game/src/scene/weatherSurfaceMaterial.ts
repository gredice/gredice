import type { ColorRepresentation, IUniform, Material } from 'three';
import { Color, MeshStandardMaterial, NormalBlending } from 'three';
import { getRainWetSheenColorUniform, rainWetLook } from '../rain/rainWetSheen';
import { getMaterialShaderHooksWithoutCloudShadowAttenuation } from './cloudShadowAttenuation';
import {
    getGardenMaterialShaderHookSignature,
    getGardenMaterialSignature,
    registerGardenMaterialShaderHooks,
} from './gardenMaterials';

const WEATHER_SURFACE_PLUGIN_VARIANT_KEY_PREFIX = 'gredice-weather-surface-v4';
const weatherUniformIds = new WeakMap<object, number>();
let nextWeatherUniformId = 0;

function weatherUniformKey(uniform: object | undefined) {
    if (!uniform) return 'none';
    let id = weatherUniformIds.get(uniform);
    if (id === undefined) {
        id = ++nextWeatherUniformId;
        weatherUniformIds.set(uniform, id);
    }
    return id;
}

type Vector3Tuple = readonly [number, number, number];

export type WeatherSurfacePluginMode = 'combined' | 'rain-only' | 'snow-only';

export type WeatherSurfacePluginActivation = {
    rainEnabled: boolean;
    snowEnabled: boolean;
};

export type WeatherSurfaceMaterialOptions = {
    frostIntensityUniform?: IUniform<number>;
    rain: {
        bounds: {
            max: Vector3Tuple;
            min: Vector3Tuple;
        };
        darkness: number;
        enabled: boolean;
        glossiness: number;
        puddleStrengthUniform: IUniform<number>;
        topSurfaceBias: number;
        wetnessUniform: IUniform<number>;
    };
    snow: {
        amountUniform: IUniform<number>;
        color: ColorRepresentation;
        enabled: boolean;
        lift: number;
        maxThickness: number;
        noiseAmplitude: number;
        noiseInfluence: number;
        noiseScale: number;
        slopeExponent: number;
    };
};

export function resolveWeatherSurfacePluginMode({
    rainEnabled,
    snowEnabled,
}: WeatherSurfacePluginActivation): WeatherSurfacePluginMode {
    if (rainEnabled && snowEnabled) {
        return 'combined';
    }
    if (rainEnabled) {
        return 'rain-only';
    }
    if (snowEnabled) {
        return 'snow-only';
    }
    throw new Error(
        'Integrated weather surface requires rain, snow, or both to be enabled.',
    );
}

export function getWeatherSurfacePluginVariantKey(
    mode: WeatherSurfacePluginMode,
) {
    return `${WEATHER_SURFACE_PLUGIN_VARIANT_KEY_PREFIX}:${mode}`;
}

function modeIncludesRain(mode: WeatherSurfacePluginMode) {
    return mode === 'rain-only' || mode === 'combined';
}

function modeIncludesSnow(mode: WeatherSurfacePluginMode) {
    return mode === 'snow-only' || mode === 'combined';
}

const weatherWorldPositionVertexPars = `
varying vec3 vGrediceWeatherWorldPosition;
`;

const weatherWorldNormalVertexPars = `
varying vec3 vGrediceWeatherWorldNormal;
`;

const weatherRainOnlyNormalVertexPars = `
varying float vGrediceWeatherWorldNormalY;
`;

const weatherSnowVertexPars = `
attribute float aWeatherSurface;
attribute float aSnowLayer;
attribute float aSnowTopDistance;

uniform float uGrediceSnowAmount;
uniform float uGrediceSnowLift;
uniform float uGrediceSnowMaxThickness;
uniform float uGrediceSnowNoiseAmplitude;
uniform float uGrediceSnowNoiseScale;
uniform float uGrediceSnowSlopeExponent;

varying float vGrediceSnowCoverage;
varying float vGrediceSnowNoise;
varying float vGrediceSnowSideDepth;
varying float vGrediceSnowSideFactor;
varying float vGrediceSnowSurface;
varying float vGrediceSnowThickness;

float grediceWeatherHash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

float grediceWeatherNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);

    float n000 = grediceWeatherHash(i);
    float n100 = grediceWeatherHash(i + vec3(1.0, 0.0, 0.0));
    float n010 = grediceWeatherHash(i + vec3(0.0, 1.0, 0.0));
    float n110 = grediceWeatherHash(i + vec3(1.0, 1.0, 0.0));
    float n001 = grediceWeatherHash(i + vec3(0.0, 0.0, 1.0));
    float n101 = grediceWeatherHash(i + vec3(1.0, 0.0, 1.0));
    float n011 = grediceWeatherHash(i + vec3(0.0, 1.0, 1.0));
    float n111 = grediceWeatherHash(i + vec3(1.0, 1.0, 1.0));

    float nx00 = mix(n000, n100, u.x);
    float nx10 = mix(n010, n110, u.x);
    float nx01 = mix(n001, n101, u.x);
    float nx11 = mix(n011, n111, u.x);

    return mix(mix(nx00, nx10, u.y), mix(nx01, nx11, u.y), u.z) * 2.0 - 1.0;
}
`;

const weatherWorldNormalVertex = `
vec3 grediceWeatherWorldNormal = normalize(
    inverseTransformDirection(transformedNormal, viewMatrix)
);
vGrediceWeatherWorldNormal = grediceWeatherWorldNormal;
`;

const weatherRainOnlyNormalVertex = `
vGrediceWeatherWorldNormalY = normalize(
    inverseTransformDirection(transformedNormal, viewMatrix)
).y;
`;

function weatherSnowVertexDisplacement(useBuiltInViewNormal: boolean) {
    const worldNormalSetup = useBuiltInViewNormal
        ? ''
        : `
vec3 grediceWeatherWorldNormal = normalize(
    inverseTransformDirection(transformedNormal, viewMatrix)
);
`;
    const slopeAlignment = useBuiltInViewNormal
        ? `dot(vNormal, viewMatrix[1].xyz)`
        : `dot(grediceWeatherWorldNormal, grediceWeatherWorldUp)`;
    const worldNormalAssignment = useBuiltInViewNormal
        ? ''
        : `
vGrediceWeatherWorldNormal = grediceWeatherWorldNormal;`;
    return `
mat4 grediceWeatherObjectMatrix = modelMatrix;
#ifdef USE_INSTANCING
    grediceWeatherObjectMatrix = grediceWeatherObjectMatrix * instanceMatrix;
#endif
#ifdef USE_BATCHING
    grediceWeatherObjectMatrix = grediceWeatherObjectMatrix * batchingMatrix;
#endif

${worldNormalSetup}
float grediceSnowCoverage = 0.0;
float grediceSnowDistanceForSide = 0.0;
float grediceSnowNoise = 0.0;
float grediceSnowSideFactor = 0.0;
float grediceSnowThickness = 0.0;

if (uGrediceSnowAmount > 0.001) {
    vec3 grediceWeatherWorldUp = vec3(0.0, 1.0, 0.0);
    vec3 grediceWeatherLocalUp = normalize(
        transpose(mat3(grediceWeatherObjectMatrix)) *
            grediceWeatherWorldUp
    );
    float grediceSnowSlopeAlignment = clamp(
        ${slopeAlignment},
        0.0,
        1.0
    );
    float grediceSnowSlopeCoverage = pow(
        grediceSnowSlopeAlignment,
        uGrediceSnowSlopeExponent
    );
    // The snow blanket varies in world space, so neighbouring terrain blocks
    // agree on its thickness where they meet and the cover shows no joint
    // between blocks at the same height (GAME_ART.md terrain). Merged base
    // chunks bake the instance matrix into position; both paths reach the
    // same world position here.
    grediceSnowNoise = grediceWeatherNoise(
        (grediceWeatherObjectMatrix * vec4(transformed, 1.0)).xyz *
            uGrediceSnowNoiseScale
    );
    float grediceSnowBaseThickness =
        uGrediceSnowMaxThickness *
        (
            1.0 +
            grediceSnowNoise * uGrediceSnowNoiseAmplitude
        );
    float grediceSnowSafeThickness = max(
        grediceSnowBaseThickness,
        0.0001
    );
    grediceSnowSideFactor = 1.0 - smoothstep(
        0.4,
        0.85,
        grediceSnowSlopeAlignment
    );
    grediceSnowDistanceForSide = mix(
        aSnowTopDistance,
        0.0,
        grediceSnowSideFactor
    );
    float grediceSnowSideBand = clamp(
        1.0 -
            grediceSnowDistanceForSide /
                grediceSnowSafeThickness,
        0.0,
        1.0
    );
    grediceSnowCoverage = clamp(
        uGrediceSnowAmount *
            mix(
                grediceSnowSlopeCoverage,
                grediceSnowSideBand,
                grediceSnowSideFactor
            ),
        0.0,
        1.0
    );
    grediceSnowThickness =
        grediceSnowCoverage * grediceSnowBaseThickness;
    float grediceSnowSideDisplacement = clamp(
        grediceSnowThickness - grediceSnowDistanceForSide,
        0.0,
        grediceSnowThickness
    );
    float grediceSnowDisplacementAmount = mix(
        grediceSnowThickness,
        grediceSnowSideDisplacement,
        grediceSnowSideFactor
    ) * clamp(aSnowLayer, 0.0, 1.0);
    grediceSnowDisplacementAmount +=
        uGrediceSnowLift *
        smoothstep(0.001, 0.04, grediceSnowCoverage) *
        clamp(aSnowLayer, 0.0, 1.0);
    vec3 grediceSnowDisplacementDirection = normalize(
        mix(
            objectNormal,
            grediceWeatherLocalUp,
            grediceSnowSideFactor
        )
    );
    transformed +=
        grediceSnowDisplacementDirection *
        grediceSnowDisplacementAmount;
}

vGrediceSnowCoverage = grediceSnowCoverage;
vGrediceSnowNoise = grediceSnowNoise;
vGrediceSnowSideDepth = grediceSnowDistanceForSide;
vGrediceSnowSideFactor = grediceSnowSideFactor;
vGrediceSnowSurface = aWeatherSurface;
vGrediceSnowThickness = grediceSnowThickness;
${worldNormalAssignment}
`;
}

const weatherWorldPosition = `
#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined( USE_SHADOWMAP ) || defined( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
    vGrediceWeatherWorldPosition = worldPosition.xyz;
#else
    vec4 grediceWeatherWorldPosition = vec4(transformed, 1.0);
    #ifdef USE_BATCHING
        grediceWeatherWorldPosition =
            batchingMatrix * grediceWeatherWorldPosition;
    #endif
    #ifdef USE_INSTANCING
        grediceWeatherWorldPosition =
            instanceMatrix * grediceWeatherWorldPosition;
    #endif
    grediceWeatherWorldPosition =
        modelMatrix * grediceWeatherWorldPosition;
    vGrediceWeatherWorldPosition =
        grediceWeatherWorldPosition.xyz;
#endif
`;

const weatherWorldPositionFragmentPars = `
varying vec3 vGrediceWeatherWorldPosition;
`;

const weatherWorldNormalFragmentPars = `
varying vec3 vGrediceWeatherWorldNormal;
`;

const weatherRainOnlyNormalFragmentPars = `
varying float vGrediceWeatherWorldNormalY;
`;

const weatherRainFragmentPars = `
uniform float uGrediceFrostIntensity;
uniform float uGrediceRainTopSurfaceBias;
uniform float uGrediceRainWetness;
uniform vec3 uGrediceRainSheenColor;

// Frost grain only; the wet look uses no per-pixel noise.
float grediceWeatherFragmentNoise(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453123);
}
`;

const weatherSnowFragmentPars = `
uniform float uGrediceSnowAmount;
uniform vec3 uGrediceSnowColor;
uniform float uGrediceSnowNoiseInfluence;

varying float vGrediceSnowCoverage;
varying float vGrediceSnowNoise;
varying float vGrediceSnowSideDepth;
varying float vGrediceSnowSideFactor;
varying float vGrediceSnowSurface;
varying float vGrediceSnowThickness;

float grediceWeatherResolveSnowCoverage() {
    float coverage = clamp(
        (
            vGrediceSnowCoverage +
                vGrediceSnowNoise *
                    uGrediceSnowNoiseInfluence
        ),
        0.0,
        1.0
    );
    if (
        vGrediceSnowSideFactor > 0.001 &&
        vGrediceSnowThickness > 0.0001
    ) {
        float normalizedSide = clamp(
            (
                vGrediceSnowThickness -
                vGrediceSnowSideDepth
            ) / vGrediceSnowThickness,
            0.0,
            1.0
        );
        coverage *= mix(
            1.0,
            normalizedSide,
            clamp(vGrediceSnowSideFactor, 0.0, 1.0)
        );
    }
    return coverage;
}
`;

/**
 * A sunlit top face receives about this many times the light that would show
 * its albedo unchanged (`SUNLIT_GAIN` in `assets/scripts/party_style.py`).
 * The snow colour is the colour a sunlit snow top shows, so the covered
 * path divides by it to light snow like an albedo.
 */
export const weatherSnowSunlitGain = 3.2;

/**
 * Share of the light's tint covered snow keeps, on the ground and on props
 * alike. Snow is a near-white neutral: the full tint of the cloud or night
 * fill would take it past the neutral range (saturation 0.10 to 0.25), and
 * too little left the ground grey-white at night beside lavender roofs
 * (GAME_ART.md "Weather > Snow": clean blue-white, lilac at night).
 */
export const weatherSnowLightTint = 0.6;

/**
 * Covered snow never shows darker than this share of its sunlit colour
 * (GAME_ART.md "Weather > Snow": a light floor of 0.62), so shaded sides,
 * dusk and heavy cloud keep it a clean blue-white instead of grey.
 */
export const weatherSnowLightFloor = 0.62;

function weatherFastSnowFragment(useBuiltInViewNormal: boolean) {
    const earlyNormal = useBuiltInViewNormal
        ? `normalize(vNormal)`
        : `normalize(
        mat3(viewMatrix) *
            normalize(vGrediceWeatherWorldNormal)
    )`;
    return `
float grediceWeatherEarlySnowCoverage =
    grediceWeatherResolveSnowCoverage();
float grediceWeatherEarlySnowStrength = smoothstep(
    0.05,
    0.85,
    grediceWeatherEarlySnowCoverage
);
if (
    grediceWeatherEarlySnowStrength >= 0.01 ||
    vGrediceSnowSurface > 0.5
) {
    vec3 grediceWeatherEarlyNormal = ${earlyNormal};
    // A snow blanket reads as one surface: faces that mostly point up are
    // lit as a flat top, so bevels and block joints under the snow do not
    // draw lines through it. Steep sides keep their own shading.
    vec3 grediceWeatherEarlyUp = normalize(viewMatrix[1].xyz);
    grediceWeatherEarlyNormal = normalize(mix(
        grediceWeatherEarlyNormal,
        grediceWeatherEarlyUp,
        smoothstep(
            0.35,
            0.8,
            dot(grediceWeatherEarlyNormal, grediceWeatherEarlyUp)
        )
    ));
    // Snow follows the scene lights like every other surface: the snow
    // colour is what a sunlit top shows at midday, so it turns peach at
    // sunrise and light lavender at night instead of staying paper white.
    vec3 grediceWeatherEarlyLight = ambientLightColor;
    #if NUM_HEMI_LIGHTS > 0
        for (int i = 0; i < NUM_HEMI_LIGHTS; i++) {
            grediceWeatherEarlyLight += getHemisphereLightIrradiance(
                hemisphereLights[i],
                grediceWeatherEarlyNormal
            );
        }
    #endif
    #if NUM_DIR_LIGHTS > 0
        for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
            grediceWeatherEarlyLight +=
                directionalLights[i].color *
                max(
                    dot(
                        grediceWeatherEarlyNormal,
                        directionalLights[i].direction
                    ),
                    0.0
                );
        }
    #endif
    // Snow keeps only part of the light's tint, so it stays a clean
    // blue-white under the lavender cloud fill and a light lavender at
    // night instead of turning periwinkle.
    grediceWeatherEarlyLight = mix(
        vec3(dot(grediceWeatherEarlyLight, vec3(0.2126, 0.7152, 0.0722))),
        grediceWeatherEarlyLight,
        ${weatherSnowLightTint.toFixed(2)}
    );
    vec3 grediceWeatherEarlySnowColor = mix(
        uGrediceSnowColor * 0.85,
        uGrediceSnowColor,
        grediceWeatherEarlySnowStrength
    );
    gl_FragColor = vec4(
        max(
            grediceWeatherEarlySnowColor *
                grediceWeatherEarlyLight *
                (RECIPROCAL_PI / ${weatherSnowSunlitGain.toFixed(2)}),
            grediceWeatherEarlySnowColor * ${weatherSnowLightFloor.toFixed(2)}
        ),
        1.0
    );
    // Covered fragments skip the full lighting path, so they tone map and
    // convert colour space here, then apply scene fog.
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
    return;
}
`;
}

const weatherSnowColorFragment = `
float grediceWeatherSnowCoverage =
    grediceWeatherEarlySnowCoverage;
float grediceWeatherSnowStrength = smoothstep(
    0.05,
    0.85,
    grediceWeatherSnowCoverage
);
vec3 grediceWeatherSnowColor = mix(
    uGrediceSnowColor * 0.85,
    uGrediceSnowColor,
    grediceWeatherSnowStrength
);
float grediceWeatherSnowPresence = max(
    step(0.01, grediceWeatherSnowStrength),
    step(0.5, vGrediceSnowSurface)
);
diffuseColor.rgb = mix(
    diffuseColor.rgb,
    grediceWeatherSnowColor,
    grediceWeatherSnowPresence
);
`;

/**
 * The wet look (GAME_ART.md "Weather > Rain and heavy rain"): richer, never
 * darker. Before lighting, wet faces gain saturation and move toward a
 * lower roughness; up-facing wet faces add a soft sky sheen to the light.
 * No darkening and no per-pixel noise.
 */
function weatherRainWetFragment(normalY: string, dryShare: string) {
    return `
float grediceWeatherNormalY = 0.0;
float grediceWeatherWet = 0.0;
if (uGrediceRainWetness > 0.001) {
    grediceWeatherNormalY = max(${normalY}, 0.0);
    grediceWeatherWet = clamp(uGrediceRainWetness * ${dryShare}, 0.0, 1.0);
    float grediceWeatherWetLuma = dot(
        diffuseColor.rgb,
        vec3(0.2126, 0.7152, 0.0722)
    );
    diffuseColor.rgb = max(
        mix(
            vec3(grediceWeatherWetLuma),
            diffuseColor.rgb,
            1.0 + ${rainWetLook.saturation.toFixed(2)} * grediceWeatherWet
        ),
        0.0
    );
}
`;
}

const weatherCombinedRainColorFragment = weatherRainWetFragment(
    'normalize(vGrediceWeatherWorldNormal).y',
    '(1.0 - grediceWeatherSnowPresence)',
);

const weatherRainOnlyComputationFragment = weatherRainWetFragment(
    'vGrediceWeatherWorldNormalY',
    '1.0',
);

const weatherRainRoughnessFragment = `
roughnessFactor = mix(
    roughnessFactor,
    ${rainWetLook.roughness.toFixed(2)},
    grediceWeatherWet
);
`;

const weatherRoughnessFragment = `
roughnessFactor = mix(
    roughnessFactor,
    0.92,
    grediceWeatherSnowStrength
);
`;

const weatherMetalnessFragment = `
metalnessFactor = mix(
    metalnessFactor,
    0.0,
    grediceWeatherSnowStrength
);
`;

// A soft sky-coloured sheen on up-facing wet faces, added to the light.
const weatherRainSheenFragment = `
outgoingLight += uGrediceRainSheenColor * (
    ${rainWetLook.sheen.toFixed(2)} *
    grediceWeatherWet *
    smoothstep(0.5, 1.0, grediceWeatherNormalY)
);
`;

function replaceShaderChunk(
    source: string,
    chunk: string,
    replacement: string,
) {
    if (!source.includes(chunk)) {
        throw new Error(
            `Weather surface shader is missing required chunk ${chunk}.`,
        );
    }
    return source.replace(chunk, replacement);
}

export function supportsIntegratedWeatherSurfaceMaterial(
    material: Material,
): material is MeshStandardMaterial {
    const transmission = Reflect.get(material, 'transmission');
    return (
        (material instanceof MeshStandardMaterial ||
            Reflect.get(material, 'isMeshPhysicalMaterial') === true) &&
        material.transparent === false &&
        material.opacity >= 0.999 &&
        material.depthTest &&
        material.depthWrite &&
        material.blending === NormalBlending &&
        (typeof transmission !== 'number' || transmission <= 0)
    );
}

function injectWeatherSurfaceShader(
    shader: Parameters<Material['onBeforeCompile']>[0],
    options: WeatherSurfaceMaterialOptions,
    mode: WeatherSurfacePluginMode,
    flatShaded: boolean,
) {
    const includesRain = modeIncludesRain(mode);
    const includesSnow = modeIncludesSnow(mode);
    const usesBuiltInSnowViewNormal = mode === 'snow-only' && !flatShaded;

    if (includesRain) {
        shader.uniforms.uGrediceFrostIntensity =
            options.frostIntensityUniform ?? { value: 0 };
        shader.uniforms.uGrediceRainSheenColor = getRainWetSheenColorUniform();
        shader.uniforms.uGrediceRainTopSurfaceBias = {
            value: options.rain.topSurfaceBias,
        };
        shader.uniforms.uGrediceRainWetness = options.rain.wetnessUniform;
    }
    if (includesSnow) {
        shader.uniforms.uGrediceSnowAmount = options.snow.amountUniform;
        shader.uniforms.uGrediceSnowColor = {
            value: new Color(options.snow.color),
        };
        shader.uniforms.uGrediceSnowLift = { value: options.snow.lift };
        shader.uniforms.uGrediceSnowMaxThickness = {
            value: options.snow.maxThickness,
        };
        shader.uniforms.uGrediceSnowNoiseAmplitude = {
            value: options.snow.noiseAmplitude,
        };
        shader.uniforms.uGrediceSnowNoiseInfluence = {
            value: options.snow.noiseInfluence,
        };
        shader.uniforms.uGrediceSnowNoiseScale = {
            value: options.snow.noiseScale,
        };
        shader.uniforms.uGrediceSnowSlopeExponent = {
            value: options.snow.slopeExponent,
        };
    }

    shader.vertexShader = replaceShaderChunk(
        shader.vertexShader,
        '#include <common>',
        `#include <common>\n${weatherWorldPositionVertexPars}${
            mode === 'rain-only'
                ? weatherRainOnlyNormalVertexPars
                : usesBuiltInSnowViewNormal
                  ? ''
                  : weatherWorldNormalVertexPars
        }${includesSnow ? weatherSnowVertexPars : ''}`,
    );
    shader.vertexShader = replaceShaderChunk(
        shader.vertexShader,
        '#include <project_vertex>',
        `${
            includesSnow
                ? weatherSnowVertexDisplacement(usesBuiltInSnowViewNormal)
                : mode === 'rain-only'
                  ? weatherRainOnlyNormalVertex
                  : weatherWorldNormalVertex
        }\n#include <project_vertex>`,
    );
    shader.vertexShader = replaceShaderChunk(
        shader.vertexShader,
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>\n${weatherWorldPosition}`,
    );
    shader.fragmentShader = replaceShaderChunk(
        shader.fragmentShader,
        '#include <common>',
        `#include <common>\n${weatherWorldPositionFragmentPars}${
            mode === 'rain-only'
                ? weatherRainOnlyNormalFragmentPars
                : usesBuiltInSnowViewNormal
                  ? ''
                  : weatherWorldNormalFragmentPars
        }${
            includesRain ? weatherRainFragmentPars : ''
        }${includesSnow ? weatherSnowFragmentPars : ''}`,
    );
    if (includesSnow) {
        shader.fragmentShader = replaceShaderChunk(
            shader.fragmentShader,
            '#include <map_fragment>',
            `${weatherFastSnowFragment(
                usesBuiltInSnowViewNormal,
            )}\n#include <map_fragment>`,
        );
    }
    if (includesSnow) {
        const colorFragments = [
            weatherSnowColorFragment,
            mode === 'combined' ? weatherCombinedRainColorFragment : '',
        ].join('');
        shader.fragmentShader = replaceShaderChunk(
            shader.fragmentShader,
            '#include <color_fragment>',
            `#include <color_fragment>\n${colorFragments}`,
        );
    }
    if (includesSnow) {
        shader.fragmentShader = replaceShaderChunk(
            shader.fragmentShader,
            '#include <roughnessmap_fragment>',
            `#include <roughnessmap_fragment>\n${weatherRoughnessFragment}`,
        );
        shader.fragmentShader = replaceShaderChunk(
            shader.fragmentShader,
            '#include <metalnessmap_fragment>',
            `#include <metalnessmap_fragment>\n${weatherMetalnessFragment}`,
        );
    }
    if (includesRain) {
        // Combined mode computes the wetness at the colour stage, after the
        // snow; rain-only computes it here, before the roughness.
        shader.fragmentShader = replaceShaderChunk(
            shader.fragmentShader,
            '#include <roughnessmap_fragment>',
            `${
                mode === 'rain-only' ? weatherRainOnlyComputationFragment : ''
            }#include <roughnessmap_fragment>\n${weatherRainRoughnessFragment}`,
        );
        shader.fragmentShader = replaceShaderChunk(
            shader.fragmentShader,
            '#include <opaque_fragment>',
            `${weatherRainSheenFragment}#include <opaque_fragment>`,
        );
        shader.fragmentShader = replaceShaderChunk(
            shader.fragmentShader,
            '#include <dithering_fragment>',
            `// Thin, static crystals on existing ground surfaces; no displacement.
if (uGrediceFrostIntensity > 0.001) {
float frostTop = ${mode === 'rain-only' ? 'vGrediceWeatherWorldNormalY' : 'normalize(vGrediceWeatherWorldNormal).y'};
float frostGrain = grediceWeatherFragmentNoise(vGrediceWeatherWorldPosition * 95.0);
float frostMask = uGrediceFrostIntensity * pow(max(0.0, frostTop), 4.0) *
    (0.10 + 0.22 * step(0.68, frostGrain)) * (1.0 - uGrediceRainWetness);
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.82, 0.90, 0.95), frostMask);
}
#include <dithering_fragment>`,
        );
    }
}

export function createIntegratedWeatherSurfaceMaterial(
    source: MeshStandardMaterial,
    options: WeatherSurfaceMaterialOptions,
) {
    const pluginMode = resolveWeatherSurfacePluginMode({
        rainEnabled: options.rain.enabled,
        snowEnabled: options.snow.enabled,
    });
    const pluginVariantKey = getWeatherSurfacePluginVariantKey(pluginMode);
    const material = source.clone();
    material.name = `${source.name || source.type}:IntegratedWeatherSurface`;
    const sourceHooks =
        getMaterialShaderHooksWithoutCloudShadowAttenuation(source);

    // Three's clone/copy intentionally omits compile callbacks. Inject first,
    // then let the source decorator insert its base-color work immediately
    // after Three's chunks and before the weather blend. Scene-owned cloud
    // attenuation is intentionally unwrapped; the scene patches this clone.
    material.onBeforeCompile = sourceHooks.onBeforeCompile;
    material.customProgramCacheKey = sourceHooks.customProgramCacheKey;
    const originalOnBeforeCompile = material.onBeforeCompile;
    const originalCustomProgramCacheKey = material.customProgramCacheKey;

    material.onBeforeCompile = (shader, renderer) => {
        injectWeatherSurfaceShader(
            shader,
            options,
            pluginMode,
            material.flatShading,
        );
        originalOnBeforeCompile.call(material, shader, renderer);
    };
    material.customProgramCacheKey = () =>
        `${originalCustomProgramCacheKey.call(material)}|${pluginVariantKey}`;
    material.userData = {
        ...material.userData,
        grediceWeatherSurface: true,
        grediceWeatherSurfacePluginMode: pluginMode,
        grediceWeatherSurfacePluginVariantKey: pluginVariantKey,
    };
    const sourceHookSignature = getGardenMaterialShaderHookSignature(source);
    if (sourceHookSignature && getGardenMaterialSignature(source)) {
        // Equal settings may share only when mutable weather uniforms have the
        // same owner. Values alone cannot prove their future updates agree.
        const signature = JSON.stringify({
            source: sourceHookSignature,
            pluginMode,
            frost: weatherUniformKey(options.frostIntensityUniform),
            rain: {
                ...options.rain,
                puddleStrengthUniform: weatherUniformKey(
                    options.rain.puddleStrengthUniform,
                ),
                wetnessUniform: weatherUniformKey(options.rain.wetnessUniform),
            },
            snow: {
                ...options.snow,
                color: new Color(options.snow.color).toArray(),
                amountUniform: weatherUniformKey(options.snow.amountUniform),
            },
        });
        registerGardenMaterialShaderHooks(
            material,
            signature,
            material.userData,
        );
    }
    material.needsUpdate = true;

    return material;
}
