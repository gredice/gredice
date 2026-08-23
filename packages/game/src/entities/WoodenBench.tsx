import { animated } from '@react-spring/three';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
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

function WoodenBenchPart({ node }: { node: WoodenBenchNode }) {
    return (
        <mesh
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

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.01)}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={woodenBenchScale}
        >
            {woodenBenchNodeNames.map((nodeName) => (
                <WoodenBenchPart key={nodeName} node={nodes[nodeName]} />
            ))}
        </animated.group>
    );
}
