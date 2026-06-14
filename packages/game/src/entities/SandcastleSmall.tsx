import { animated } from '@react-spring/three';
import { useMemo } from 'react';
import type { GameAssetName } from '../data/models';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type SandcastleSmallModelName = Extract<GameAssetName, 'SandcastleSmallA'>;
type SandcastleSmallNode = GLTFResult['nodes'][keyof GLTFResult['nodes']];

const sandcastleSmallScale = 0.1286;

function SandcastleSmallPart({ node }: { node: SandcastleSmallNode }) {
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
                slopeExponent={3.3}
                noiseScale={3.6}
                coverageMultiplier={0.3}
            />
            <RainWetOverlay
                geometry={node.geometry}
                topSurfaceBias={2.7}
                glossiness={0.44}
            />
        </mesh>
    );
}

function SandcastleSmall({
    modelName,
    stack,
    block,
    rotation,
}: EntityInstanceProps & { modelName: SandcastleSmallModelName }) {
    const { nodes } = useGameGLTF(modelName);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const nodeEntries = useMemo(
        () =>
            Object.entries(nodes).filter(([name]) =>
                name.startsWith(`${modelName}_`),
            ),
        [modelName, nodes],
    );
    const position = stack.position.clone().setY(currentStackHeight + 0.006);

    return (
        <animated.group
            position={position}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={sandcastleSmallScale}
        >
            {nodeEntries.map(([name, node]) => (
                <SandcastleSmallPart key={name} node={node} />
            ))}
        </animated.group>
    );
}

export function SandcastleSmallA(props: EntityInstanceProps) {
    return <SandcastleSmall {...props} modelName="SandcastleSmallA" />;
}
