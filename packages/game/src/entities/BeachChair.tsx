import { animated } from '@react-spring/three';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type BeachChairNodeName = Extract<
    keyof GLTFResult['nodes'],
    `BeachChair_${string}`
>;
type BeachChairNode = GLTFResult['nodes'][BeachChairNodeName];

const beachChairScale = 0.35;

const beachChairNodeNames = [
    'BeachChair_FrameLeft',
    'BeachChair_BackSupportLeft',
    'BeachChair_GroundRailLeft',
    'BeachChair_FrameRight',
    'BeachChair_BackSupportRight',
    'BeachChair_GroundRailRight',
    'BeachChair_RearCrossbar',
    'BeachChair_FrontCrossbar',
    'BeachChair_FabricStripeBlue01',
    'BeachChair_FabricStripeCream02',
    'BeachChair_FabricStripeBlue03',
    'BeachChair_FabricStripeCream04',
    'BeachChair_FabricStripeBlue05',
    'BeachChair_BackFabricEdge',
] satisfies BeachChairNodeName[];

function BeachChairPart({ node }: { node: BeachChairNode }) {
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
                maxThickness={0.018}
                slopeExponent={3.4}
                noiseScale={3.6}
                coverageMultiplier={0.34}
            />
            <RainWetOverlay
                geometry={node.geometry}
                topSurfaceBias={3}
                glossiness={0.52}
            />
        </mesh>
    );
}

export function BeachChair({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('BeachChair');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const position = stack.position.clone().setY(currentStackHeight + 0.015);

    return (
        <animated.group
            position={position}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={beachChairScale}
        >
            {beachChairNodeNames.map((nodeName) => (
                <BeachChairPart key={nodeName} node={nodes[nodeName]} />
            ))}
        </animated.group>
    );
}
