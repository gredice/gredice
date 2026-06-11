import { useMemo } from 'react';
import { Color, type Material, MeshStandardMaterial, Vector2 } from 'three';

export type GroundPatchSurface =
    | 'dirt'
    | 'grass'
    | 'raisedBedSoil'
    | 'sand'
    | 'snow';

export type GroundPatchWetPatch = {
    center: readonly [number, number];
    halfSize: readonly [number, number];
    strength?: number;
};

type GroundPatchOptions = {
    wetColor?: string;
    wetPatches?: readonly GroundPatchWetPatch[];
    wetStrength?: number;
};

type GroundPatchPreset = {
    darkColor: string;
    darkStrength: number;
    lightColor: string;
    lightStrength: number;
    mode: number;
};

const groundPatchPresets = {
    grass: {
        darkColor: '#31561d',
        darkStrength: 0.28,
        lightColor: '#9eb64a',
        lightStrength: 0.24,
        mode: 0,
    },
    sand: {
        darkColor: '#d6a85d',
        darkStrength: 0,
        lightColor: '#e6c45e',
        lightStrength: 0.18,
        mode: 1,
    },
    dirt: {
        darkColor: '#0c0503',
        darkStrength: 0.48,
        lightColor: '#71533c',
        lightStrength: 0.42,
        mode: 2,
    },
    raisedBedSoil: {
        darkColor: '#2c2018',
        darkStrength: 0.32,
        lightColor: '#75634f',
        lightStrength: 0.34,
        mode: 3,
    },
    snow: {
        darkColor: '#bddcf0',
        darkStrength: 0.32,
        lightColor: '#f9fdff',
        lightStrength: 0.04,
        mode: 4,
    },
} satisfies Record<GroundPatchSurface, GroundPatchPreset>;

const maxWetPatchCount = 48;
const emptyWetPatches: readonly GroundPatchWetPatch[] = [];

const groundPatchVertexParameters = `
varying vec3 vGroundPatchWorldPosition;
`;

const groundPatchWorldPosition = `
vec4 groundPatchWorldPosition = vec4(transformed, 1.0);
#ifdef USE_BATCHING
    groundPatchWorldPosition = batchingMatrix * groundPatchWorldPosition;
#endif
#ifdef USE_INSTANCING
    groundPatchWorldPosition = instanceMatrix * groundPatchWorldPosition;
#endif
groundPatchWorldPosition = modelMatrix * groundPatchWorldPosition;
vGroundPatchWorldPosition = groundPatchWorldPosition.xyz;
`;

const groundPatchFragmentParameters = `
varying vec3 vGroundPatchWorldPosition;

uniform float uGroundPatchMode;
uniform vec3 uGroundPatchLightColor;
uniform vec3 uGroundPatchDarkColor;
uniform float uGroundPatchLightStrength;
uniform float uGroundPatchDarkStrength;
uniform float uGroundPatchWetPatchCount;
uniform vec2 uGroundPatchWetPatchCenters[${maxWetPatchCount}];
uniform vec2 uGroundPatchWetPatchHalfSizes[${maxWetPatchCount}];
uniform float uGroundPatchWetPatchStrengths[${maxWetPatchCount}];
uniform vec3 uGroundPatchWetColor;
uniform float uGroundPatchWetStrength;

float groundPatchHash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

float groundPatchNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);

    float n000 = groundPatchHash(i + vec3(0.0, 0.0, 0.0));
    float n100 = groundPatchHash(i + vec3(1.0, 0.0, 0.0));
    float n010 = groundPatchHash(i + vec3(0.0, 1.0, 0.0));
    float n110 = groundPatchHash(i + vec3(1.0, 1.0, 0.0));
    float n001 = groundPatchHash(i + vec3(0.0, 0.0, 1.0));
    float n101 = groundPatchHash(i + vec3(1.0, 0.0, 1.0));
    float n011 = groundPatchHash(i + vec3(0.0, 1.0, 1.0));
    float n111 = groundPatchHash(i + vec3(1.0, 1.0, 1.0));

    float nx00 = mix(n000, n100, u.x);
    float nx10 = mix(n010, n110, u.x);
    float nx01 = mix(n001, n101, u.x);
    float nx11 = mix(n011, n111, u.x);
    float nxy0 = mix(nx00, nx10, u.y);
    float nxy1 = mix(nx01, nx11, u.y);

    return mix(nxy0, nxy1, u.z);
}

float groundPatchFbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 4; i++) {
        value += groundPatchNoise(p) * amplitude;
        p = p * 2.03 + vec3(13.7, 19.1, 7.3);
        amplitude *= 0.5;
    }

    return value;
}

float groundPatchLayeredNoiseMask(vec3 p, float scale, float threshold, float edge, float seed) {
    vec2 warp = vec2(
        groundPatchFbm(p * vec3(scale * 0.34, 0.08, scale * 0.42) + vec3(seed, 1.7, seed * 1.9)),
        groundPatchFbm(p * vec3(scale * 0.4, 0.08, scale * 0.32) + vec3(seed * 2.3, 4.1, seed))
    ) - 0.5;
    vec3 warpedP = p + vec3(warp.x * 2.8, 0.0, warp.y * 2.8);
    float largeNoise = groundPatchFbm(
        warpedP * vec3(scale, 0.1, scale * 0.92) + vec3(seed * 0.7, 2.0, seed * 1.3)
    );
    float midNoise = groundPatchFbm(
        warpedP * vec3(scale * 1.75, 0.12, scale * 1.55) + vec3(seed * 1.6, 5.0, seed * 0.4)
    );
    float field = largeNoise * 0.76 + midNoise * 0.24;

    return smoothstep(threshold, threshold + edge, field);
}

float groundPatchWetMask(vec3 worldPosition) {
    float wetMask = 0.0;
    vec2 point = worldPosition.xz;

    for (int i = 0; i < ${maxWetPatchCount}; i++) {
        if (float(i) >= uGroundPatchWetPatchCount) {
            break;
        }

        vec2 halfSize = max(uGroundPatchWetPatchHalfSizes[i], vec2(0.001));
        vec2 normalized = abs(point - uGroundPatchWetPatchCenters[i]) / halfSize;
        float edge = max(normalized.x, normalized.y);
        float wetPatch = 1.0 - smoothstep(0.58, 1.0, edge);
        float mottled = 0.74 + groundPatchFbm(
            vec3(point.x * 9.0, worldPosition.y * 1.7, point.y * 9.0) +
            vec3(float(i) * 2.9, 4.2, 7.3)
        ) * 0.26;
        wetMask = max(wetMask, wetPatch * mottled * uGroundPatchWetPatchStrengths[i]);
    }

    return clamp(wetMask * uGroundPatchWetStrength, 0.0, 1.0);
}

vec2 groundPatchMasks(vec3 worldPosition) {
    vec3 p = worldPosition;

    if (uGroundPatchMode < 0.5) {
        vec2 flow = vec2(
            groundPatchFbm(p * vec3(0.34, 0.1, 0.34) + vec3(4.2, 1.7, 0.0)),
            groundPatchFbm(p * vec3(0.32, 0.1, 0.38) + vec3(12.7, 3.4, 8.1))
        ) - 0.5;
        vec2 grassUv = p.xz + flow * 0.72;
        vec3 grassP = vec3(grassUv.x, p.y, grassUv.y);
        float largeLightMask = groundPatchLayeredNoiseMask(grassP + vec3(1.7, 0.0, 4.3), 0.34, 0.62, 0.04, 3.0);
        float midLightMask = groundPatchLayeredNoiseMask(grassP + vec3(7.4, 0.0, 2.1), 0.5, 0.65, 0.04, 11.0);
        float lightMask = max(largeLightMask * 0.82, midLightMask * 0.58);
        float largeDarkMask = groundPatchLayeredNoiseMask(grassP + vec3(5.6, 0.0, 8.2), 0.38, 0.65, 0.04, 23.0);
        float midDarkMask = groundPatchLayeredNoiseMask(grassP + vec3(10.1, 0.0, 3.8), 0.54, 0.68, 0.04, 31.0);
        float darkMask = max(largeDarkMask * 0.62, midDarkMask * 0.44);
        darkMask *= 1.0 - lightMask * 0.82;

        return vec2(lightMask, darkMask);
    }

    if (uGroundPatchMode < 1.5) {
        float warp = groundPatchFbm(p * vec3(0.62, 0.12, 0.78) + vec3(3.1, 0.0, 9.4)) * 2.0 - 1.0;
        float strips = sin(p.z * 7.2 + p.x * 1.05 + p.y * 0.25 + warp * 1.6);
        float continuityBreak = smoothstep(0.36, 0.82, groundPatchFbm(p * vec3(0.74, 0.08, 1.1) + vec3(8.0, 4.0, 1.3)));
        float lightMask = smoothstep(0.86, 0.985, strips * 0.5 + 0.5) * continuityBreak;

        return vec2(lightMask, 0.0);
    }

    if (uGroundPatchMode < 2.5) {
        float lightPebbles = groundPatchFbm(p * vec3(8.4, 2.2, 8.4) + vec3(5.7, 2.1, 3.0));
        float lightBreakup = groundPatchFbm(p * vec3(14.0, 3.4, 14.0) + vec3(1.2, 4.6, 8.0));
        float lightMask = smoothstep(0.58, 0.82, lightPebbles) * smoothstep(0.5, 0.84, lightBreakup);
        float darkDirt = groundPatchFbm(p * vec3(5.8, 1.7, 5.8) + vec3(8.7, 3.6, 2.4));
        float darkSpecks = groundPatchFbm(p * vec3(12.0, 3.0, 12.0) + vec3(2.6, 8.1, 4.0));
        float darkMask = smoothstep(0.52, 0.76, darkDirt) * smoothstep(0.34, 0.78, darkSpecks);
        darkMask *= 1.0 - lightMask * 0.42;

        return vec2(lightMask, darkMask);
    }

    if (uGroundPatchMode < 3.5) {
        vec2 flow = vec2(
            groundPatchFbm(p * vec3(1.1, 0.16, 1.3) + vec3(2.2, 0.0, 6.4)),
            groundPatchFbm(p * vec3(1.24, 0.16, 1.04) + vec3(8.1, 3.0, 1.7))
        ) - 0.5;
        vec3 soilP = p + vec3(flow.x * 0.22, 0.0, flow.y * 0.22);
        float warmGranules = groundPatchFbm(
            soilP * vec3(8.0, 2.0, 8.0) + vec3(4.6, 1.3, 9.2)
        );
        float paleDust = groundPatchFbm(
            soilP * vec3(16.0, 3.0, 16.0) + vec3(1.8, 5.6, 2.7)
        );
        float darkGrain = groundPatchFbm(
            soilP * vec3(11.0, 2.5, 11.0) + vec3(7.8, 3.3, 5.1)
        );
        float dryClods = groundPatchFbm(
            soilP * vec3(3.4, 0.9, 3.4) + vec3(6.0, 0.0, 12.0)
        );
        float lightMask =
            smoothstep(0.58, 0.86, warmGranules) * 0.44 +
            smoothstep(0.72, 0.96, paleDust) * 0.36;
        float darkMask =
            smoothstep(0.46, 0.76, dryClods) * 0.28 +
            smoothstep(0.66, 0.9, darkGrain) * 0.3;
        darkMask *= 1.0 - lightMask * 0.36;

        return vec2(clamp(lightMask, 0.0, 1.0), clamp(darkMask, 0.0, 1.0));
    }

    vec2 snowFlow = vec2(
        groundPatchFbm(p * vec3(0.54, 0.14, 0.62) + vec3(6.4, 2.0, 11.3)),
        groundPatchFbm(p * vec3(0.62, 0.14, 0.54) + vec3(2.8, 5.4, 1.8))
    ) - 0.5;
    vec3 snowP = p + vec3(snowFlow.x * 1.0, 0.0, snowFlow.y * 1.0);
    float drift = sin(snowP.x * 3.0 + snowP.z * 2.1 + p.y * 0.25);
    float driftBreakup = smoothstep(0.16, 0.66, groundPatchFbm(snowP * vec3(1.12, 0.16, 1.12) + vec3(9.6, 0.0, 1.2)));
    float brightMask = smoothstep(0.72, 0.94, drift * 0.5 + 0.5) * driftBreakup;
    float blueDriftMask = smoothstep(0.4, 0.72, drift * 0.5 + 0.5) * driftBreakup;
    float blueIslandMask = smoothstep(0.38, 0.66, groundPatchFbm(snowP * vec3(1.72, 0.22, 1.72) + vec3(2.3, 7.0, 4.8)));
    float shadowMask = max(blueDriftMask, blueIslandMask * 0.9);

    return vec2(brightMask * (1.0 - shadowMask * 0.45), shadowMask);
}

vec3 applyGroundPatches(vec3 baseColor, vec3 worldPosition) {
    vec2 masks = groundPatchMasks(worldPosition);
    vec3 patchedColor = mix(baseColor, uGroundPatchLightColor, masks.x * uGroundPatchLightStrength);
    patchedColor = mix(patchedColor, uGroundPatchDarkColor, masks.y * uGroundPatchDarkStrength);
    float wetMask = groundPatchWetMask(worldPosition);
    patchedColor = mix(patchedColor, uGroundPatchWetColor, wetMask);

    return patchedColor;
}
`;

const groundPatchColorFragment = `
diffuseColor.rgb = applyGroundPatches(diffuseColor.rgb, vGroundPatchWorldPosition);
`;

function wetPatchKey(wetPatches: readonly GroundPatchWetPatch[]) {
    return wetPatches
        .slice(0, maxWetPatchCount)
        .map(
            (patch) =>
                `${patch.center[0].toFixed(3)},${patch.center[1].toFixed(3)},${patch.halfSize[0].toFixed(3)},${patch.halfSize[1].toFixed(3)},${(patch.strength ?? 1).toFixed(3)}`,
        )
        .join('|');
}

function createWetPatchUniforms(
    wetPatches: readonly GroundPatchWetPatch[],
    options: GroundPatchOptions,
) {
    const centers = Array.from(
        { length: maxWetPatchCount },
        () => new Vector2(),
    );
    const halfSizes = Array.from(
        { length: maxWetPatchCount },
        () => new Vector2(0.001, 0.001),
    );
    const strengths = Array.from({ length: maxWetPatchCount }, () => 0);
    const cappedPatches = wetPatches.slice(0, maxWetPatchCount);

    cappedPatches.forEach((patch, index) => {
        centers[index]?.set(patch.center[0], patch.center[1]);
        halfSizes[index]?.set(
            Math.max(patch.halfSize[0], 0.001),
            Math.max(patch.halfSize[1], 0.001),
        );
        strengths[index] = patch.strength ?? 1;
    });

    return {
        uGroundPatchWetPatchCount: { value: cappedPatches.length },
        uGroundPatchWetPatchCenters: { value: centers },
        uGroundPatchWetPatchHalfSizes: { value: halfSizes },
        uGroundPatchWetPatchStrengths: { value: strengths },
        uGroundPatchWetColor: {
            value: new Color(options.wetColor ?? '#2f241d'),
        },
        uGroundPatchWetStrength: { value: options.wetStrength ?? 0.92 },
    };
}

function applyGroundPatchMaterial(
    material: MeshStandardMaterial,
    surface: GroundPatchSurface,
    options: GroundPatchOptions,
) {
    const preset = groundPatchPresets[surface];
    const wetPatches = options.wetPatches ?? emptyWetPatches;
    const originalOnBeforeCompile = material.onBeforeCompile.bind(material);
    const originalCustomProgramCacheKey =
        material.customProgramCacheKey.bind(material);

    material.onBeforeCompile = (shader, renderer) => {
        originalOnBeforeCompile(shader, renderer);

        shader.uniforms.uGroundPatchMode = { value: preset.mode };
        shader.uniforms.uGroundPatchLightColor = {
            value: new Color(preset.lightColor),
        };
        shader.uniforms.uGroundPatchDarkColor = {
            value: new Color(preset.darkColor),
        };
        shader.uniforms.uGroundPatchLightStrength = {
            value: preset.lightStrength,
        };
        shader.uniforms.uGroundPatchDarkStrength = {
            value: preset.darkStrength,
        };
        Object.assign(
            shader.uniforms,
            createWetPatchUniforms(wetPatches, options),
        );
        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                `#include <common>\n${groundPatchVertexParameters}`,
            )
            .replace(
                '#include <worldpos_vertex>',
                `#include <worldpos_vertex>\n${groundPatchWorldPosition}`,
            );
        shader.fragmentShader = shader.fragmentShader
            .replace(
                '#include <common>',
                `#include <common>\n${groundPatchFragmentParameters}`,
            )
            .replace(
                '#include <color_fragment>',
                `#include <color_fragment>\n${groundPatchColorFragment}`,
            );
    };
    material.customProgramCacheKey = () =>
        `${originalCustomProgramCacheKey()}:ground-patch:${surface}`;
    material.needsUpdate = true;

    return material;
}

function createGroundPatchMaterial(
    material: Material,
    surface: GroundPatchSurface,
    options: GroundPatchOptions,
) {
    if (!(material instanceof MeshStandardMaterial)) {
        return material;
    }

    return applyGroundPatchMaterial(material.clone(), surface, options);
}

export function useGroundPatchMaterial(
    material: undefined,
    surface: GroundPatchSurface | undefined,
    options?: GroundPatchOptions,
): undefined;
export function useGroundPatchMaterial(
    material: Material,
    surface: GroundPatchSurface | undefined,
    options?: GroundPatchOptions,
): Material;
export function useGroundPatchMaterial(
    material: Material[],
    surface: GroundPatchSurface | undefined,
    options?: GroundPatchOptions,
): Material[];
export function useGroundPatchMaterial(
    material: Material | Material[],
    surface: GroundPatchSurface | undefined,
    options?: GroundPatchOptions,
): Material | Material[];
export function useGroundPatchMaterial(
    material: Material | Material[] | undefined,
    surface: GroundPatchSurface | undefined,
    options: GroundPatchOptions = {},
) {
    const wetPatches = options.wetPatches ?? emptyWetPatches;
    const key = wetPatchKey(wetPatches);

    // biome-ignore lint/correctness/useExhaustiveDependencies: wet patch values are tracked by key so equal patch arrays do not recompile materials.
    return useMemo(() => {
        if (!material || !surface) {
            return material;
        }

        if (Array.isArray(material)) {
            return material.map((item) =>
                createGroundPatchMaterial(item, surface, options),
            );
        }

        return createGroundPatchMaterial(material, surface, options);
    }, [key, material, options.wetColor, options.wetStrength, surface]);
}

export function useGroundPatchStandardMaterial({
    color,
    metalness,
    roughness,
    surface,
}: {
    color: string;
    metalness: number;
    roughness: number;
    surface: GroundPatchSurface;
}) {
    return useMemo(
        () =>
            applyGroundPatchMaterial(
                new MeshStandardMaterial({
                    color,
                    metalness,
                    roughness,
                }),
                surface,
                {},
            ),
        [color, metalness, roughness, surface],
    );
}
