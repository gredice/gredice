import { animated } from '@react-spring/three';
import { useMemo, useRef } from 'react';
import type { MeshStandardMaterial } from 'three';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { GardenNightLight } from './helpers/GardenNightLight';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

const lightColor = '#ffb93b';
const bulbColor = '#000000';
const lightPosition = [0, 1.82, 0] as const;
const poleRain = {
    darkness: 0.7,
    glossiness: 0.78,
    topSurfaceBias: 2.7,
};

export function DoubleGardenLightPole({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { materials, nodes } = useGameGLTF('DoubleGardenLightPole');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const leftGlowMaterialRef = useRef<MeshStandardMaterial>(null);
    const rightGlowMaterialRef = useRef<MeshStandardMaterial>(null);
    const emissiveMaterialRefs = useMemo(
        () => [leftGlowMaterialRef, rightGlowMaterialRef],
        [],
    );

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <WeatheredEntityPart
                material={materials['Material.DoubleGardenLightPole.Limestone']}
                node={nodes.DoubleGardenLightPole_LimestoneBase}
                rain={poleRain}
                snow={{ ...snowPresets.stone, maxThickness: 0.035 }}
            />
            <WeatheredEntityPart
                material={materials['Material.DoubleGardenLightPole.WarmWood']}
                node={nodes.DoubleGardenLightPole_Wood}
                rain={poleRain}
                snow={{ ...snowPresets.tool, maxThickness: 0.018 }}
            />
            <WeatheredEntityPart
                material={
                    materials['Material.DoubleGardenLightPole.WarmEnamel']
                }
                node={nodes.DoubleGardenLightPole_Shades}
                rain={poleRain}
                snow={{ ...snowPresets.tool, maxThickness: 0.025 }}
            />
            <WeatheredEntityPart
                material={materials['Material.DoubleGardenLightPole.DarkMetal']}
                node={nodes.DoubleGardenLightPole_DarkMetal}
                rain={poleRain}
                snow={{ ...snowPresets.tool, maxThickness: 0.018 }}
            />
            <WeatheredEntityPart
                castShadow={false}
                node={nodes.DoubleGardenLightPole_BulbLeft}
                receiveShadow={false}
            >
                <meshStandardMaterial
                    color={bulbColor}
                    emissive={lightColor}
                    emissiveIntensity={0.28}
                    metalness={0}
                    ref={leftGlowMaterialRef}
                    roughness={0.28}
                />
            </WeatheredEntityPart>
            <WeatheredEntityPart
                castShadow={false}
                node={nodes.DoubleGardenLightPole_BulbRight}
                receiveShadow={false}
            >
                <meshStandardMaterial
                    color={bulbColor}
                    emissive={lightColor}
                    emissiveIntensity={0.28}
                    metalness={0}
                    ref={rightGlowMaterialRef}
                    roughness={0.28}
                />
            </WeatheredEntityPart>
            <GardenNightLight
                color={lightColor}
                distance={12}
                emissiveBaseIntensity={0.28}
                emissiveMaterialRefs={emissiveMaterialRefs}
                emissivePeakIntensity={3.2}
                lightIntensity={4.6}
                lightKey={`DoubleGardenLightPole:${block.id}`}
                position={lightPosition}
            />
        </animated.group>
    );
}
