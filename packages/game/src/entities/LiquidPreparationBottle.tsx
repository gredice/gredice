import { animated } from '@react-spring/three';
import type { ReactNode } from 'react';
import { MeshStandardMaterial, SRGBColorSpace } from 'three';
import type { GameAssetName } from '../data/models';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type LiquidPreparationBottleAssetName = Extract<
    GameAssetName,
    `LiquidPreparationBottle${string}`
>;

type LiquidPreparationBottleNodeName = Extract<
    keyof GLTFResult['nodes'],
    `LiquidPreparationBottle${string}`
>;

type LiquidPreparationBottleNode =
    GLTFResult['nodes'][LiquidPreparationBottleNodeName];

type LiquidPreparationBottleConfig = {
    assetName: LiquidPreparationBottleAssetName;
    nodes: {
        baseRim: LiquidPreparationBottleNodeName;
        body: LiquidPreparationBottleNodeName;
        shoulder: LiquidPreparationBottleNodeName;
        neck: LiquidPreparationBottleNodeName;
        cap: LiquidPreparationBottleNodeName;
        label: LiquidPreparationBottleNodeName;
    };
};

const liquidPreparationBottleConfigs = {
    LiquidPreparationBottlePestControl: {
        assetName: 'LiquidPreparationBottlePestControl',
        nodes: {
            baseRim: 'LiquidPreparationBottlePestControl_Base_Rim',
            body: 'LiquidPreparationBottlePestControl_Body',
            shoulder: 'LiquidPreparationBottlePestControl_Shoulder',
            neck: 'LiquidPreparationBottlePestControl_Neck',
            cap: 'LiquidPreparationBottlePestControl_Cap',
            label: 'LiquidPreparationBottlePestControl_Label',
        },
    },
    LiquidPreparationBottleAphidControl: {
        assetName: 'LiquidPreparationBottleAphidControl',
        nodes: {
            baseRim: 'LiquidPreparationBottleAphidControl_Base_Rim',
            body: 'LiquidPreparationBottleAphidControl_Body',
            shoulder: 'LiquidPreparationBottleAphidControl_Shoulder',
            neck: 'LiquidPreparationBottleAphidControl_Neck',
            cap: 'LiquidPreparationBottleAphidControl_Cap',
            label: 'LiquidPreparationBottleAphidControl_Label',
        },
    },
    LiquidPreparationBottleSlugControl: {
        assetName: 'LiquidPreparationBottleSlugControl',
        nodes: {
            baseRim: 'LiquidPreparationBottleSlugControl_Base_Rim',
            body: 'LiquidPreparationBottleSlugControl_Body',
            shoulder: 'LiquidPreparationBottleSlugControl_Shoulder',
            neck: 'LiquidPreparationBottleSlugControl_Neck',
            cap: 'LiquidPreparationBottleSlugControl_Cap',
            label: 'LiquidPreparationBottleSlugControl_Label',
        },
    },
    LiquidPreparationBottleTomatoEggplantResistance: {
        assetName: 'LiquidPreparationBottleTomatoEggplantResistance',
        nodes: {
            baseRim: 'LiquidPreparationBottleTomatoEggplantResistance_Base_Rim',
            body: 'LiquidPreparationBottleTomatoEggplantResistance_Body',
            shoulder:
                'LiquidPreparationBottleTomatoEggplantResistance_Shoulder',
            neck: 'LiquidPreparationBottleTomatoEggplantResistance_Neck',
            cap: 'LiquidPreparationBottleTomatoEggplantResistance_Cap',
            label: 'LiquidPreparationBottleTomatoEggplantResistance_Label',
        },
    },
    LiquidPreparationBottleFertilizer: {
        assetName: 'LiquidPreparationBottleFertilizer',
        nodes: {
            baseRim: 'LiquidPreparationBottleFertilizer_Base_Rim',
            body: 'LiquidPreparationBottleFertilizer_Body',
            shoulder: 'LiquidPreparationBottleFertilizer_Shoulder',
            neck: 'LiquidPreparationBottleFertilizer_Neck',
            cap: 'LiquidPreparationBottleFertilizer_Cap',
            label: 'LiquidPreparationBottleFertilizer_Label',
        },
    },
    LiquidPreparationBottleDiseaseControl: {
        assetName: 'LiquidPreparationBottleDiseaseControl',
        nodes: {
            baseRim: 'LiquidPreparationBottleDiseaseControl_Base_Rim',
            body: 'LiquidPreparationBottleDiseaseControl_Body',
            shoulder: 'LiquidPreparationBottleDiseaseControl_Shoulder',
            neck: 'LiquidPreparationBottleDiseaseControl_Neck',
            cap: 'LiquidPreparationBottleDiseaseControl_Cap',
            label: 'LiquidPreparationBottleDiseaseControl_Label',
        },
    },
    LiquidPreparationBottleWeevilControl: {
        assetName: 'LiquidPreparationBottleWeevilControl',
        nodes: {
            baseRim: 'LiquidPreparationBottleWeevilControl_Base_Rim',
            body: 'LiquidPreparationBottleWeevilControl_Body',
            shoulder: 'LiquidPreparationBottleWeevilControl_Shoulder',
            neck: 'LiquidPreparationBottleWeevilControl_Neck',
            cap: 'LiquidPreparationBottleWeevilControl_Cap',
            label: 'LiquidPreparationBottleWeevilControl_Label',
        },
    },
    LiquidPreparationBottleVoleControl: {
        assetName: 'LiquidPreparationBottleVoleControl',
        nodes: {
            baseRim: 'LiquidPreparationBottleVoleControl_Base_Rim',
            body: 'LiquidPreparationBottleVoleControl_Body',
            shoulder: 'LiquidPreparationBottleVoleControl_Shoulder',
            neck: 'LiquidPreparationBottleVoleControl_Neck',
            cap: 'LiquidPreparationBottleVoleControl_Cap',
            label: 'LiquidPreparationBottleVoleControl_Label',
        },
    },
    LiquidPreparationBottleBeetleControl: {
        assetName: 'LiquidPreparationBottleBeetleControl',
        nodes: {
            baseRim: 'LiquidPreparationBottleBeetleControl_Base_Rim',
            body: 'LiquidPreparationBottleBeetleControl_Body',
            shoulder: 'LiquidPreparationBottleBeetleControl_Shoulder',
            neck: 'LiquidPreparationBottleBeetleControl_Neck',
            cap: 'LiquidPreparationBottleBeetleControl_Cap',
            label: 'LiquidPreparationBottleBeetleControl_Label',
        },
    },
} satisfies Record<string, LiquidPreparationBottleConfig>;

type LiquidPreparationBottleEntityName =
    keyof typeof liquidPreparationBottleConfigs;
type SolidBottleNodeKey = Exclude<
    keyof LiquidPreparationBottleConfig['nodes'],
    'label'
>;

const solidBottleNodeKeys = [
    'baseRim',
    'body',
    'shoulder',
    'neck',
    'cap',
] satisfies SolidBottleNodeKey[];

const liquidPreparationBottleScale = 0.62;

function isLiquidPreparationBottleEntityName(
    name: string,
): name is LiquidPreparationBottleEntityName {
    return name in liquidPreparationBottleConfigs;
}

function LiquidPreparationBottlePart({
    children,
    node,
}: {
    children?: ReactNode;
    node: LiquidPreparationBottleNode;
}) {
    return (
        <mesh
            castShadow
            geometry={node.geometry}
            material={node.material}
            position={node.position}
            receiveShadow
            rotation={node.rotation}
            scale={node.scale}
        >
            {children}
        </mesh>
    );
}

function getLabelTexture(material: LiquidPreparationBottleNode['material']) {
    const firstMaterial = Array.isArray(material) ? material[0] : material;

    if (!(firstMaterial instanceof MeshStandardMaterial)) {
        return null;
    }

    if (firstMaterial.map) {
        firstMaterial.map.colorSpace = SRGBColorSpace;
    }

    return firstMaterial.map;
}

export function LiquidPreparationBottle({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    if (!isLiquidPreparationBottleEntityName(block.name)) {
        console.error(`Unknown liquid preparation bottle: ${block.name}`);
        return null;
    }

    return (
        <LiquidPreparationBottleInstance
            stack={stack}
            block={block}
            rotation={rotation}
            name={block.name}
        />
    );
}

function LiquidPreparationBottleInstance({
    stack,
    block,
    rotation,
    name,
}: EntityInstanceProps & { name: LiquidPreparationBottleEntityName }) {
    const config = liquidPreparationBottleConfigs[name];
    const { nodes } = useGameGLTF(config.assetName);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const labelNode = nodes[config.nodes.label];
    const labelTexture = getLabelTexture(labelNode.material);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={liquidPreparationBottleScale}
        >
            {solidBottleNodeKeys.map((nodeKey) => {
                const node = nodes[config.nodes[nodeKey]];

                return (
                    <LiquidPreparationBottlePart key={nodeKey} node={node}>
                        <SnowOverlay
                            geometry={node.geometry}
                            {...snowPresets.tool}
                        />
                        <RainWetOverlay
                            geometry={node.geometry}
                            topSurfaceBias={2.8}
                            darkness={0.78}
                            glossiness={0.82}
                        />
                    </LiquidPreparationBottlePart>
                );
            })}
            {labelTexture ? (
                <mesh
                    geometry={labelNode.geometry}
                    position={labelNode.position}
                    rotation={labelNode.rotation}
                    scale={labelNode.scale}
                >
                    <meshBasicMaterial
                        alphaTest={0.02}
                        map={labelTexture}
                        toneMapped={false}
                        transparent
                    />
                </mesh>
            ) : (
                <mesh
                    geometry={labelNode.geometry}
                    material={labelNode.material}
                    position={labelNode.position}
                    rotation={labelNode.rotation}
                    scale={labelNode.scale}
                />
            )}
        </animated.group>
    );
}
