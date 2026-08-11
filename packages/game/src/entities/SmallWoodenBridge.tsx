import { animated } from '@react-spring/three';
import type { ReactNode } from 'react';
import type { Material } from 'three';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { getWaterSurfacePlacementYOffset } from './waterSurfacePlacement';

type SmallWoodenBridgeNodeName = Extract<
    keyof GLTFResult['nodes'],
    `SmallWoodenBridge_${string}`
>;
type SmallWoodenBridgeNode = GLTFResult['nodes'][SmallWoodenBridgeNodeName];

function BridgePart({
    children,
    material,
    node,
    snowMaxThickness = 0.045,
}: {
    children?: ReactNode;
    material: Material;
    node: SmallWoodenBridgeNode;
    snowMaxThickness?: number;
}) {
    return (
        <mesh
            castShadow
            geometry={node.geometry}
            material={material}
            position={node.position}
            receiveShadow
            rotation={node.rotation}
            scale={node.scale}
        >
            {children}
            <SnowOverlay
                geometry={node.geometry}
                maxThickness={snowMaxThickness}
                slopeExponent={2.7}
                noiseScale={3.2}
            />
            <RainWetOverlay
                geometry={node.geometry}
                topSurfaceBias={2.2}
                darkness={0.58}
                glossiness={0.34}
            />
        </mesh>
    );
}

export function SmallWoodenBridge({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { materials, nodes } = useGameGLTF('SmallWoodenBridge');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const placementYOffset = getWaterSurfacePlacementYOffset(stack, block);

    return (
        <animated.group
            position={stack.position
                .clone()
                .setY(currentStackHeight + placementYOffset)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <BridgePart
                material={materials['Material.SmallWoodenBridge.LightWood']}
                node={nodes.SmallWoodenBridge_PlanksLight}
            />
            <BridgePart
                material={materials['Material.SmallWoodenBridge.WarmWood']}
                node={nodes.SmallWoodenBridge_PlanksWarm}
            />
            <BridgePart
                material={materials['Material.SmallWoodenBridge.DeepWood']}
                node={nodes.SmallWoodenBridge_Stringers}
                snowMaxThickness={0.035}
            />
            <BridgePart
                material={materials['Material.SmallWoodenBridge.DeepWood']}
                node={nodes.SmallWoodenBridge_Pegs}
                snowMaxThickness={0.025}
            />
        </animated.group>
    );
}
