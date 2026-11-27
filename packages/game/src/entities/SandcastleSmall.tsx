import { useMemo } from 'react';
import type { GameAssetName } from '../data/models';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { animated } from '../scene/sceneSpring';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type SandcastleSmallModelName = Extract<GameAssetName, 'SandcastleSmallA'>;
type SandcastleSmallNode = GLTFResult['nodes'][keyof GLTFResult['nodes']];

// 1.2x the original 0.1286 so crenels and the flag pole stay at least 0.03
// units thick; the castle still fits well inside its tile.
const sandcastleSmallScale = 0.1543;

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
