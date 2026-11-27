import type { GameAssetName } from '../data/models';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { IdleBreathingGroup } from '../scene/IdleBreathingMotion';
import type { IdleBreathingRole } from '../scene/idleBreathing';
import { animated } from '../scene/sceneSpring';
import { seasonalRoles } from '../scene/seasonalRoles';
import { SnowOverlay } from '../snow/SnowOverlay';
import { canopyDomeSlopeRange } from '../snow/snowPresets';
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

/**
 * Flower petal albedos from the colour roles in GAME_ART.md. Ripe red and
 * the sunflower petal are base roles; petalYellow is the reachable stand-in
 * the sunflower petals use, since #ffd31c cannot be reached by lit albedo.
 * Carrot orange (#ff8a1c) cannot be reached either, so the orange flower
 * takes the pumpkin role.
 */
const cactusFlowerColors = {
    pink: seasonalRoles.blossomPink.albedo,
    orange: seasonalRoles.pumpkin.albedo,
    violet: seasonalRoles.asterViolet.albedo,
    ripeRed: '#9c241b', // ripe red #f23b2c on screen
    petalYellow: '#957700', // #f0c21d on screen, as Sunflower.tsx petals
};

const cactusVariants = {
    CactusBarrel: {
        assetName: 'CactusBarrel',
        bodyNode: 'Cactus_Barrel_Body',
        flowers: [
            {
                color: cactusFlowerColors.pink,
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
                color: cactusFlowerColors.orange,
                id: 'tall-column',
                position: [0.027, 1.12, 0.029],
                rotation: [0.12, 1.1, 0.18],
                scale: 2.35,
            },
            {
                color: cactusFlowerColors.violet,
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
                color: cactusFlowerColors.ripeRed,
                id: 'top-pad',
                position: [0.029, 1.045, 0.056],
                rotation: [0.16, 0.15, -0.24],
                scale: 2.15,
            },
            {
                color: cactusFlowerColors.petalYellow,
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

function CactusEntity({
    stack,
    block,
    rotation,
    config,
}: EntityInstanceProps & { config: CactusVariantConfig }) {
    const { nodes } = useGameGLTF(config.assetName);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const body = nodes[config.bodyNode];
    const spines = nodes[config.spineNode];
    const bodyGeometry = body.geometry;

    return (
        <animated.group
            position={stack.position
                .clone()
                .setY(currentStackHeight - config.groundSink)}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={config.scale}
        >
            {/* Colours come from the model: Material.Cactus.Body and
                Material.Cactus.Spines in assets/game-assets/Cactus*.blend. */}
            <mesh
                castShadow
                receiveShadow
                geometry={bodyGeometry}
                material={body.material}
            >
                <SnowOverlay
                    geometry={bodyGeometry}
                    maxThickness={0.04}
                    slopeExponent={1.9}
                    noiseScale={4.5}
                    coverageMultiplier={0.55}
                    slopeRange={canopyDomeSlopeRange}
                />
                <RainWetOverlay
                    geometry={bodyGeometry}
                    topSurfaceBias={2.2}
                    darkness={0.5}
                    glossiness={0.45}
                />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={spines.geometry}
                material={spines.material}
            />
            {config.flowers.map((flower) => (
                // Blooms are living parts: each breathes from its own base
                // while the cactus body holds still.
                <IdleBreathingGroup
                    key={`${config.assetName}-flower-${flower.id}`}
                    pivot={flower.position}
                    role={cactusBloomBreathingRole}
                >
                    <GardenFlowerModel
                        bloomOnly
                        petalColor={flower.color}
                        position={flower.position}
                        rotation={flower.rotation}
                        scale={flower.scale}
                    />
                </IdleBreathingGroup>
            ))}
        </animated.group>
    );
}

/** Cactus blooms breathe like flowers (GAME_ART.md, "Motion"). */
export const cactusBloomBreathingRole: IdleBreathingRole = 'flower';

export function Cactus(props: EntityInstanceProps) {
    const config = getCactusVariantConfig(props.block.name);
    if (!config) {
        console.error(`Unknown cactus variant: ${props.block.name}`);
        return null;
    }

    return <CactusEntity {...props} config={config} />;
}
