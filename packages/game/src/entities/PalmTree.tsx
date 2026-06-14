import { animated } from '@react-spring/three';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type PalmTreeNodeName = Extract<
    keyof GLTFResult['nodes'],
    `PalmTree_${string}`
>;
type PalmTreeNode = GLTFResult['nodes'][PalmTreeNodeName];

const palmTreeScale = 0.355;

const palmTreeNodeNames = [
    'PalmTree_FrondBackTop',
    'PalmTree_TrunkSegment01',
    'PalmTree_TrunkSegment02',
    'PalmTree_TrunkSegment03',
    'PalmTree_TrunkSegment04',
    'PalmTree_TrunkSegment05',
    'PalmTree_TrunkSegment06',
    'PalmTree_TrunkSegment07',
    'PalmTree_TrunkSegment08',
    'PalmTree_FrondFrontCenter',
    'PalmTree_FrondFrontLeft',
    'PalmTree_FrondFrontRight',
    'PalmTree_FrondLeftHigh',
    'PalmTree_FrondLeftLower',
    'PalmTree_FrondRearLeft',
    'PalmTree_FrondRearRight',
    'PalmTree_FrondRightHigh',
    'PalmTree_FrondRightLower',
    'PalmTree_TrunkBand01',
    'PalmTree_TrunkBand02',
    'PalmTree_TrunkBand03',
    'PalmTree_TrunkBand04',
    'PalmTree_TrunkBand05',
    'PalmTree_TrunkBand06',
    'PalmTree_TrunkBand07',
    'PalmTree_TrunkBand08',
    'PalmTree_Coconut01',
    'PalmTree_Coconut02',
    'PalmTree_Coconut03',
] satisfies PalmTreeNodeName[];

function PalmTreePart({ node, snow }: { node: PalmTreeNode; snow: boolean }) {
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
            {snow ? (
                <SnowOverlay
                    geometry={node.geometry}
                    maxThickness={0.028}
                    slopeExponent={3.1}
                    noiseScale={3.4}
                    coverageMultiplier={0.36}
                />
            ) : null}
            <RainWetOverlay
                geometry={node.geometry}
                topSurfaceBias={2.8}
                glossiness={0.58}
            />
        </mesh>
    );
}

export function PalmTree({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('PalmTree');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const position = stack.position.clone().setY(currentStackHeight + 0.015);

    return (
        <animated.group
            position={position}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={palmTreeScale}
        >
            {palmTreeNodeNames.map((nodeName) => (
                <PalmTreePart
                    key={nodeName}
                    node={nodes[nodeName]}
                    snow={!nodeName.includes('_Frond')}
                />
            ))}
        </animated.group>
    );
}
