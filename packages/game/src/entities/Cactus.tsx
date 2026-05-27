import { animated } from '@react-spring/three';
import { CircleGeometry, DoubleSide, Shape, ShapeGeometry } from 'three';
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
    flowers?: readonly CactusFlowerConfig[];
};

type CactusFlowerConfig = {
    key: string;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
    petalColor: string;
    centerColor: string;
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
        flowers: [
            {
                key: 'center-column',
                position: [0.027, 1.12, 0.029],
                rotation: [-Math.PI / 2, 0, 0.28],
                scale: 0.13,
                petalColor: '#e4f7c9',
                centerColor: '#d4b036',
            },
            {
                key: 'right-column',
                position: [0.233, 0.93, -0.15],
                rotation: [-Math.PI / 2, 0, -0.24],
                scale: 0.12,
                petalColor: '#d184f2',
                centerColor: '#d2ab2d',
            },
        ],
    },
    CactusPricklyPear: {
        assetName: 'CactusPricklyPear',
        bodyNode: 'Cactus_PricklyPear_Body',
        spineNode: 'Cactus_PricklyPear_Spines',
        scale: 0.9,
        groundSink: 0.045,
        flowers: [
            {
                key: 'top-pad',
                position: [0.029, 1.045, 0.056],
                rotation: [-Math.PI / 2, 0.1, -0.18],
                scale: 0.11,
                petalColor: '#b345bc',
                centerColor: '#d2ab2d',
            },
            {
                key: 'right-pad',
                position: [0.204, 0.855, -0.14],
                rotation: [-Math.PI / 2, -0.35, 0.25],
                scale: 0.095,
                petalColor: '#e4f7c9',
                centerColor: '#d4b036',
            },
        ],
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

const cactusFlowerGeometry = (() => {
    const shape = new Shape();
    const petalCount = 6;
    for (let i = 0; i < petalCount * 2; i += 1) {
        const angle = (i / (petalCount * 2)) * Math.PI * 2;
        const radius = i % 2 === 0 ? 0.42 : 1;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) {
            shape.moveTo(x, y);
        } else {
            shape.lineTo(x, y);
        }
    }
    shape.closePath();
    return new ShapeGeometry(shape);
})();
const cactusFlowerCenterGeometry = new CircleGeometry(0.28, 18);

function CactusFlower({ flower }: { flower: CactusFlowerConfig }) {
    return (
        <group
            position={flower.position}
            rotation={flower.rotation}
            scale={flower.scale}
        >
            <mesh castShadow geometry={cactusFlowerGeometry}>
                <meshBasicMaterial
                    color={flower.petalColor}
                    side={DoubleSide}
                />
            </mesh>
            <mesh
                castShadow
                geometry={cactusFlowerCenterGeometry}
                position={[0, 0, 0.006]}
            >
                <meshBasicMaterial
                    color={flower.centerColor}
                    side={DoubleSide}
                />
            </mesh>
        </group>
    );
}

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
            {config.flowers?.map((flower) => (
                <CactusFlower key={flower.key} flower={flower} />
            ))}
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
