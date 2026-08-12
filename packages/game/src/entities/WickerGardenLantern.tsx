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

const wickerGlowColor = '#ffc56d';
const wickerLightPosition = [0, 0.38, 0] as const;
const wickerRain = {
    darkness: 0.75,
    glossiness: 0.55,
    topSurfaceBias: 2.5,
};

export function WickerGardenLantern({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { materials, nodes } = useGameGLTF('WickerGardenLantern');
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
                material={materials['Material.WickerGardenLantern.Wicker']}
                node={nodes.WickerGardenLantern_Wicker}
                rain={wickerRain}
                snow={{ ...snowPresets.tool, maxThickness: 0.04 }}
            />
            <WeatheredEntityPart
                material={materials['Material.WickerGardenLantern.Terracotta']}
                node={nodes.WickerGardenLantern_TerracottaBase}
                rain={wickerRain}
                snow={{ ...snowPresets.stone, maxThickness: 0.035 }}
            />
            <WeatheredEntityPart
                material={materials['Material.WickerGardenLantern.Limestone']}
                node={nodes.WickerGardenLantern_LimestoneBase}
                rain={wickerRain}
                snow={{ ...snowPresets.stone, maxThickness: 0.035 }}
            />
            <WeatheredEntityPart
                castShadow={false}
                node={nodes.WickerGardenLantern_Glow}
                receiveShadow={false}
            >
                <meshStandardMaterial
                    color={wickerGlowColor}
                    emissive={wickerGlowColor}
                    emissiveIntensity={0.28}
                    metalness={0}
                    ref={glowMaterialRef}
                    roughness={0.34}
                />
            </WeatheredEntityPart>
            <GardenNightLight
                color={wickerGlowColor}
                distance={4.1}
                emissiveBaseIntensity={0.28}
                emissiveMaterialRefs={emissiveMaterialRefs}
                emissivePeakIntensity={3.05}
                lightIntensity={1.9}
                lightKey={`WickerGardenLantern:${block.id}`}
                position={wickerLightPosition}
            />
        </animated.group>
    );
}
