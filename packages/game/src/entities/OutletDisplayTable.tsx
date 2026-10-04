import { useRef } from 'react';
import type { Mesh } from 'three';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { useRegisterAutumnPart } from '../scene/AutumnParts';
import { animated } from '../scene/sceneSpring';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { autumnPartLeafSurfaces } from './helpers/autumnLeafSurfaces';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type OutletDisplayTableNodeName = Extract<
    keyof GLTFResult['nodes'],
    `OutletDisplayTable_${string}`
>;
type OutletDisplayTableNode = GLTFResult['nodes'][OutletDisplayTableNodeName];

function OutletDisplayTablePart({
    node,
    snowMaxThickness,
    blockId,
    covered,
}: {
    node: OutletDisplayTableNode;
    snowMaxThickness: number;
    blockId: string;
    covered: boolean;
}) {
    const ref = useRef<Mesh>(null);
    useRegisterAutumnPart({
        blockId,
        partId: node.name,
        ref,
        surfaces: autumnPartLeafSurfaces[node.name] ?? [],
        covered,
    });
    return (
        <mesh
            ref={ref}
            name={node.name}
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
    const covered = stack.blocks
        .slice(stack.blocks.indexOf(block) + 1)
        .some((above) => above.name.startsWith('Block_'));

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <OutletDisplayTablePart
                node={nodes.OutletDisplayTable_TopPlanks}
                snowMaxThickness={0.055}
                blockId={block.id}
                covered={covered}
            />
            <OutletDisplayTablePart
                node={nodes.OutletDisplayTable_Frame}
                snowMaxThickness={0.035}
                blockId={block.id}
                covered={covered}
            />
            <OutletDisplayTablePart
                node={nodes.OutletDisplayTable_LowerShelf}
                snowMaxThickness={0.04}
                blockId={block.id}
                covered={covered}
            />
        </animated.group>
    );
}
