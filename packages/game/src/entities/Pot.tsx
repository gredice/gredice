import { animated } from '@react-spring/three';
import type { GameAssetName } from '../data/models';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type PotVariantConfig = {
    assetName: GameAssetName;
    potNode: keyof GLTFResult['nodes'];
    soilNode: keyof GLTFResult['nodes'];
    color: string;
};

const potVariants = {
    PotLowBowl: {
        assetName: 'PotLowBowl',
        potNode: 'PotVariant_01_Low_Bowl',
        soilNode: 'PotVariant_Soil_01',
        color: '#C56C45',
    },
    PotRoundedBowl: {
        assetName: 'PotRoundedBowl',
        potNode: 'PotVariant_02_Rounded_Bowl',
        soilNode: 'PotVariant_Soil_02',
        color: '#7D8F68',
    },
    PotBulbousNeck: {
        assetName: 'PotBulbousNeck',
        potNode: 'PotVariant_03_Bulbous_Neck',
        soilNode: 'PotVariant_Soil_03',
        color: '#B85A3E',
    },
    PotTallTapered: {
        assetName: 'PotTallTapered',
        potNode: 'PotVariant_04_Tall_Tapered',
        soilNode: 'PotVariant_Soil_04',
        color: '#D7A354',
    },
    PotHourglass: {
        assetName: 'PotHourglass',
        potNode: 'PotVariant_05_Hourglass',
        soilNode: 'PotVariant_Soil_05',
        color: '#637994',
    },
    PotStraightShortTub: {
        assetName: 'PotStraightShortTub',
        potNode: 'PotVariant_06_Straight_Short_Tub',
        soilNode: 'PotVariant_Soil_06',
        color: '#9B7656',
    },
    PotNarrowFootBowl: {
        assetName: 'PotNarrowFootBowl',
        potNode: 'PotVariant_07_Narrow_Foot_Bowl',
        soilNode: 'PotVariant_Soil_07',
        color: '#D18A5A',
    },
    PotSquatRidged: {
        assetName: 'PotSquatRidged',
        potNode: 'PotVariant_08_Squat_Ridged_Pot',
        soilNode: 'PotVariant_Soil_08',
        color: '#676F58',
    },
    PotTallSlenderCone: {
        assetName: 'PotTallSlenderCone',
        potNode: 'PotVariant_09_Tall_Slender_Cone',
        soilNode: 'PotVariant_Soil_09',
        color: '#C74E3A',
    },
    PotWideLippedCup: {
        assetName: 'PotWideLippedCup',
        potNode: 'PotVariant_10_Wide_Lipped_Cup',
        soilNode: 'PotVariant_Soil_10',
        color: '#C18B45',
    },
} satisfies Record<string, PotVariantConfig>;

const potVariantByName = new Map<string, PotVariantConfig>(
    Object.entries(potVariants),
);

function PotEntity({
    stack,
    block,
    rotation,
    config,
}: EntityInstanceProps & { config: PotVariantConfig }) {
    const { nodes } = useGameGLTF(config.assetName);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const potGeometry = nodes[config.potNode].geometry;
    const soilGeometry = nodes[config.soilNode].geometry;

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh castShadow receiveShadow geometry={potGeometry}>
                <meshStandardMaterial
                    color={config.color}
                    roughness={0.78}
                    metalness={0.02}
                />
                <SnowOverlay
                    geometry={potGeometry}
                    maxThickness={0.035}
                    slopeExponent={3.1}
                    noiseScale={4}
                    coverageMultiplier={0.45}
                />
                <RainWetOverlay
                    geometry={potGeometry}
                    topSurfaceBias={2.4}
                    darkness={0.55}
                    glossiness={0.65}
                />
            </mesh>
            <mesh castShadow receiveShadow geometry={soilGeometry}>
                <meshStandardMaterial
                    color="#3F2A1C"
                    roughness={0.95}
                    metalness={0}
                />
                <SnowOverlay
                    geometry={soilGeometry}
                    maxThickness={0.025}
                    slopeExponent={2.2}
                    noiseScale={3}
                    coverageMultiplier={0.3}
                />
                <RainWetOverlay
                    geometry={soilGeometry}
                    topSurfaceBias={2.1}
                    darkness={0.35}
                    glossiness={0.35}
                />
            </mesh>
        </animated.group>
    );
}

export function Pot(props: EntityInstanceProps) {
    const config = potVariantByName.get(props.block.name);
    if (!config) {
        console.error(`Unknown pot variant: ${props.block.name}`);
        return null;
    }

    return <PotEntity {...props} config={config} />;
}
