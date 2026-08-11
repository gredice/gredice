import { animated } from '@react-spring/three';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type OutletDisplayTableNodeName = Extract<
    keyof GLTFResult['nodes'],
    `OutletDisplayTable_${string}`
>;
type OutletDisplayTableNode = GLTFResult['nodes'][OutletDisplayTableNodeName];

function OutletDisplayTablePart({
    node,
    snowMaxThickness,
}: {
    node: OutletDisplayTableNode;
    snowMaxThickness: number;
}) {
    return (
        <mesh
            castShadow
            geometry={node.geometry}
            material={node.material}
            position={node.position}
            receiveShadow
            rotation={node.rotation}
            scale={node.scale}
        >
            <SnowOverlay
                coverageMultiplier={0.62}
                geometry={node.geometry}
                maxThickness={snowMaxThickness}
                noiseScale={3.2}
                slopeExponent={3}
            />
            <RainWetOverlay
                darkness={0.65}
                geometry={node.geometry}
                glossiness={0.48}
                topSurfaceBias={2.8}
            />
        </mesh>
    );
}

export function OutletDisplayTable({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('OutletDisplayTable');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <OutletDisplayTablePart
                node={nodes.OutletDisplayTable_TopPlanks}
                snowMaxThickness={0.055}
            />
            <OutletDisplayTablePart
                node={nodes.OutletDisplayTable_Frame}
                snowMaxThickness={0.035}
            />
            <OutletDisplayTablePart
                node={nodes.OutletDisplayTable_LowerShelf}
                snowMaxThickness={0.04}
            />
        </animated.group>
    );
}
