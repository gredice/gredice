import { animated } from '@react-spring/three';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Color, DoubleSide, ShaderMaterial, type Vector4 } from 'three';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { resolveWaterFoamEdges } from './waterBlockFoam';

const waterVertexShader = `
uniform float uTime;

varying vec3 vLocalPosition;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vTopness;

void main() {
    vec3 transformed = position;

    vec4 baseWorldPosition = vec4(position, 1.0);
    #ifdef USE_INSTANCING
        baseWorldPosition = instanceMatrix * baseWorldPosition;
    #endif
    baseWorldPosition = modelMatrix * baseWorldPosition;

    float topness = smoothstep(0.35, 0.95, normal.y);
    float waveA = sin((baseWorldPosition.x * 1.65 + uTime * 0.16) * 6.28318530718);
    float waveB = sin((baseWorldPosition.z * 1.35 - uTime * 0.13) * 6.28318530718);
    float waveC = sin(((baseWorldPosition.x + baseWorldPosition.z) * 1.05 + uTime * 0.11) * 6.28318530718);
    transformed.y += (waveA * 0.012 + waveB * 0.01 + waveC * 0.006) * topness;

    vec4 worldPosition = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
        worldPosition = instanceMatrix * worldPosition;
    #endif
    worldPosition = modelMatrix * worldPosition;

    vec3 objectNormal = normal;
    #ifdef USE_INSTANCING
        objectNormal = normalize(mat3(instanceMatrix) * objectNormal);
    #endif

    vLocalPosition = position;
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
    vTopness = topness;

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
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vTopness;

float edgeBand(float distanceToEdge, float width) {
    return 1.0 - smoothstep(0.0, width, distanceToEdge);
}

void main() {
    vec2 worldUv = vWorldPosition.xz;
    float topness = clamp(vTopness, 0.0, 1.0);
    float sideness = 1.0 - topness;

    float negXEdge = edgeBand(vLocalPosition.x + 0.5, 0.12) * uFoamEdges.x;
    float posXEdge = edgeBand(0.5 - vLocalPosition.x, 0.12) * uFoamEdges.y;
    float negZEdge = edgeBand(vLocalPosition.z + 0.5, 0.12) * uFoamEdges.z;
    float posZEdge = edgeBand(0.5 - vLocalPosition.z, 0.12) * uFoamEdges.w;
    float edgeFoam = max(max(negXEdge, posXEdge), max(negZEdge, posZEdge));

    float broadWave = sin((worldUv.x * 1.15 + worldUv.y * 0.62 + uTime * 0.08) * 6.28318530718);
    float crossWave = sin((worldUv.x * -0.74 + worldUv.y * 1.18 - uTime * 0.065) * 6.28318530718);
    float softWave = broadWave * 0.5 + crossWave * 0.5;
    float surfaceGlow = smoothstep(-0.72, 0.9, softWave);

    vec2 foamCenter = vec2(0.08, -0.03);
    float centerMask = 1.0 - smoothstep(0.07, 0.34, length(vLocalPosition.xz - foamCenter));
    float centerBreak = sin((worldUv.x * 5.0 - worldUv.y * 3.6 + uTime * 0.12) * 6.28318530718);
    float foamPatch = smoothstep(0.2, 0.96, centerBreak) * centerMask * topness * 0.42;

    float topFoam = edgeFoam * topness * 0.48;
    float fallingFoam = edgeFoam * sideness * (0.28 + surfaceGlow * 0.26);
    float foam = clamp(max(max(topFoam, fallingFoam), foamPatch), 0.0, 1.0);

    float depth = clamp(0.38 + surfaceGlow * 0.26 + topness * 0.12, 0.0, 1.0);
    vec3 water = mix(uDeepColor, uShallowColor, depth);

    float light = clamp(dot(normalize(vWorldNormal), normalize(vec3(-0.35, 0.9, 0.25))), 0.0, 1.0);
    water *= 0.86 + light * 0.16 + topness * 0.05;

    float glint = pow(max(0.0, sin((worldUv.x - worldUv.y + uTime * 0.18) * 12.0)), 20.0) * topness * 0.08;
    vec3 color = mix(water + glint, uFoamColor, foam);
    float baseAlpha = mix(0.52, 0.38, topness);
    float alpha = clamp(baseAlpha + foam * 0.22 + sideness * 0.12, 0.36, 0.76);

    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
}
`;

function useWaterBlockMaterial(foamEdges: Vector4) {
    const material = useMemo(() => {
        const waterMaterial = new ShaderMaterial({
            vertexShader: waterVertexShader,
            fragmentShader: waterFragmentShader,
            transparent: true,
            depthWrite: true,
            depthTest: true,
            side: DoubleSide,
            uniforms: {
                uTime: { value: 0 },
                uDeepColor: { value: new Color('#8fcfc4') },
                uShallowColor: { value: new Color('#d6eee3') },
                uFoamColor: { value: new Color('#f8fff8') },
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
            position={stack.position.clone().setY(currentStackHeight + 0.2)}
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
