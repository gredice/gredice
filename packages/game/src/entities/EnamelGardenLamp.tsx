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

const enamelLightColor = '#ffe6a8';
const enamelLightPosition = [0.075, 1.08, 0] as const;
const lampRain = {
    darkness: 0.72,
    glossiness: 0.82,
    topSurfaceBias: 2.6,
};

export function EnamelGardenLamp({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { materials, nodes } = useGameGLTF('EnamelGardenLamp');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const glowMaterialRef = useRef<MeshStandardMaterial>(null);
    const emissiveMaterialRefs = useMemo(() => [glowMaterialRef], []);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <WeatheredEntityPart
                material={materials['Material.EnamelGardenLamp.Wood']}
                node={nodes.EnamelGardenLamp_WoodPost}
                rain={lampRain}
                snow={snowPresets.tool}
            />
            <WeatheredEntityPart
                material={materials['Material.EnamelGardenLamp.Limestone']}
                node={nodes.EnamelGardenLamp_LimestoneFoot}
                rain={lampRain}
                snow={{ ...snowPresets.stone, maxThickness: 0.035 }}
            />
            <WeatheredEntityPart
                material={materials['Material.EnamelGardenLamp.BlueEnamel']}
                node={nodes.EnamelGardenLamp_EnamelShade}
                rain={lampRain}
                snow={{ ...snowPresets.tool, maxThickness: 0.025 }}
            />
            <WeatheredEntityPart
                material={materials['Material.EnamelGardenLamp.DarkMetal']}
                node={nodes.EnamelGardenLamp_MetalTrim}
                rain={lampRain}
                snow={snowPresets.tool}
            />
            <WeatheredEntityPart
                castShadow={false}
                node={nodes.EnamelGardenLamp_Bulb}
                receiveShadow={false}
            >
                <meshStandardMaterial
                    color={enamelLightColor}
                    emissive={enamelLightColor}
                    emissiveIntensity={0.25}
                    metalness={0}
                    ref={glowMaterialRef}
                    roughness={0.28}
                />
            </WeatheredEntityPart>
            <GardenNightLight
                color={enamelLightColor}
                distance={4.6}
                emissiveBaseIntensity={0.25}
                emissiveMaterialRefs={emissiveMaterialRefs}
                emissivePeakIntensity={3.1}
                lightIntensity={2.2}
                lightKey={`EnamelGardenLamp:${block.id}`}
                position={enamelLightPosition}
            />
        </animated.group>
    );
}
