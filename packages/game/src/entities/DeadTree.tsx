import { animated } from '@react-spring/three';
import type { GameAssetName } from '../data/models';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type DeadTreeNodeName = Extract<keyof GLTFResult['nodes'], `DeadTree${string}`>;

type DeadTreeVariantConfig = {
    assetName: GameAssetName;
    nodes: readonly DeadTreeNodeName[];
    scale: number;
    groundSink: number;
};

const deadTreeVariants = {
    DeadTreeTall: {
        assetName: 'DeadTreeTall',
        nodes: [
            'DeadTreeTall_Trunk',
            'DeadTreeTall_LeftBranch',
            'DeadTreeTall_LeftSubBranch',
            'DeadTreeTall_LeftTip',
            'DeadTreeTall_RightBranch',
            'DeadTreeTall_RightSubBranch',
            'DeadTreeTall_RightTip',
        ],
        scale: 0.92,
        groundSink: 0,
    },
    DeadTreeStump: {
        assetName: 'DeadTreeStump',
        nodes: [
            'DeadTreeStump_Trunk',
            'DeadTreeStump_BrokenTop',
            'DeadTreeStump_BrokenTop001',
            'DeadTreeStump_SideStub',
        ],
        scale: 0.95,
        groundSink: 0,
    },
} satisfies Record<string, DeadTreeVariantConfig>;

const deadTreeVariantByName = new Map<string, DeadTreeVariantConfig>(
    Object.entries(deadTreeVariants),
);

const deadTreeMaterial = {
    color: '#70401f',
    roughness: 0.86,
    metalness: 0,
};

function DeadTreeMeshes({
    nodes,
    nodeNames,
}: {
    nodes: GLTFResult['nodes'];
    nodeNames: readonly DeadTreeNodeName[];
}) {
    return nodeNames.map((nodeName) => {
        const node = nodes[nodeName];
        const geometry = node.geometry;
        return (
            <mesh
                key={nodeName}
                castShadow
                receiveShadow
                geometry={geometry}
                position={[node.position.x, node.position.y, node.position.z]}
                rotation={[node.rotation.x, node.rotation.y, node.rotation.z]}
                scale={[node.scale.x, node.scale.y, node.scale.z]}
            >
                <meshStandardMaterial {...deadTreeMaterial} />
                <SnowOverlay
                    geometry={geometry}
                    maxThickness={0.035}
                    slopeExponent={1.8}
                    noiseScale={4.2}
                    coverageMultiplier={0.45}
                />
                <RainWetOverlay
                    geometry={geometry}
                    topSurfaceBias={2.1}
                    darkness={0.45}
                    glossiness={0.35}
                />
            </mesh>
        );
    });
}

function DeadTreeEntity({
    stack,
    block,
    rotation,
    config,
}: EntityInstanceProps & { config: DeadTreeVariantConfig }) {
    const { nodes } = useGameGLTF(config.assetName);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position
                .clone()
                .setY(currentStackHeight - config.groundSink)}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={config.scale}
        >
            <DeadTreeMeshes nodes={nodes} nodeNames={config.nodes} />
        </animated.group>
    );
}

export function DeadTree(props: EntityInstanceProps) {
    const config = deadTreeVariantByName.get(props.block.name);
    if (!config) {
        console.error(`Unknown dead tree variant: ${props.block.name}`);
        return null;
    }

    return <DeadTreeEntity {...props} config={config} />;
}
