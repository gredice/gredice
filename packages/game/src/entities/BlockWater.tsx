import { animated } from '@react-spring/three';
import { useEffect, useMemo } from 'react';
import { Color, DoubleSide, ShaderMaterial, Vector4 } from 'three';
import { useBlockData } from '../hooks/useBlockData';
import { useSceneTimeUniform } from '../scene/SceneTime';
import { defaultWaterColors } from '../scene/waterColors';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { getWaterBlockDepthSamples } from './waterBlockDepth';
import {
    resolveWaterFoamCorners,
    resolveWaterFoamEdges,
} from './waterBlockFoam';
import { createWaterBlockGeometry } from './waterBlockGeometry';
import {
    getWaterBlockCenterY,
    getWaterBlockVisualHeight,
} from './waterBlockHeight';
import { isWaterBlockTopSurfaceVisible } from './waterBlockSurface';

const waterVertexShader = `
uniform float uWaterDepth;

varying vec3 vLocalPosition;
varying vec3 vLocalNormal;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vTopness;
varying float vWaterDepth;
varying float vWaterSurfaceY;
varying float vWaterShoreDepth;
#ifdef USE_WATER_LOCAL_POSITION_ATTRIBUTE
attribute vec3 waterLocalPosition;
#endif
#ifdef USE_WATER_DEPTH_ATTRIBUTE
attribute float waterDepth;
attribute float waterSurfaceY;
#endif
#ifdef USE_WATER_SHORE_DEPTH_ATTRIBUTE
attribute float waterShoreDepth;
#endif
#ifdef USE_WATER_FOAM_ATTRIBUTES
attribute vec4 waterFoamEdges;
attribute vec4 waterFoamCorners;
varying vec4 vFoamEdges;
varying vec4 vFoamCorners;
#endif

void main() {
    vec4 worldPosition = vec4(position, 1.0);
    #ifdef USE_INSTANCING
        worldPosition = instanceMatrix * worldPosition;
    #endif
    worldPosition = modelMatrix * worldPosition;

    vec3 objectNormal = normal;
    #ifdef USE_INSTANCING
        objectNormal = normalize(mat3(instanceMatrix) * objectNormal);
    #endif

    vLocalPosition = position;
#ifdef USE_WATER_LOCAL_POSITION_ATTRIBUTE
    vLocalPosition = waterLocalPosition;
#endif
    vLocalNormal = normal;
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
    vTopness = smoothstep(0.5, 0.95, normal.y);
    vWaterDepth = uWaterDepth;
    vWaterSurfaceY = worldPosition.y;
#ifdef USE_WATER_DEPTH_ATTRIBUTE
    vWaterDepth = waterDepth;
    vWaterSurfaceY = waterSurfaceY;
#endif
    vWaterShoreDepth = 0.0;
#ifdef USE_WATER_SHORE_DEPTH_ATTRIBUTE
    vWaterShoreDepth = waterShoreDepth;
#endif
#ifdef USE_WATER_FOAM_ATTRIBUTES
    vFoamEdges = waterFoamEdges;
    vFoamCorners = waterFoamCorners;
#endif

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const waterFragmentShader = `
uniform float uTime;
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uFoamColor;
uniform vec4 uFoamEdges;
uniform vec4 uFoamCorners;
uniform float uDiscardInnerEdges;

varying vec3 vLocalPosition;
varying vec3 vLocalNormal;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vTopness;
varying float vWaterDepth;
varying float vWaterSurfaceY;
varying float vWaterShoreDepth;
#ifdef USE_WATER_FOAM_ATTRIBUTES
varying vec4 vFoamEdges;
varying vec4 vFoamCorners;
#endif

float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float foamMotion(vec2 p, float seed) {
    float foamTime = uTime * 1.7;
    vec2 driftA = vec2(foamTime * 0.045, -foamTime * 0.035);
    vec2 driftB = vec2(-foamTime * 0.028, foamTime * 0.032);
    float broad = valueNoise(p * 1.85 + driftA + vec2(seed, seed * 0.37));
    float broken = valueNoise(p * 4.9 + driftB + vec2(seed * 1.91, -seed * 0.73));
    float flecks = valueNoise(p * 9.2 - driftA * 1.35 + vec2(seed * 3.4, seed * 1.2));
    float thresholdDrift = valueNoise(vec2(seed * 2.17, foamTime * 0.075)) * 0.08;
    float field = broad * 0.52 + broken * 0.34 + flecks * 0.14;
    return smoothstep(0.34 + thresholdDrift, 0.66 + thresholdDrift, field);
}

void main() {
    vec4 foamEdges = uFoamEdges;
    vec4 foamCorners = uFoamCorners;
#ifdef USE_WATER_FOAM_ATTRIBUTES
    foamEdges = vFoamEdges;
    foamCorners = vFoamCorners;
#endif

    // Hide inner walls that face an adjacent water block — keeps the
    // tiled surface continuous instead of revealing internal partitions.
    if (uDiscardInnerEdges > 0.5) {
        if (vLocalNormal.x < -0.7 && foamEdges.x < 0.5) discard;
        if (vLocalNormal.x > 0.7 && foamEdges.y < 0.5) discard;
        if (vLocalNormal.z < -0.7 && foamEdges.z < 0.5) discard;
        if (vLocalNormal.z > 0.7 && foamEdges.w < 0.5) discard;
    }

    float topness = clamp(vTopness, 0.0, 1.0);
    float sideness = 1.0 - topness;
    float columnDepth = max(vWaterDepth, 0.0);
    float fragmentDepth = max((vWaterSurfaceY - vWorldPosition.y) / 0.4, 0.0);
    float shoreDepth = max(vWaterShoreDepth, 0.0);
    float columnDepth01 = smoothstep(0.02, 2.35, columnDepth);
    float volumeDepth01 = smoothstep(0.02, 2.35, fragmentDepth);
    float sideVertical01 = smoothstep(0.0, 1.35, fragmentDepth);
    float sideDepth01 = clamp(
        max(columnDepth01, volumeDepth01 * 0.72) +
            sideVertical01 * mix(0.16, 0.08, columnDepth01),
        0.0,
        1.0
    );
    float depthMap01 = mix(sideDepth01, columnDepth01, topness);
    float shoreInfluence = 1.0 - smoothstep(0.0, 0.95, shoreDepth);
    float coastDepthLift = smoothstep(0.28, 1.1, shoreDepth) * (1.0 - depthMap01) * 0.06;
    float depth01 = clamp(depthMap01 + coastDepthLift, 0.0, 1.0);
    depth01 = mix(
        depth01,
        min(depth01, 0.06 + columnDepth01 * 0.2),
        shoreInfluence * topness
    );
    float deepInfluence = max(
        smoothstep(1.05, 2.6, shoreDepth) * 0.12,
        smoothstep(0.18, 0.88, depth01)
    );
    vec2 topUv = vWorldPosition.xz;

    // Broad, low-detail surface patches drift over the top face only.
    vec2 surfaceFlowA = vec2(uTime * 0.12, -uTime * 0.08);
    vec2 surfaceFlowB = vec2(-uTime * 0.075, uTime * 0.105);
    float surfaceA = valueNoise(topUv * 0.9 + surfaceFlowA);
    float surfaceB = valueNoise(topUv * 1.35 + surfaceFlowB);
    float toonLight = smoothstep(0.46, 0.74, surfaceA);
    float toonDark = smoothstep(0.54, 0.82, 1.0 - surfaceB);
    float causticLines = smoothstep(
        0.86,
        0.995,
        sin((topUv.x + topUv.y * 0.56) * 7.2 + uTime * 0.75 + surfaceA * 2.1) * 0.5 + 0.5
    );
    float shallowCaustics = causticLines * shoreInfluence * topness * 0.1;
    float surfacePattern =
        (toonLight * 0.18 - toonDark * 0.12 + shallowCaustics) *
        topness *
        mix(1.1, 0.7, depth01);
    float tonalShift = surfacePattern;

    // Edge foam follows the global shore-distance field on chunked water, so
    // the pattern can cross tile boundaries and softly fade away from banks.
    float edgeWidth = mix(0.34, 0.22, smoothstep(0.08, 0.9, shoreDepth));
    float negXBand = 1.0 - smoothstep(0.0, edgeWidth, vLocalPosition.x + 0.5);
    float posXBand = 1.0 - smoothstep(0.0, edgeWidth, 0.5 - vLocalPosition.x);
    float negZBand = 1.0 - smoothstep(0.0, edgeWidth, vLocalPosition.z + 0.5);
    float posZBand = 1.0 - smoothstep(0.0, edgeWidth, 0.5 - vLocalPosition.z);
    float cornerWidth = edgeWidth * 1.9;
    float negXCornerBand = 1.0 - smoothstep(0.0, cornerWidth, vLocalPosition.x + 0.5);
    float posXCornerBand = 1.0 - smoothstep(0.0, cornerWidth, 0.5 - vLocalPosition.x);
    float negZCornerBand = 1.0 - smoothstep(0.0, cornerWidth, vLocalPosition.z + 0.5);
    float posZCornerBand = 1.0 - smoothstep(0.0, cornerWidth, 0.5 - vLocalPosition.z);
    float localEdgeBand = max(
        max(negXBand * foamEdges.x, posXBand * foamEdges.y),
        max(negZBand * foamEdges.z, posZBand * foamEdges.w)
    );
    float localCornerBand = max(
        max(negXCornerBand * negZCornerBand * foamCorners.x, posXCornerBand * negZCornerBand * foamCorners.y),
        max(negXCornerBand * posZCornerBand * foamCorners.z, posXCornerBand * posZCornerBand * foamCorners.w)
    );
    float shoreFoamFade = max(localEdgeBand, localCornerBand);
    float shoreFoamCore = shoreFoamFade;
#ifdef USE_WATER_SHORE_DEPTH_ATTRIBUTE
    shoreFoamFade = 1.0 - smoothstep(0.03, 0.62, shoreDepth);
    shoreFoamCore = 1.0 - smoothstep(0.0, 0.22, shoreDepth);
#endif
    float globalFoam = max(
        foamMotion(topUv, 0.0),
        foamMotion(topUv + vec2(3.7, -2.4), 4.2) * 0.82
    );
    float foamNoise = valueNoise(topUv * 3.2 + vec2(uTime * 0.119, -uTime * 0.085));
    float shoreFoamBreakup = 0.96 + 0.28 * smoothstep(0.12, 0.66, foamNoise);
    float shoreFoamField =
        max(globalFoam, shoreFoamCore * 0.58) *
        shoreFoamFade *
        shoreFoamBreakup;

    float topFoam = smoothstep(0.08, 0.4, shoreFoamField) * topness * mix(0.95, 1.55, shoreFoamCore);
    float fallingFoam = smoothstep(0.1, 0.55, shoreFoamField) * sideness * 0.16;
    float foam = clamp(max(topFoam, fallingFoam), 0.0, 1.0);

    vec3 shallowWater = mix(uShallowColor, uFoamColor, shoreInfluence * topness * 0.08);
    vec3 deepWater = mix(uDeepColor, uDeepColor * vec3(0.52, 0.72, 1.14), deepInfluence * 0.52);
    vec3 water = mix(shallowWater, deepWater, smoothstep(0.02, 0.84, depth01));

    float light = clamp(dot(normalize(vWorldNormal), normalize(vec3(-0.35, 0.9, 0.25))), 0.0, 1.0);
    water *= 0.86 + light * 0.16 + topness * 0.05;
    water *= 1.0 + surfacePattern * 0.38;
    water = mix(water, uDeepColor * vec3(0.56, 0.68, 1.08), depth01 * topness * 0.22);

    float foamBlend = foam * mix(0.22, 1.0, topness) * (1.0 + shoreInfluence * 0.18);
    vec3 color = mix(water, uFoamColor, foamBlend);
    float topAlpha = mix(0.48, 1.0, smoothstep(0.06, 0.72, depth01));
    float baseAlpha = mix(0.58, topAlpha, topness);
    float surfaceAlpha = surfacePattern * 0.008;
    float alpha = clamp(baseAlpha + surfaceAlpha + foam * 0.055 + sideness * 0.04, 0.36, 1.0);

    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
}
`;

const emptyWaterFoamCorners = new Vector4(0, 0, 0, 0);

type WaterBlockMaterialOptions = {
    useFoamAttributes?: boolean;
    useLocalPositionAttribute?: boolean;
    useWaterDepthAttribute?: boolean;
    useShoreDepthAttribute?: boolean;
    waterDepth?: number;
};

export function useWaterBlockMaterial(
    foamEdges: Vector4,
    discardInnerEdges = true,
    foamCorners: Vector4 = emptyWaterFoamCorners,
    options: WaterBlockMaterialOptions = {},
) {
    const waterColors = useGameState((state) => state.waterColors);
    const timeUniform = useSceneTimeUniform();
    const useFoamAttributes = options.useFoamAttributes === true;
    const useLocalPositionAttribute =
        options.useLocalPositionAttribute === true;
    const useWaterDepthAttribute = options.useWaterDepthAttribute === true;
    const useShoreDepthAttribute = options.useShoreDepthAttribute === true;
    const waterDepth = options.waterDepth ?? 0;
    const material = useMemo(() => {
        const waterMaterial = new ShaderMaterial({
            vertexShader: waterVertexShader,
            fragmentShader: waterFragmentShader,
            defines: {
                ...(useFoamAttributes ? { USE_WATER_FOAM_ATTRIBUTES: '' } : {}),
                ...(useLocalPositionAttribute
                    ? { USE_WATER_LOCAL_POSITION_ATTRIBUTE: '' }
                    : {}),
                ...(useWaterDepthAttribute
                    ? { USE_WATER_DEPTH_ATTRIBUTE: '' }
                    : {}),
                ...(useShoreDepthAttribute
                    ? { USE_WATER_SHORE_DEPTH_ATTRIBUTE: '' }
                    : {}),
            },
            transparent: true,
            depthWrite: false,
            depthTest: true,
            side: DoubleSide,
            uniforms: {
                uTime: timeUniform,
                uDeepColor: { value: new Color(defaultWaterColors.deep) },
                uShallowColor: {
                    value: new Color(defaultWaterColors.shallow),
                },
                uFoamColor: { value: new Color(defaultWaterColors.foam) },
                uFoamEdges: { value: foamEdges.clone() },
                uFoamCorners: { value: foamCorners.clone() },
                uDiscardInnerEdges: { value: discardInnerEdges ? 1 : 0 },
                uWaterDepth: { value: waterDepth },
            },
        });
        waterMaterial.polygonOffset = true;
        waterMaterial.polygonOffsetFactor = -0.5;
        waterMaterial.polygonOffsetUnits = -0.5;
        return waterMaterial;
    }, [
        discardInnerEdges,
        foamCorners,
        foamEdges,
        timeUniform,
        useFoamAttributes,
        useLocalPositionAttribute,
        useWaterDepthAttribute,
        useShoreDepthAttribute,
        waterDepth,
    ]);

    useEffect(() => {
        material.uniforms.uFoamEdges.value.copy(foamEdges);
        material.uniforms.uFoamCorners.value.copy(foamCorners);
        material.uniforms.uDiscardInnerEdges.value = discardInnerEdges ? 1 : 0;
        material.uniforms.uWaterDepth.value = waterDepth;
    }, [discardInnerEdges, foamCorners, foamEdges, material, waterDepth]);

    useEffect(() => {
        material.uniforms.uDeepColor.value.set(waterColors.deep);
        material.uniforms.uShallowColor.value.set(waterColors.shallow);
        material.uniforms.uFoamColor.value.set(waterColors.foam);
    }, [material, waterColors.deep, waterColors.foam, waterColors.shallow]);

    useEffect(() => () => material.dispose(), [material]);

    return material;
}

export function BlockWater({ stack, block, stacks }: EntityInstanceProps) {
    const { data: blockData } = useBlockData();
    const waterHeight = getWaterBlockVisualHeight({
        block,
        blockData,
        stack,
    });
    const waterCenterY = getWaterBlockCenterY({
        block,
        blockData,
        stack,
    });
    const foamEdges = useMemo(
        () => resolveWaterFoamEdges({ block, blockData, stack, stacks }),
        [block, blockData, stack, stacks],
    );
    const foamCorners = useMemo(
        () => resolveWaterFoamCorners({ block, blockData, stack, stacks }),
        [block, blockData, stack, stacks],
    );
    const includeTop = isWaterBlockTopSurfaceVisible({ block, stack });
    const waterDepth = Math.max(
        ...getWaterBlockDepthSamples({ block, blockData, stack }),
    );
    const geometry = useMemo(
        () =>
            createWaterBlockGeometry(foamEdges, {
                height: waterHeight,
                includeTop,
            }),
        [foamEdges, includeTop, waterHeight],
    );
    const material = useWaterBlockMaterial(foamEdges, true, foamCorners, {
        waterDepth,
    });

    useEffect(() => () => geometry.dispose(), [geometry]);

    return (
        <animated.group position={stack.position.clone().setY(waterCenterY)}>
            <mesh
                receiveShadow
                geometry={geometry}
                material={material}
                renderOrder={1}
            />
        </animated.group>
    );
}
