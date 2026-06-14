import { animated } from '@react-spring/three';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type BeachBallNodeName = Extract<
    keyof GLTFResult['nodes'],
    `BeachBall_${string}`
>;
type BeachBallNode = GLTFResult['nodes'][BeachBallNodeName];

const beachBallScale = 0.1565;

const beachBallNodeNames = [
    'BeachBall_Cap',
    'BeachBall_ContactPatch',
    'BeachBall_PanelCoral01',
    'BeachBall_PanelCoral02',
    'BeachBall_PanelTeal01',
    'BeachBall_PanelTeal02',
    'BeachBall_PanelWhite01',
    'BeachBall_PanelWhite02',
    'BeachBall_PanelWhite03',
    'BeachBall_PanelYellow01',
] satisfies BeachBallNodeName[];

function BeachBallPart({ node }: { node: BeachBallNode }) {
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
                maxThickness={0.012}
                slopeExponent={3.4}
                noiseScale={3.7}
                coverageMultiplier={0.26}
            />
            <RainWetOverlay
                geometry={node.geometry}
                topSurfaceBias={2.8}
                glossiness={0.66}
            />
        </mesh>
    );
}

export function BeachBall({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('BeachBall');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const position = stack.position.clone().setY(currentStackHeight + 0.008);

    return (
        <animated.group
            position={position}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={beachBallScale}
        >
            {beachBallNodeNames.map((nodeName) => (
                <BeachBallPart key={nodeName} node={nodes[nodeName]} />
            ))}
        </animated.group>
    );
}
