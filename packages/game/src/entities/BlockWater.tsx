import { animated } from '@react-spring/three';
import { useEffect, useMemo } from 'react';
import { Color, DoubleSide, ShaderMaterial, Vector4 } from 'three';
import { useSceneTimeUniform } from '../scene/SceneTime';
import { defaultWaterColors } from '../scene/waterColors';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import {
    resolveWaterFoamCorners,
    resolveWaterFoamEdges,
} from './waterBlockFoam';
import { createWaterBlockGeometry } from './waterBlockGeometry';

const waterVertexShader = `
varying vec3 vLocalPosition;
varying vec3 vLocalNormal;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vTopness;

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
    vLocalNormal = normal;
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
    vTopness = smoothstep(0.5, 0.95, normal.y);

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

float foamMotion(float along, float seed) {
    float wave = sin(along * 5.2 + uTime * 2.15 + seed) * 0.5 + 0.5;
    float broken = valueNoise(vec2(along * 1.25 + seed, uTime * 0.72));
    return smoothstep(0.24, 0.82, mix(wave, broken, 0.28));
}

void main() {
    // Hide inner walls that face an adjacent water block — keeps the
    // tiled surface continuous instead of revealing internal partitions.
    if (uDiscardInnerEdges > 0.5) {
        if (vLocalNormal.x < -0.7 && uFoamEdges.x < 0.5) discard;
        if (vLocalNormal.x > 0.7 && uFoamEdges.y < 0.5) discard;
        if (vLocalNormal.z < -0.7 && uFoamEdges.z < 0.5) discard;
        if (vLocalNormal.z > 0.7 && uFoamEdges.w < 0.5) discard;
    }

    float topness = clamp(vTopness, 0.0, 1.0);
    float sideness = 1.0 - topness;
    vec2 topUv = vWorldPosition.xz;

    // Broad, low-detail surface patches drift over the top face only.
    vec2 surfaceFlowA = vec2(uTime * 0.12, -uTime * 0.08);
    vec2 surfaceFlowB = vec2(-uTime * 0.075, uTime * 0.105);
    float surfaceA = valueNoise(topUv * 0.9 + surfaceFlowA);
    float surfaceB = valueNoise(topUv * 1.35 + surfaceFlowB);
    float toonLight = smoothstep(0.46, 0.74, surfaceA);
    float toonDark = smoothstep(0.54, 0.82, 1.0 - surfaceB);
    float surfacePattern = (toonLight * 0.18 - toonDark * 0.12) * topness;
    float tonalShift = surfacePattern;

    // Edge foam — only on edges facing non-water neighbours, animated
    // along the edge so it looks like the water is breaking against the bank.
    float edgeWidth = 0.22;
    float negXBand = 1.0 - smoothstep(0.0, edgeWidth, vLocalPosition.x + 0.5);
    float posXBand = 1.0 - smoothstep(0.0, edgeWidth, 0.5 - vLocalPosition.x);
    float negZBand = 1.0 - smoothstep(0.0, edgeWidth, vLocalPosition.z + 0.5);
    float posZBand = 1.0 - smoothstep(0.0, edgeWidth, 0.5 - vLocalPosition.z);
    float cornerWidth = edgeWidth * 1.6;
    float negXCornerBand = 1.0 - smoothstep(0.0, cornerWidth, vLocalPosition.x + 0.5);
    float posXCornerBand = 1.0 - smoothstep(0.0, cornerWidth, 0.5 - vLocalPosition.x);
    float negZCornerBand = 1.0 - smoothstep(0.0, cornerWidth, vLocalPosition.z + 0.5);
    float posZCornerBand = 1.0 - smoothstep(0.0, cornerWidth, 0.5 - vLocalPosition.z);
    float negXEdge = negXBand * uFoamEdges.x * foamMotion(vWorldPosition.z, 0.0);
    float posXEdge = posXBand * uFoamEdges.y * foamMotion(vWorldPosition.z, 1.7);
    float negZEdge = negZBand * uFoamEdges.z * foamMotion(vWorldPosition.x, 3.4);
    float posZEdge = posZBand * uFoamEdges.w * foamMotion(vWorldPosition.x, 5.1);
    float edgeFoam = max(max(negXEdge, posXEdge), max(negZEdge, posZEdge));

    float negXNegZCorner = negXCornerBand * negZCornerBand * uFoamCorners.x * foamMotion(vWorldPosition.x + vWorldPosition.z, 6.8);
    float posXNegZCorner = posXCornerBand * negZCornerBand * uFoamCorners.y * foamMotion(vWorldPosition.x - vWorldPosition.z, 8.5);
    float negXPosZCorner = negXCornerBand * posZCornerBand * uFoamCorners.z * foamMotion(vWorldPosition.z - vWorldPosition.x, 10.2);
    float posXPosZCorner = posXCornerBand * posZCornerBand * uFoamCorners.w * foamMotion(vWorldPosition.x + vWorldPosition.z, 11.9);
    float cornerFoam = max(max(negXNegZCorner, posXNegZCorner), max(negXPosZCorner, posXPosZCorner));
    float foamNoise = valueNoise(topUv * 3.2 + vec2(uTime * 0.34, -uTime * 0.26));
    edgeFoam = max(edgeFoam, cornerFoam * 0.95) * (0.78 + 0.22 * smoothstep(0.18, 0.82, foamNoise));

    float topFoam = edgeFoam * topness * 0.9;
    float fallingFoam = edgeFoam * sideness * 0.12;
    float foam = clamp(max(topFoam, fallingFoam), 0.0, 1.0);

    float depth = clamp(0.34 + tonalShift + topness * 0.06, 0.0, 1.0);
    vec3 water = mix(uDeepColor, uShallowColor, depth);

    float light = clamp(dot(normalize(vWorldNormal), normalize(vec3(-0.35, 0.9, 0.25))), 0.0, 1.0);
    water *= 0.86 + light * 0.16 + topness * 0.05;
    water *= 1.0 + surfacePattern * 0.38;

    float foamBlend = foam * mix(0.18, 0.85, topness);
    vec3 color = mix(water, uFoamColor, foamBlend);
    float baseAlpha = mix(0.47, 0.42, topness);
    float surfaceAlpha = surfacePattern * 0.008;
    float alpha = clamp(baseAlpha + surfaceAlpha + foam * 0.055 + sideness * 0.04, 0.3, 0.58);

    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
}
`;

const emptyWaterFoamCorners = new Vector4(0, 0, 0, 0);

export function useWaterBlockMaterial(
    foamEdges: Vector4,
    discardInnerEdges = true,
    foamCorners: Vector4 = emptyWaterFoamCorners,
) {
    const waterColors = useGameState((state) => state.waterColors);
    const timeUniform = useSceneTimeUniform();
    const material = useMemo(() => {
        const waterMaterial = new ShaderMaterial({
            vertexShader: waterVertexShader,
            fragmentShader: waterFragmentShader,
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
            },
        });
        waterMaterial.polygonOffset = true;
        waterMaterial.polygonOffsetFactor = -0.5;
        waterMaterial.polygonOffsetUnits = -0.5;
        return waterMaterial;
    }, [discardInnerEdges, foamCorners, foamEdges, timeUniform]);

    useEffect(() => {
        material.uniforms.uFoamEdges.value.copy(foamEdges);
        material.uniforms.uFoamCorners.value.copy(foamCorners);
        material.uniforms.uDiscardInnerEdges.value = discardInnerEdges ? 1 : 0;
    }, [discardInnerEdges, foamCorners, foamEdges, material]);

    useEffect(() => {
        material.uniforms.uDeepColor.value.set(waterColors.deep);
        material.uniforms.uShallowColor.value.set(waterColors.shallow);
        material.uniforms.uFoamColor.value.set(waterColors.foam);
    }, [material, waterColors.deep, waterColors.foam, waterColors.shallow]);

    useEffect(() => () => material.dispose(), [material]);

    return material;
}

export function BlockWater({ stack, block, stacks }: EntityInstanceProps) {
    const currentStackHeight = useStackHeight(stack, block);
    const foamEdges = useMemo(
        () => resolveWaterFoamEdges({ block, stack, stacks }),
        [block, stack, stacks],
    );
    const foamCorners = useMemo(
        () => resolveWaterFoamCorners({ block, stack, stacks }),
        [block, stack, stacks],
    );
    const includeTop = stack.blocks.indexOf(block) === stack.blocks.length - 1;
    const geometry = useMemo(
        () => createWaterBlockGeometry(foamEdges, { includeTop }),
        [foamEdges, includeTop],
    );
    const material = useWaterBlockMaterial(foamEdges, true, foamCorners);

    useEffect(() => () => geometry.dispose(), [geometry]);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.14)}
        >
            <mesh
                receiveShadow
                geometry={geometry}
                material={material}
                renderOrder={1}
            />
        </animated.group>
    );
}
