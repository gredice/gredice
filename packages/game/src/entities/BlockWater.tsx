import { animated } from '@react-spring/three';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Color, DoubleSide, ShaderMaterial, type Vector4 } from 'three';
import { defaultWaterColors } from '../scene/waterColors';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { resolveWaterFoamEdges } from './waterBlockFoam';

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

void main() {
    // Hide inner walls that face an adjacent water block — keeps the
    // tiled surface continuous instead of revealing internal partitions.
    if (vLocalNormal.x < -0.7 && uFoamEdges.x < 0.5) discard;
    if (vLocalNormal.x > 0.7 && uFoamEdges.y < 0.5) discard;
    if (vLocalNormal.z < -0.7 && uFoamEdges.z < 0.5) discard;
    if (vLocalNormal.z > 0.7 && uFoamEdges.w < 0.5) discard;

    vec2 worldUv = vWorldPosition.xz;
    float topness = clamp(vTopness, 0.0, 1.0);
    float sideness = 1.0 - topness;

    // Two scrolling noise layers — one lighter, one darker — fading in
    // and out as they pass over each other.
    vec2 scrollA = vec2(uTime * 0.045, uTime * 0.028);
    vec2 scrollB = vec2(-uTime * 0.032, uTime * 0.05);
    float noiseA = valueNoise(worldUv * 2.4 + scrollA);
    float noiseB = valueNoise(worldUv * 4.1 + scrollB);
    float lightLayer = smoothstep(0.42, 0.88, noiseA);
    float darkLayer = smoothstep(0.42, 0.88, 1.0 - noiseB);
    float tonalShift = lightLayer * 0.18 - darkLayer * 0.16;

    // Edge foam — only on edges facing non-water neighbours, animated
    // along the edge so it looks like the water is breaking against the bank.
    float edgeWidth = 0.14;
    float negXEdge = (1.0 - smoothstep(0.0, edgeWidth, vLocalPosition.x + 0.5)) * uFoamEdges.x;
    float posXEdge = (1.0 - smoothstep(0.0, edgeWidth, 0.5 - vLocalPosition.x)) * uFoamEdges.y;
    float negZEdge = (1.0 - smoothstep(0.0, edgeWidth, vLocalPosition.z + 0.5)) * uFoamEdges.z;
    float posZEdge = (1.0 - smoothstep(0.0, edgeWidth, 0.5 - vLocalPosition.z)) * uFoamEdges.w;
    float edgeFoam = max(max(negXEdge, posXEdge), max(negZEdge, posZEdge));

    float foamNoise = valueNoise(worldUv * 5.5 + vec2(uTime * 0.22, -uTime * 0.18));
    float foamPulse = 0.35 + 0.65 * smoothstep(0.2, 0.85, foamNoise);
    edgeFoam *= foamPulse;

    float topFoam = edgeFoam * topness * 0.62;
    float fallingFoam = edgeFoam * sideness * 0.38;
    float foam = clamp(max(topFoam, fallingFoam), 0.0, 1.0);

    float depth = clamp(0.42 + tonalShift + topness * 0.08, 0.0, 1.0);
    vec3 water = mix(uDeepColor, uShallowColor, depth);

    float light = clamp(dot(normalize(vWorldNormal), normalize(vec3(-0.35, 0.9, 0.25))), 0.0, 1.0);
    water *= 0.86 + light * 0.16 + topness * 0.05;

    vec3 color = mix(water, uFoamColor, foam);
    float baseAlpha = mix(0.58, 0.42, topness);
    float alpha = clamp(baseAlpha + foam * 0.22 + sideness * 0.08, 0.4, 0.82);

    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
}
`;

function useWaterBlockMaterial(foamEdges: Vector4) {
    const waterColors = useGameState((state) => state.waterColors);
    const material = useMemo(() => {
        const waterMaterial = new ShaderMaterial({
            vertexShader: waterVertexShader,
            fragmentShader: waterFragmentShader,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            side: DoubleSide,
            uniforms: {
                uTime: { value: 0 },
                uDeepColor: { value: new Color(defaultWaterColors.deep) },
                uShallowColor: {
                    value: new Color(defaultWaterColors.shallow),
                },
                uFoamColor: { value: new Color(defaultWaterColors.foam) },
                uFoamEdges: { value: foamEdges.clone() },
            },
        });
        waterMaterial.polygonOffset = true;
        waterMaterial.polygonOffsetFactor = -0.5;
        waterMaterial.polygonOffsetUnits = -0.5;
        return waterMaterial;
    }, [foamEdges]);

    useEffect(() => {
        material.uniforms.uFoamEdges.value.copy(foamEdges);
    }, [foamEdges, material]);

    useEffect(() => {
        material.uniforms.uDeepColor.value.set(waterColors.deep);
        material.uniforms.uShallowColor.value.set(waterColors.shallow);
        material.uniforms.uFoamColor.value.set(waterColors.foam);
    }, [material, waterColors.deep, waterColors.foam, waterColors.shallow]);

    useEffect(() => () => material.dispose(), [material]);

    useFrame(({ clock }) => {
        material.uniforms.uTime.value = clock.elapsedTime;
    });

    return material;
}

export function BlockWater({ stack, block, stacks }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('BlockSand');
    const currentStackHeight = useStackHeight(stack, block);
    const foamEdges = useMemo(
        () => resolveWaterFoamEdges({ block, stack, stacks }),
        [block, stack, stacks],
    );
    const material = useWaterBlockMaterial(foamEdges);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.14)}
        >
            <mesh
                receiveShadow
                geometry={nodes.Block_Sand_1.geometry}
                material={material}
                renderOrder={1}
            />
        </animated.group>
    );
}
