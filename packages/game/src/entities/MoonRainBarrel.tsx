import { animated } from '@react-spring/three';
import { MeshDistortMaterial } from '@react-three/drei';
import { type ElementRef, useMemo, useRef } from 'react';
import { DoubleSide, type MeshStandardMaterial } from 'three';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { GardenNightLight } from './helpers/GardenNightLight';
import {
    resolveTimeDrivenMaterialSpeed,
    useTimeDrivenMaterialAnimation,
} from './helpers/timeDrivenMaterialAnimation';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

const moonWaterColor = '#358ca3';
const moonWaterEmissive = '#2b6e9b';
const moonStoneColor = '#40515a';
const moonStoneEmissive = '#6b94ad';
const moonLightPosition = [0, 0.72, 0] as const;
const barrelRain = {
    darkness: 0.76,
    glossiness: 0.72,
    topSurfaceBias: 2.4,
};
const metalRain = {
    darkness: 0.7,
    glossiness: 0.9,
    topSurfaceBias: 2.8,
};

export function MoonRainBarrel({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { materials, nodes } = useGameGLTF('MoonRainBarrel');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const waterMaterialRef =
        useRef<ElementRef<typeof MeshDistortMaterial>>(null);
    const moonStoneMaterialRef = useRef<MeshStandardMaterial>(null);
    const emissiveMaterialRefs = useMemo(
        () => [waterMaterialRef, moonStoneMaterialRef],
        [],
    );
    const materialAnimationActive = useTimeDrivenMaterialAnimation();

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <WeatheredEntityPart
                material={materials['Material.MoonRainBarrel.Wood']}
                node={nodes.MoonRainBarrel_Staves}
                rain={barrelRain}
                snow={{ ...snowPresets.tool, maxThickness: 0.04 }}
            />
            <WeatheredEntityPart
                material={materials['Material.MoonRainBarrel.Zinc']}
                node={nodes.MoonRainBarrel_Bands}
                rain={metalRain}
                snow={snowPresets.tool}
            />
            <WeatheredEntityPart
                material={materials['Material.MoonRainBarrel.Brass']}
                node={nodes.MoonRainBarrel_Tap}
                rain={metalRain}
                snow={snowPresets.tool}
            />
            <WeatheredEntityPart
                material={materials['Material.MoonRainBarrel.Limestone']}
                node={nodes.MoonRainBarrel_LimestoneFeet}
                rain={barrelRain}
                snow={snowPresets.stone}
            />
            <WeatheredEntityPart
                material={materials['Material.MoonRainBarrel.Wood']}
                node={nodes.MoonRainBarrel_Lid}
                rain={barrelRain}
                snow={{ ...snowPresets.tool, maxThickness: 0.035 }}
            />
            <WeatheredEntityPart
                castShadow={false}
                node={nodes.MoonRainBarrel_MoonStone}
                receiveShadow={false}
            >
                <meshStandardMaterial
                    color={moonStoneColor}
                    emissive={moonStoneEmissive}
                    emissiveIntensity={0.14}
                    metalness={0}
                    ref={moonStoneMaterialRef}
                    roughness={0.48}
                />
            </WeatheredEntityPart>
            <WeatheredEntityPart
                castShadow={false}
                node={nodes.MoonRainBarrel_Water}
                receiveShadow={false}
            >
                <MeshDistortMaterial
                    color={moonWaterColor}
                    depthWrite={false}
                    distort={0.1}
                    emissive={moonWaterEmissive}
                    emissiveIntensity={0.12}
                    metalness={0.08}
                    opacity={0.82}
                    ref={waterMaterialRef}
                    roughness={0.3}
                    side={DoubleSide}
                    speed={resolveTimeDrivenMaterialSpeed(
                        0.55,
                        materialAnimationActive,
                    )}
                    transparent
                />
            </WeatheredEntityPart>
            <WeatheredEntityPart
                material={materials['Material.MoonRainBarrel.Leaf']}
                node={nodes.MoonRainBarrel_Leaf}
            />
            <GardenNightLight
                color={moonWaterColor}
                decay={1.9}
                distance={4.2}
                emissiveBaseIntensity={0.12}
                emissiveMaterialRefs={emissiveMaterialRefs}
                emissivePeakIntensity={2.1}
                lightIntensity={1.35}
                lightKey={`MoonRainBarrel:${block.id}`}
                position={moonLightPosition}
            />
        </animated.group>
    );
}
