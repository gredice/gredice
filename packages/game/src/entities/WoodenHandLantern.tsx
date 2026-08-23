import { animated } from '@react-spring/three';
import { useMemo, useRef } from 'react';
import { DoubleSide, type MeshStandardMaterial } from 'three';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { GardenNightLight } from './helpers/GardenNightLight';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

const handLanternGlowColor = '#ffb733';
const handLanternSourceColor = '#000000';
const handLanternLightPosition = [0, 0.2475, 0] as const;
const handLanternRain = {
    darkness: 0.72,
    glossiness: 0.7,
    topSurfaceBias: 2.6,
};

export function WoodenHandLantern({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { materials, nodes } = useGameGLTF('WoodenHandLantern');
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
                material={materials['Material.WoodenHandLantern.Wood']}
                node={nodes.WoodenHandLantern_Frame}
                rain={handLanternRain}
                snow={snowPresets.tool}
            />
            <WeatheredEntityPart
                material={materials['Material.WoodenHandLantern.Wood']}
                node={nodes.WoodenHandLantern_Handle}
                rain={handLanternRain}
                snow={snowPresets.tool}
            />
            <WeatheredEntityPart
                material={materials['Material.WoodenHandLantern.DarkMetal']}
                node={nodes.WoodenHandLantern_Metal}
                rain={handLanternRain}
                snow={snowPresets.tool}
            />
            <WeatheredEntityPart
                castShadow={false}
                node={nodes.WoodenHandLantern_Glass}
                receiveShadow={false}
            >
                <meshStandardMaterial
                    color="#f2dcad"
                    depthWrite={false}
                    metalness={0}
                    opacity={0.68}
                    roughness={0.48}
                    side={DoubleSide}
                    transparent
                />
            </WeatheredEntityPart>
            <WeatheredEntityPart
                castShadow={false}
                node={nodes.WoodenHandLantern_Glow}
                receiveShadow={false}
            >
                <meshStandardMaterial
                    color={handLanternSourceColor}
                    emissive={handLanternGlowColor}
                    emissiveIntensity={0.3}
                    metalness={0}
                    ref={glowMaterialRef}
                    roughness={0.3}
                />
            </WeatheredEntityPart>
            <GardenNightLight
                color={handLanternGlowColor}
                distance={3.8}
                emissiveBaseIntensity={0.3}
                emissiveMaterialRefs={emissiveMaterialRefs}
                emissivePeakIntensity={3.25}
                lightIntensity={1.75}
                lightKey={`WoodenHandLantern:${block.id}`}
                position={handLanternLightPosition}
            />
        </animated.group>
    );
}
