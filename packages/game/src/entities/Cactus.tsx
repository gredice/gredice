import { animated } from '@react-spring/three';
import type { GameAssetName } from '../data/models';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type CactusNodeName = Extract<keyof GLTFResult['nodes'], `Cactus_${string}`>;

type CactusVariantConfig = {
    assetName: GameAssetName;
    bodyNode: CactusNodeName;
    spineNode: CactusNodeName;
    scale: number;
    groundSink: number;
};

const cactusVariants = {
    CactusBarrel: {
        assetName: 'CactusBarrel',
        bodyNode: 'Cactus_Barrel_Body',
        spineNode: 'Cactus_Barrel_Spines',
        scale: 0.95,
        groundSink: 0.06,
    },
    CactusColumnCluster: {
        assetName: 'CactusColumnCluster',
        bodyNode: 'Cactus_ColumnCluster_Body',
        spineNode: 'Cactus_ColumnCluster_Spines',
        scale: 0.9,
        groundSink: 0.04,
    },
    CactusPricklyPear: {
        assetName: 'CactusPricklyPear',
        bodyNode: 'Cactus_PricklyPear_Body',
        spineNode: 'Cactus_PricklyPear_Spines',
        scale: 0.9,
        groundSink: 0.045,
    },
} satisfies Record<string, CactusVariantConfig>;

const cactusVariantByName = new Map<string, CactusVariantConfig>(
    Object.entries(cactusVariants),
);

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
        </animated.group>
    );
}

export function Cactus(props: EntityInstanceProps) {
    const config = cactusVariantByName.get(props.block.name);
    if (!config) {
        console.error(`Unknown cactus variant: ${props.block.name}`);
        return null;
    }

    return <CactusEntity {...props} config={config} />;
}
