import { useMemo, useRef } from 'react';
import type { MeshStandardMaterial } from 'three';
import { animated } from '../scene/sceneSpring';
import { seasonalEmissive, seasonalRoles } from '../scene/seasonalRoles';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { GardenNightLight } from './helpers/GardenNightLight';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

// The lantern glow role: its day colour on the core, its emissive at night.
const wickerGlowColor = seasonalEmissive.lanternGlow;
const wickerSource = seasonalRoles.lanternGlow;
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
                    color={wickerSource.albedo}
                    emissive={wickerGlowColor}
                    emissiveIntensity={0.28}
                    metalness={0}
                    ref={glowMaterialRef}
                    roughness={wickerSource.roughness}
                />
            </WeatheredEntityPart>
            <GardenNightLight
                color={wickerGlowColor}
                decay={2}
                distance={3.2}
                emissiveBaseIntensity={0.28}
                emissiveMaterialRefs={emissiveMaterialRefs}
                emissivePeakIntensity={4.6}
                lightIntensity={1.1}
                lightKey={`WickerGardenLantern:${block.id}`}
                position={wickerLightPosition}
            />
        </animated.group>
    );
}
