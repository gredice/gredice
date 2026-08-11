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
import { getWoodenWalkwayPlacementYOffset } from './woodenWalkwayPlacement';

type WoodenWalkwayNodeName = Extract<
    keyof GLTFResult['nodes'],
    `WoodenWalkway_${string}`
>;
type WoodenWalkwayNode = GLTFResult['nodes'][WoodenWalkwayNodeName];

function WalkwayPart({
    children,
    material,
    node,
    snowMaxThickness = 0.018,
}: {
    children?: ReactNode;
    material: Material;
    node: WoodenWalkwayNode;
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

export function WoodenWalkway({ stack, block, rotation }: EntityInstanceProps) {
    const { materials, nodes } = useGameGLTF('WoodenWalkway');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const placementYOffset = getWoodenWalkwayPlacementYOffset(stack, block);

    return (
        <animated.group
            position={stack.position
                .clone()
                .setY(currentStackHeight + placementYOffset)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <WalkwayPart
                material={materials['Material.WoodenWalkway.LightWood']}
                node={nodes.WoodenWalkway_PlanksLight}
            />
            <WalkwayPart
                material={materials['Material.WoodenWalkway.WarmWood']}
                node={nodes.WoodenWalkway_PlanksWarm}
            />
            <WalkwayPart
                material={materials['Material.WoodenWalkway.Pegs']}
                node={nodes.WoodenWalkway_Pegs}
                snowMaxThickness={0.008}
            />
        </animated.group>
    );
}
