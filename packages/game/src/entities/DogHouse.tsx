import { animated } from '@react-spring/three';
import type { ReactNode } from 'react';
import { DoubleSide } from 'three';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type DogHouseNodeName = Extract<
    keyof GLTFResult['nodes'],
    `DogHouse_${string}`
>;
type DogHouseNode = GLTFResult['nodes'][DogHouseNodeName];

const dogHouseScale = 0.72;

const wallMaterial = {
    color: '#94301f',
    metalness: 0,
    roughness: 0.9,
    side: DoubleSide,
};

const darkWallMaterial = {
    color: '#5c1913',
    metalness: 0,
    roughness: 0.92,
    side: DoubleSide,
};

const roofMaterial = {
    color: '#242521',
    metalness: 0,
    roughness: 0.82,
    side: DoubleSide,
};

const trimMaterial = {
    color: '#e8b66c',
    metalness: 0,
    roughness: 0.78,
    side: DoubleSide,
};

const doorMaterial = {
    color: '#14100d',
    metalness: 0,
    roughness: 0.96,
    side: DoubleSide,
};

const bowlMaterial = {
    color: '#2d70ad',
    metalness: 0,
    roughness: 0.72,
    side: DoubleSide,
};

function DogHousePart({
    castShadow = true,
    children,
    node,
    receiveShadow = true,
}: {
    castShadow?: boolean;
    children: ReactNode;
    node: DogHouseNode;
    receiveShadow?: boolean;
}) {
    return (
        <mesh
            castShadow={castShadow}
            geometry={node.geometry}
            position={node.position}
            receiveShadow={receiveShadow}
            rotation={node.rotation}
            scale={node.scale}
        >
            {children}
        </mesh>
    );
}

function WeatheredDogHousePart({
    children,
    node,
    snowCoverageMultiplier = 0.8,
    snowMaxThickness = 0.055,
}: {
    children: ReactNode;
    node: DogHouseNode;
    snowCoverageMultiplier?: number;
    snowMaxThickness?: number;
}) {
    return (
        <DogHousePart node={node}>
            {children}
            <SnowOverlay
                geometry={node.geometry}
                maxThickness={snowMaxThickness}
                slopeExponent={2.6}
                noiseScale={3}
                coverageMultiplier={snowCoverageMultiplier}
            />
            <RainWetOverlay
                geometry={node.geometry}
                topSurfaceBias={2.1}
                darkness={0.62}
                glossiness={0.38}
            />
        </DogHousePart>
    );
}

export function DogHouse({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('DogHouse');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={dogHouseScale}
        >
            <WeatheredDogHousePart node={nodes.DogHouse_Walls}>
                <meshStandardMaterial {...wallMaterial} />
            </WeatheredDogHousePart>
            <WeatheredDogHousePart
                node={nodes.DogHouse_BackShadow}
                snowCoverageMultiplier={0.45}
                snowMaxThickness={0.03}
            >
                <meshStandardMaterial {...darkWallMaterial} />
            </WeatheredDogHousePart>
            <DogHousePart node={nodes.DogHouse_Door}>
                <meshStandardMaterial {...doorMaterial} />
            </DogHousePart>
            <DogHousePart node={nodes.DogHouse_DoorTop}>
                <meshStandardMaterial {...doorMaterial} />
            </DogHousePart>
            <WeatheredDogHousePart node={nodes.DogHouse_Threshold}>
                <meshStandardMaterial {...trimMaterial} />
            </WeatheredDogHousePart>
            <WeatheredDogHousePart node={nodes.DogHouse_Trim_Left}>
                <meshStandardMaterial {...trimMaterial} />
            </WeatheredDogHousePart>
            <WeatheredDogHousePart node={nodes.DogHouse_Trim_Right}>
                <meshStandardMaterial {...trimMaterial} />
            </WeatheredDogHousePart>
            <WeatheredDogHousePart
                node={nodes.DogHouse_Roof_Left}
                snowCoverageMultiplier={1}
                snowMaxThickness={0.09}
            >
                <meshStandardMaterial {...roofMaterial} />
            </WeatheredDogHousePart>
            <WeatheredDogHousePart
                node={nodes.DogHouse_Roof_Right}
                snowCoverageMultiplier={1}
                snowMaxThickness={0.09}
            >
                <meshStandardMaterial {...roofMaterial} />
            </WeatheredDogHousePart>
            <WeatheredDogHousePart
                node={nodes.DogHouse_RidgeCap}
                snowMaxThickness={0.075}
            >
                <meshStandardMaterial {...trimMaterial} />
            </WeatheredDogHousePart>
            <WeatheredDogHousePart
                node={nodes.DogHouse_NamePlate}
                snowCoverageMultiplier={0.35}
                snowMaxThickness={0.025}
            >
                <meshStandardMaterial {...trimMaterial} />
            </WeatheredDogHousePart>
            <DogHousePart node={nodes.DogHouse_Bowl}>
                <meshStandardMaterial {...bowlMaterial} />
            </DogHousePart>
            <DogHousePart node={nodes.DogHouse_Bowl_Rim}>
                <meshStandardMaterial {...trimMaterial} />
            </DogHousePart>
        </animated.group>
    );
}
