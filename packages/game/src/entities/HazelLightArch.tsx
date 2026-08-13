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
import { getStackedOnWalkwayPlacementYOffset } from './walkwayPlacement';

const archLightColor = '#ffb93b';
const archBulbColor = '#000000';
const archLightPosition = [0, 1.2, 0] as const;
const archRain = {
    darkness: 0.7,
    glossiness: 0.65,
    topSurfaceBias: 2.4,
};

export function HazelLightArch({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { materials, nodes } = useGameGLTF('HazelLightArch');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const glowMaterialRef = useRef<MeshStandardMaterial>(null);
    const emissiveMaterialRefs = useMemo(() => [glowMaterialRef], []);
    const placementYOffset = getStackedOnWalkwayPlacementYOffset(stack, block);
    const position = stack.position
        .clone()
        .setY(currentStackHeight + placementYOffset);

    return (
        <animated.group
            position={position}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <WeatheredEntityPart
                material={materials['Material.HazelLightArch.HazelWood']}
                node={nodes.HazelLightArch_Poles}
                rain={archRain}
                snow={{ ...snowPresets.tool, maxThickness: 0.035 }}
            />
            <WeatheredEntityPart
                material={materials['Material.HazelLightArch.Terracotta']}
                node={nodes.HazelLightArch_TerracottaShades}
                rain={archRain}
                snow={{ ...snowPresets.tool, maxThickness: 0.025 }}
            />
            <WeatheredEntityPart
                material={materials['Material.HazelLightArch.DarkCord']}
                node={nodes.HazelLightArch_Cords}
                rain={archRain}
            />
            <WeatheredEntityPart
                castShadow={false}
                node={nodes.HazelLightArch_Bulbs}
                receiveShadow={false}
            >
                <meshStandardMaterial
                    color={archBulbColor}
                    emissive={archLightColor}
                    emissiveIntensity={0.25}
                    metalness={0}
                    ref={glowMaterialRef}
                    roughness={0.3}
                />
            </WeatheredEntityPart>
            <GardenNightLight
                color={archLightColor}
                distance={15}
                emissiveBaseIntensity={0.25}
                emissiveMaterialRefs={emissiveMaterialRefs}
                emissivePeakIntensity={3.2}
                lightIntensity={5.6}
                lightKey={`HazelLightArch:${block.id}`}
                position={archLightPosition}
            />
        </animated.group>
    );
}
