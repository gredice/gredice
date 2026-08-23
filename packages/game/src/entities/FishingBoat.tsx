import { animated } from '@react-spring/three';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { type Group, type Material, Vector3 } from 'three';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useFishingBoatRegistry } from './fishingBoat/FishingBoatRegistry';
import { getFishingBoatPlacementCenter } from './fishingBoat/fishingBoatNavigation';
import {
    type FishingBoatOarPart,
    splitFishingBoatOarGeometries,
} from './fishingBoat/fishingBoatOars';
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

const oarSnow = { ...snowPresets.tool, maxThickness: 0.035 };

function FishingBoatOar({
    material,
    oar,
    oarRef,
}: {
    material?: Material | Material[];
    oar: FishingBoatOarPart;
    oarRef: (group: Group | null) => void;
}) {
    return (
        <group
            name={`Animation:FishingBoatOar:${oar.side}`}
            position={oar.pivot}
            ref={oarRef}
        >
            <mesh
                castShadow
                geometry={oar.geometry}
                material={material}
                receiveShadow
            >
                <SnowOverlay geometry={oar.geometry} {...oarSnow} />
                <RainWetOverlay geometry={oar.geometry} {...woodRain} />
            </mesh>
        </group>
    );
}

export function FishingBoat({ stack, block, rotation }: EntityInstanceProps) {
    const { materials, nodes } = useGameGLTF('FishingBoat');
    const registry = useFishingBoatRegistry();
    const groupRef = useRef<Group>(null);
    const oarGroupsRef = useRef(new Map<FishingBoatOarPart['side'], Group>());
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const oars = useMemo(
        () => splitFishingBoatOarGeometries(nodes.FishingBoat_Oars.geometry),
        [nodes.FishingBoat_Oars],
    );
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
        const oarControllers = oars.flatMap((oar) => {
            const group = oarGroupsRef.current.get(oar.side);
            return group ? [{ group, pivot: oar.pivot, side: oar.side }] : [];
        });
        if (!registry || !object || oarControllers.length !== oars.length) {
            return;
        }
        return registry.register({
            blockId: block.id,
            oars: oarControllers,
            object,
        });
    }, [block.id, oars, registry]);

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
            {oars.map((oar) => (
                <FishingBoatOar
                    key={oar.side}
                    material={materials['Material.FishingBoat.WarmWood']}
                    oar={oar}
                    oarRef={(group) => {
                        if (group) {
                            oarGroupsRef.current.set(oar.side, group);
                        } else {
                            oarGroupsRef.current.delete(oar.side);
                        }
                    }}
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
