import { animated } from '@react-spring/three';
import { useLayoutEffect, useRef } from 'react';
import { type Group, Vector3 } from 'three';
import type { GLTFResult } from '../models/GameAssets';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useFishingBoatRegistry } from './fishingBoat/FishingBoatRegistry';
import { getFishingBoatPlacementCenter } from './fishingBoat/fishingBoatNavigation';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';
import { getWaterSurfacePlacementYOffset } from './waterSurfacePlacement';

type FishingBoatNodeName = Extract<
    keyof GLTFResult['nodes'],
    `FishingBoat_${string}`
>;

const woodParts = [
    {
        materialName: 'Material.FishingBoat.DarkWarmWood',
        nodeName: 'FishingBoat_HullWoodDark',
    },
    {
        materialName: 'Material.FishingBoat.HullWood',
        nodeName: 'FishingBoat_HullWood',
    },
    {
        materialName: 'Material.FishingBoat.InteriorWood',
        nodeName: 'FishingBoat_InteriorWood',
    },
    {
        materialName: 'Material.FishingBoat.WarmWood',
        nodeName: 'FishingBoat_Benches',
    },
    {
        materialName: 'Material.FishingBoat.WarmWood',
        nodeName: 'FishingBoat_Oars',
    },
] satisfies Array<{
    materialName: keyof GLTFResult['materials'];
    nodeName: FishingBoatNodeName;
}>;

const gearParts = [
    {
        materialName: 'Material.FishingBoat.Rope',
        nodeName: 'FishingBoat_Rope',
    },
    {
        materialName: 'Material.FishingBoat.Net',
        nodeName: 'FishingBoat_Net',
    },
    {
        materialName: 'Material.FishingBoat.FloatGold',
        nodeName: 'FishingBoat_Floats',
    },
    {
        materialName: 'Material.FishingBoat.DarkMetal',
        nodeName: 'FishingBoat_Metal',
    },
] satisfies Array<{
    materialName: keyof GLTFResult['materials'];
    nodeName: FishingBoatNodeName;
}>;

const woodRain = {
    darkness: 0.6,
    glossiness: 0.38,
    topSurfaceBias: 2.2,
};

export function FishingBoat({ stack, block, rotation }: EntityInstanceProps) {
    const { materials, nodes } = useGameGLTF('FishingBoat');
    const registry = useFishingBoatRegistry();
    const groupRef = useRef<Group>(null);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const placementYOffset = getWaterSurfacePlacementYOffset(stack, block);
    const placementCenter = getFishingBoatPlacementCenter({
        rotation,
        x: stack.position.x,
        z: stack.position.z,
    });
    const position = new Vector3(
        placementCenter.x,
        currentStackHeight + placementYOffset,
        placementCenter.z,
    );

    useLayoutEffect(() => {
        const object = groupRef.current;
        if (!registry || !object) {
            return;
        }
        return registry.register({ blockId: block.id, object });
    }, [block.id, registry]);

    return (
        <animated.group
            ref={groupRef}
            name={`Interaction:FishingBoat:${block.id}`}
            position={position}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            {woodParts.map(({ materialName, nodeName }) => (
                <WeatheredEntityPart
                    key={nodeName}
                    material={materials[materialName]}
                    node={nodes[nodeName]}
                    rain={woodRain}
                    snow={{ ...snowPresets.tool, maxThickness: 0.035 }}
                />
            ))}
            {gearParts.map(({ materialName, nodeName }) => (
                <WeatheredEntityPart
                    key={nodeName}
                    material={materials[materialName]}
                    node={nodes[nodeName]}
                    rain={woodRain}
                    snow={{ ...snowPresets.tool, maxThickness: 0.012 }}
                />
            ))}
            <WeatheredEntityPart
                castShadow={false}
                node={nodes.FishingBoat_Ripples}
                receiveShadow={false}
            >
                <meshStandardMaterial
                    color="#92cfd8"
                    depthWrite={false}
                    metalness={0}
                    opacity={0.38}
                    roughness={0.2}
                    transparent
                />
            </WeatheredEntityPart>
        </animated.group>
    );
}
