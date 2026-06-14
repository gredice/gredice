import { animated } from '@react-spring/three';
import { useMemo } from 'react';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type SummerHatNode = GLTFResult['nodes'][keyof GLTFResult['nodes']];

const summerHatScale = 0.32;

function SummerHatPart({ node }: { node: SummerHatNode }) {
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
                maxThickness={0.025}
                slopeExponent={3.2}
                noiseScale={3.4}
                coverageMultiplier={0.38}
            />
            <RainWetOverlay
                geometry={node.geometry}
                topSurfaceBias={2.5}
                glossiness={0.52}
            />
        </mesh>
    );
}

export function SummerHat({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('SummerHat');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const nodeEntries = useMemo(
        () =>
            Object.entries(nodes).filter(([name]) =>
                name.startsWith('SummerHat_'),
            ),
        [nodes],
    );
    const position = stack.position.clone().setY(currentStackHeight + 0.025);

    return (
        <animated.group
            position={position}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={summerHatScale}
        >
            {nodeEntries.map(([name, node]) => (
                <SummerHatPart key={name} node={node} />
            ))}
        </animated.group>
    );
}
