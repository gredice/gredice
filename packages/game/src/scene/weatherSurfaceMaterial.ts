import type { ColorRepresentation, IUniform, Material } from 'three';
import { Color, MeshStandardMaterial, NormalBlending, Vector3 } from 'three';
import { getMaterialShaderHooksWithoutCloudShadowAttenuation } from './cloudShadowAttenuation';

const WEATHER_SURFACE_PLUGIN_VARIANT_KEY_PREFIX = 'gredice-weather-surface-v2';

type Vector3Tuple = readonly [number, number, number];

export type WeatherSurfacePluginMode = 'combined' | 'rain-only' | 'snow-only';

export type WeatherSurfacePluginActivation = {
    rainEnabled: boolean;
    snowEnabled: boolean;
};

export type WeatherSurfaceMaterialOptions = {
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
attribute vec3 aWeatherLocalPosition;
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
    // Legacy stable overlays sample source-local position before applying the
    // per-block instance matrix. Merged base chunks bake that matrix into
    // position, so this preserved attribute retains the legacy noise phase.
    grediceSnowNoise = grediceWeatherNoise(
        aWeatherLocalPosition * uGrediceSnowNoiseScale
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
uniform float uGrediceRainDarkness;
uniform float uGrediceRainGlossiness;
uniform float uGrediceRainPuddleStrength;
uniform float uGrediceRainTopSurfaceBias;
uniform float uGrediceRainWetness;
uniform vec3 uGrediceRainBoundsMax;
uniform vec3 uGrediceRainBoundsMin;

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
    vec3 grediceWeatherEarlyLight = vec3(0.8);
    #if NUM_DIR_LIGHTS > 0
        for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
            float grediceWeatherEarlyDiffuse = max(
                dot(
                    grediceWeatherEarlyNormal,
                    directionalLights[i].direction
                ),
                0.0
            );
            grediceWeatherEarlyLight +=
                directionalLights[i].color *
                grediceWeatherEarlyDiffuse *
                0.8;
        }
    #endif
    float grediceWeatherEarlyHemi =
        grediceWeatherEarlyNormal.y * 0.5 + 0.5;
    grediceWeatherEarlyLight += mix(
        vec3(0.2),
        vec3(0.3),
        grediceWeatherEarlyHemi
    );
    vec3 grediceWeatherEarlySnowColor = mix(
        uGrediceSnowColor * 0.85,
        uGrediceSnowColor,
        grediceWeatherEarlySnowStrength
    );
    gl_FragColor = vec4(
        grediceWeatherEarlySnowColor *
            clamp(grediceWeatherEarlyLight, 0.5, 2.5),
        1.0
    );
    // Keep the legacy SnowOverlay output contract: it writes the lit linear
    // color directly and only applies scene fog. Besides preserving the
    // established snow brightness, this keeps the covered-fragment path tiny.
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

const weatherCombinedRainColorFragment = `
float grediceWeatherTopness = 0.0;
float grediceWeatherNormalY = 0.0;
float grediceWeatherWet = 0.0;
float grediceWeatherPuddle = 0.0;
if (uGrediceRainWetness > 0.001) {
    grediceWeatherNormalY = max(
        normalize(vGrediceWeatherWorldNormal).y,
        0.0
    );
    grediceWeatherTopness = clamp(
        pow(
            grediceWeatherNormalY,
            uGrediceRainTopSurfaceBias
        ),
        0.0,
        1.0
    );
    vec3 grediceWeatherRainLocal =
        (
            vGrediceWeatherWorldPosition -
            uGrediceRainBoundsMin
        ) /
        max(
            vec3(0.001),
            uGrediceRainBoundsMax -
            uGrediceRainBoundsMin
        );
    float grediceWeatherRainVariation =
        0.75 +
        grediceWeatherFragmentNoise(
            grediceWeatherRainLocal * 17.0
        ) *
        0.25;
    grediceWeatherWet = clamp(
        uGrediceRainWetness *
            grediceWeatherTopness *
            grediceWeatherRainVariation *
            (1.0 - grediceWeatherSnowPresence),
        0.0,
        1.0
    );
    float grediceWeatherPuddleMask =
        smoothstep(0.6, 1.0, grediceWeatherWet) *
        grediceWeatherTopness;
    float grediceWeatherPuddleNoise =
        grediceWeatherFragmentNoise(
            grediceWeatherRainLocal * 23.0 +
                vec3(3.1, 7.9, 1.4)
        );
    grediceWeatherPuddle =
        smoothstep(0.78, 0.98, grediceWeatherPuddleNoise) *
        grediceWeatherPuddleMask *
        uGrediceRainPuddleStrength;
}
`;

const weatherRainOnlyComputationFragment = `
float grediceWeatherTopness = 0.0;
float grediceWeatherNormalY = 0.0;
float grediceWeatherWet = 0.0;
float grediceWeatherPuddle = 0.0;
if (uGrediceRainWetness > 0.001) {
    grediceWeatherNormalY = max(
        vGrediceWeatherWorldNormalY,
        0.0
    );
    if (grediceWeatherNormalY > 0.0) {
        grediceWeatherTopness = clamp(
            pow(
                grediceWeatherNormalY,
                uGrediceRainTopSurfaceBias
            ),
            0.0,
            1.0
        );
        vec3 grediceWeatherRainLocal =
            (
                vGrediceWeatherWorldPosition -
                uGrediceRainBoundsMin
            ) /
            max(
                vec3(0.001),
                uGrediceRainBoundsMax -
                uGrediceRainBoundsMin
            );
        float grediceWeatherRainVariation =
            0.75 +
            grediceWeatherFragmentNoise(
                grediceWeatherRainLocal * 17.0
            ) *
            0.25;
        grediceWeatherWet = clamp(
            uGrediceRainWetness *
                grediceWeatherTopness *
                grediceWeatherRainVariation,
            0.0,
            1.0
        );
        float grediceWeatherPuddleMask =
            smoothstep(0.6, 1.0, grediceWeatherWet) *
            grediceWeatherTopness;
        if (grediceWeatherPuddleMask > 0.0) {
            float grediceWeatherPuddleNoise =
                grediceWeatherFragmentNoise(
                    grediceWeatherRainLocal * 23.0 +
                        vec3(3.1, 7.9, 1.4)
                );
            grediceWeatherPuddle =
                smoothstep(
                    0.78,
                    0.98,
                    grediceWeatherPuddleNoise
                ) *
                grediceWeatherPuddleMask *
                uGrediceRainPuddleStrength;
        }
    }
}
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

const weatherOutputFragment = `
float grediceWeatherRainAlpha = max(
    grediceWeatherWet * 0.4,
    grediceWeatherPuddle * 0.5
);
float grediceWeatherGlint =
    pow(grediceWeatherNormalY, 20.0) *
    grediceWeatherWet *
    uGrediceRainGlossiness;
vec3 grediceWeatherRainColor =
    vec3(0.02) * uGrediceRainDarkness +
    vec3(
        grediceWeatherGlint * 0.18 +
        grediceWeatherPuddle * 0.12
    );
gl_FragColor.rgb = mix(
    gl_FragColor.rgb,
    grediceWeatherRainColor,
    grediceWeatherRainAlpha
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
        shader.uniforms.uGrediceRainDarkness = {
            value: options.rain.darkness,
        };
        shader.uniforms.uGrediceRainBoundsMax = {
            value: new Vector3(...options.rain.bounds.max),
        };
        shader.uniforms.uGrediceRainBoundsMin = {
            value: new Vector3(...options.rain.bounds.min),
        };
        shader.uniforms.uGrediceRainGlossiness = {
            value: options.rain.glossiness,
        };
        shader.uniforms.uGrediceRainPuddleStrength =
            options.rain.puddleStrengthUniform;
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
        const rainOutputFragment =
            mode === 'rain-only'
                ? `${weatherRainOnlyComputationFragment}\n${weatherOutputFragment}`
                : weatherOutputFragment;
        shader.fragmentShader = replaceShaderChunk(
            shader.fragmentShader,
            '#include <dithering_fragment>',
            `${rainOutputFragment}\n#include <dithering_fragment>`,
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
    material.needsUpdate = true;

    return material;
}
