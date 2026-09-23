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

type WoodenBenchNodeName = Extract<
    keyof GLTFResult['nodes'],
    `WoodenBench_${string}`
>;
type WoodenBenchNode = GLTFResult['nodes'][WoodenBenchNodeName];

const woodenBenchScale = 0.52;

const woodenBenchNodeNames = [
    'WoodenBench_SeatSlatFront',
    'WoodenBench_SeatSlatCenter',
    'WoodenBench_SeatSlatBack',
    'WoodenBench_SupportRailFront',
    'WoodenBench_SupportRailBack',
    'WoodenBench_EndBraceLeft',
    'WoodenBench_EndBraceRight',
    'WoodenBench_LegFrontLeft',
    'WoodenBench_LegFrontRight',
    'WoodenBench_LegBackLeft',
    'WoodenBench_LegBackRight',
    'WoodenBench_PinFrontLeft',
    'WoodenBench_PinFrontRight',
    'WoodenBench_PinBackLeft',
    'WoodenBench_PinBackRight',
] satisfies WoodenBenchNodeName[];

function WoodenBenchPart({
    node,
    blockId,
    covered,
}: {
    node: WoodenBenchNode;
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
            receiveShadow
            geometry={node.geometry}
            material={node.material}
            position={node.position}
            rotation={node.rotation}
            scale={node.scale}
        >
            <SnowOverlay
                geometry={node.geometry}
                maxThickness={0.04}
                slopeExponent={3.1}
                noiseScale={3.4}
                coverageMultiplier={0.58}
            />
            <RainWetOverlay
                geometry={node.geometry}
                topSurfaceBias={2.8}
                darkness={0.76}
                glossiness={0.56}
            />
        </mesh>
    );
}

export function WoodenBench({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('WoodenBench');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const covered = stack.blocks
        .slice(stack.blocks.indexOf(block) + 1)
        .some((above) => above.name.startsWith('Block_'));

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.01)}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={woodenBenchScale}
        >
            {woodenBenchNodeNames.map((nodeName) => (
                <WoodenBenchPart
                    key={nodeName}
                    node={nodes[nodeName]}
                    blockId={block.id}
                    covered={covered}
                />
            ))}
        </animated.group>
    );
}
