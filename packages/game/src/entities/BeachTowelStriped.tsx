import { animated } from '@react-spring/three';
import { useMemo } from 'react';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type BeachTowelStripedNode = GLTFResult['nodes'][keyof GLTFResult['nodes']];

const beachTowelStripedScale = 0.24;

function BeachTowelStripedPart({ node }: { node: BeachTowelStripedNode }) {
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
                slopeExponent={3.6}
                noiseScale={3.8}
                coverageMultiplier={0.28}
            />
            <RainWetOverlay
                geometry={node.geometry}
                topSurfaceBias={3}
                glossiness={0.42}
            />
        </mesh>
    );
}

export function BeachTowelStriped({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('BeachTowelStriped');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const nodeEntries = useMemo(
        () =>
            Object.entries(nodes).filter(([name]) =>
                name.startsWith('BeachTowelStriped_'),
            ),
        [nodes],
    );
    const position = stack.position.clone().setY(currentStackHeight + 0.035);

    return (
        <animated.group
            position={position}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={beachTowelStripedScale}
        >
            {nodeEntries.map(([name, node]) => (
                <BeachTowelStripedPart key={name} node={node} />
            ))}
        </animated.group>
    );
}
