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

const roofTileGlowColor = '#ff9a4f';
const roofTileLightPosition = [0, 0.23, 0] as const;
const tileRain = {
    darkness: 0.82,
    glossiness: 0.68,
    topSurfaceBias: 2.2,
};

export function RoofTileLantern({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { materials, nodes } = useGameGLTF('RoofTileLantern');
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
                material={materials['Material.RoofTileLantern.Terracotta']}
                node={nodes.RoofTileLantern_Tiles}
                rain={tileRain}
                snow={{ ...snowPresets.stone, maxThickness: 0.035 }}
            />
            <WeatheredEntityPart
                material={materials['Material.RoofTileLantern.Limestone']}
                node={nodes.RoofTileLantern_LimestoneCore}
                rain={tileRain}
                snow={{ ...snowPresets.stone, maxThickness: 0.025 }}
            />
            <WeatheredEntityPart
                castShadow={false}
                node={nodes.RoofTileLantern_Glow}
                receiveShadow={false}
            >
                <meshStandardMaterial
                    color={roofTileGlowColor}
                    emissive={roofTileGlowColor}
                    emissiveIntensity={0.3}
                    metalness={0}
                    ref={glowMaterialRef}
                    roughness={0.36}
                />
            </WeatheredEntityPart>
            <GardenNightLight
                color={roofTileGlowColor}
                decay={1.9}
                distance={3.4}
                emissiveBaseIntensity={0.3}
                emissiveMaterialRefs={emissiveMaterialRefs}
                emissivePeakIntensity={3.4}
                lightIntensity={1.65}
                lightKey={`RoofTileLantern:${block.id}`}
                position={roofTileLightPosition}
            />
        </animated.group>
    );
}
