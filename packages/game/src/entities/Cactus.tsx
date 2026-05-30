import { animated } from '@react-spring/three';
import type { GameAssetName } from '../data/models';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { GardenFlowerModel } from './helpers/GardenFlowerModel';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export type CactusNodeName = Extract<
    keyof GLTFResult['nodes'],
    `Cactus_${string}`
>;

export type CactusFlowerPlacement = {
    color: string;
    id: string;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
};

export type CactusVariantConfig = {
    assetName: GameAssetName;
    bodyNode: CactusNodeName;
    flowers: CactusFlowerPlacement[];
    spineNode: CactusNodeName;
    scale: number;
    groundSink: number;
};

const cactusVariants = {
    CactusBarrel: {
        assetName: 'CactusBarrel',
        bodyNode: 'Cactus_Barrel_Body',
        flowers: [
            {
                color: '#ff7ab8',
                id: 'crown',
                position: [0.02, 0.63, 0],
                rotation: [0.18, 0.4, -0.1],
                scale: 2.75,
            },
        ],
        spineNode: 'Cactus_Barrel_Spines',
        scale: 0.95,
        groundSink: 0.06,
    },
    CactusColumnCluster: {
        assetName: 'CactusColumnCluster',
        bodyNode: 'Cactus_ColumnCluster_Body',
        flowers: [
            {
                color: '#ff9f43',
                id: 'tall-column',
                position: [0.027, 1.12, 0.029],
                rotation: [0.12, 1.1, 0.18],
                scale: 2.35,
            },
            {
                color: '#e66dff',
                id: 'side-column',
                position: [0.233, 0.93, -0.15],
                rotation: [0.05, -0.7, -0.2],
                scale: 1.95,
            },
        ],
        spineNode: 'Cactus_ColumnCluster_Spines',
        scale: 0.9,
        groundSink: 0.04,
    },
    CactusPricklyPear: {
        assetName: 'CactusPricklyPear',
        bodyNode: 'Cactus_PricklyPear_Body',
        flowers: [
            {
                color: '#ff5f8f',
                id: 'top-pad',
                position: [0.029, 1.045, 0.056],
                rotation: [0.16, 0.15, -0.24],
                scale: 2.15,
            },
            {
                color: '#ffd166',
                id: 'side-pad',
                position: [0.204, 0.855, -0.14],
                rotation: [0.2, -0.55, 0.16],
                scale: 1.85,
            },
        ],
        spineNode: 'Cactus_PricklyPear_Spines',
        scale: 0.9,
        groundSink: 0.045,
    },
} satisfies Record<string, CactusVariantConfig>;

const cactusVariantByName = new Map<string, CactusVariantConfig>(
    Object.entries(cactusVariants),
);

export function getCactusVariantConfig(blockName: string) {
    return cactusVariantByName.get(blockName) ?? null;
}

const cactusBodyMaterial = {
    color: '#4a6411',
    roughness: 0.82,
    metalness: 0,
};

const cactusSpineMaterial = {
    color: '#8a5a2b',
    roughness: 0.78,
    metalness: 0,
};

function CactusEntity({
    stack,
    block,
    rotation,
    config,
}: EntityInstanceProps & { config: CactusVariantConfig }) {
    const { nodes } = useGameGLTF(config.assetName);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const bodyGeometry = nodes[config.bodyNode].geometry;
    const spineGeometry = nodes[config.spineNode].geometry;

    return (
        <animated.group
            position={stack.position
                .clone()
                .setY(currentStackHeight - config.groundSink)}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={config.scale}
        >
            <mesh castShadow receiveShadow geometry={bodyGeometry}>
                <meshStandardMaterial {...cactusBodyMaterial} />
                <SnowOverlay
                    geometry={bodyGeometry}
                    maxThickness={0.04}
                    slopeExponent={1.9}
                    noiseScale={4.5}
                    coverageMultiplier={0.55}
                />
                <RainWetOverlay
                    geometry={bodyGeometry}
                    topSurfaceBias={2.2}
                    darkness={0.5}
                    glossiness={0.45}
                />
            </mesh>
            <mesh castShadow receiveShadow geometry={spineGeometry}>
                <meshStandardMaterial {...cactusSpineMaterial} />
            </mesh>
            {config.flowers.map((flower) => (
                <GardenFlowerModel
                    key={`${config.assetName}-flower-${flower.id}`}
                    bloomOnly
                    petalColor={flower.color}
                    position={flower.position}
                    rotation={flower.rotation}
                    scale={flower.scale}
                />
            ))}
        </animated.group>
    );
}

export function Cactus(props: EntityInstanceProps) {
    const config = getCactusVariantConfig(props.block.name);
    if (!config) {
        console.error(`Unknown cactus variant: ${props.block.name}`);
        return null;
    }

    return <CactusEntity {...props} config={config} />;
}
