import { animated } from '@react-spring/three';
import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { type ReactNode, useMemo, useRef } from 'react';
import { DoubleSide, type Group } from 'three';
import type { GLTFResult } from '../models/GameAssets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type SunflowerNodeName = Extract<
    keyof GLTFResult['nodes'],
    `Sunflower_${string}`
>;
type SunflowerNode = GLTFResult['nodes'][SunflowerNodeName];
type SunflowerMaterials = Pick<
    GLTFResult['materials'],
    'Sunflower_Sepal_Material'
>;

const stemNodeName = 'Sunflower_Stem' satisfies SunflowerNodeName;

const leafNodeNames = [
    'Sunflower_Leaf_Lower_L',
    'Sunflower_Leaf_Lower_R',
    'Sunflower_Leaf_Mid_L',
    'Sunflower_Leaf_Mid_R',
    'Sunflower_Leaf_Upper_L',
    'Sunflower_Leaf_Upper_R',
] satisfies SunflowerNodeName[];

const petalNodeNames = [
    'Sunflower_Petal_00',
    'Sunflower_Petal_01',
    'Sunflower_Petal_02',
    'Sunflower_Petal_03',
    'Sunflower_Petal_04',
    'Sunflower_Petal_05',
    'Sunflower_Petal_06',
    'Sunflower_Petal_07',
    'Sunflower_Petal_08',
    'Sunflower_Petal_09',
    'Sunflower_Petal_10',
    'Sunflower_Petal_11',
    'Sunflower_Petal_12',
    'Sunflower_Petal_13',
] satisfies SunflowerNodeName[];

const sepalNodeNames = [
    'Sunflower_Sepal_00',
    'Sunflower_Sepal_01',
    'Sunflower_Sepal_02',
    'Sunflower_Sepal_03',
    'Sunflower_Sepal_04',
    'Sunflower_Sepal_05',
    'Sunflower_Sepal_06',
] satisfies SunflowerNodeName[];

const centerDotNodeNames = [
    'Sunflower_Center_Dot_0_00',
    'Sunflower_Center_Dot_0_01',
    'Sunflower_Center_Dot_0_02',
    'Sunflower_Center_Dot_0_03',
    'Sunflower_Center_Dot_0_04',
    'Sunflower_Center_Dot_0_05',
    'Sunflower_Center_Dot_1_00',
    'Sunflower_Center_Dot_1_01',
    'Sunflower_Center_Dot_1_02',
    'Sunflower_Center_Dot_1_03',
    'Sunflower_Center_Dot_1_04',
    'Sunflower_Center_Dot_1_05',
    'Sunflower_Center_Dot_1_06',
    'Sunflower_Center_Dot_1_07',
    'Sunflower_Center_Dot_1_08',
    'Sunflower_Center_Dot_2_00',
    'Sunflower_Center_Dot_2_01',
    'Sunflower_Center_Dot_2_02',
    'Sunflower_Center_Dot_2_03',
    'Sunflower_Center_Dot_2_04',
    'Sunflower_Center_Dot_2_05',
    'Sunflower_Center_Dot_2_06',
    'Sunflower_Center_Dot_2_07',
    'Sunflower_Center_Dot_2_08',
    'Sunflower_Center_Dot_2_09',
    'Sunflower_Center_Dot_2_10',
    'Sunflower_Center_Dot_2_11',
    'Sunflower_Center_Dot_3_00',
    'Sunflower_Center_Dot_3_01',
    'Sunflower_Center_Dot_3_02',
    'Sunflower_Center_Dot_3_03',
    'Sunflower_Center_Dot_3_04',
    'Sunflower_Center_Dot_3_05',
    'Sunflower_Center_Dot_3_06',
    'Sunflower_Center_Dot_3_07',
    'Sunflower_Center_Dot_3_08',
    'Sunflower_Center_Dot_3_09',
    'Sunflower_Center_Dot_3_10',
    'Sunflower_Center_Dot_3_11',
    'Sunflower_Center_Dot_3_12',
    'Sunflower_Center_Dot_3_13',
    'Sunflower_Center_Dot_3_14',
] satisfies SunflowerNodeName[];

const headBackNodeName = 'Sunflower_Head_Back' satisfies SunflowerNodeName;
const centerNodeName = 'Sunflower_Center' satisfies SunflowerNodeName;
const sunflowerScale = 0.82;
const headPivot = [0, 1.33, 0] satisfies [number, number, number];
const colors = {
    leaf: '#6f8544',
    leafDark: '#324008',
    petal: '#ffd726',
    petalShadow: '#f4aa18',
    stem: '#324008',
};

function nodePosition(node: SunflowerNode): [number, number, number] {
    return [node.position.x, node.position.y, node.position.z];
}

function relativeHeadPosition(node: SunflowerNode): [number, number, number] {
    return [
        node.position.x - headPivot[0],
        node.position.y - headPivot[1],
        node.position.z - headPivot[2],
    ];
}

function SunflowerPart({
    children,
    node,
    relativeToHead = false,
}: {
    children: ReactNode;
    node: SunflowerNode;
    relativeToHead?: boolean;
}) {
    return (
        <mesh
            castShadow
            receiveShadow
            geometry={node.geometry}
            position={
                relativeToHead ? relativeHeadPosition(node) : nodePosition(node)
            }
            rotation={node.rotation}
            scale={node.scale}
        >
            {children}
        </mesh>
    );
}

function getHeadRotation(timeOfDay: number) {
    const daylight = Math.max(0, Math.sin(((timeOfDay - 0.2) / 0.6) * Math.PI));
    const dayProgress = Math.min(1, Math.max(0, (timeOfDay - 0.2) / 0.6));
    const nightAmount = 1 - daylight;

    return {
        pitch:
            -0.18 - nightAmount * 0.62 + Math.sin(dayProgress * Math.PI) * 0.08,
        roll: Math.sin(timeOfDay * Math.PI * 2) * 0.035,
        yaw: (dayProgress - 0.5) * 0.54 * daylight,
    };
}

function SunflowerHeadParts({
    materials,
    nodes,
}: {
    materials: SunflowerMaterials;
    nodes: GLTFResult['nodes'];
}) {
    return (
        <>
            <SunflowerPart node={nodes[headBackNodeName]} relativeToHead>
                <primitive
                    attach="material"
                    object={materials.Sunflower_Sepal_Material}
                />
            </SunflowerPart>
            {sepalNodeNames.map((nodeName) => (
                <SunflowerPart
                    key={nodeName}
                    node={nodes[nodeName]}
                    relativeToHead
                >
                    <meshStandardMaterial
                        color={colors.leafDark}
                        metalness={0}
                        roughness={0.86}
                        side={DoubleSide}
                    />
                </SunflowerPart>
            ))}
            {petalNodeNames.map((nodeName, index) => (
                <SunflowerPart
                    key={nodeName}
                    node={nodes[nodeName]}
                    relativeToHead
                >
                    <meshStandardMaterial
                        color={
                            index % 2 === 0 ? colors.petal : colors.petalShadow
                        }
                        metalness={0}
                        roughness={0.74}
                        side={DoubleSide}
                    />
                </SunflowerPart>
            ))}
            <SunflowerPart node={nodes[centerNodeName]} relativeToHead>
                <meshStandardMaterial
                    color="#7a4a21"
                    metalness={0}
                    roughness={0.88}
                />
            </SunflowerPart>
            {centerDotNodeNames.map((nodeName) => (
                <SunflowerPart
                    key={nodeName}
                    node={nodes[nodeName]}
                    relativeToHead
                >
                    <meshStandardMaterial
                        color="#2b1609"
                        metalness={0}
                        roughness={0.9}
                    />
                </SunflowerPart>
            ))}
        </>
    );
}

export function SunflowerHeadModel({
    onClick,
    position,
    rotation,
    scale = 1,
}: {
    onClick?: (event: ThreeEvent<MouseEvent>) => void;
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: number;
}) {
    const { materials, nodes } = useGameGLTF('Sunflower');

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: Three.js group uses raycast picking for the collectible model.
        <group
            onClick={onClick}
            position={position}
            rotation={rotation}
            scale={scale}
        >
            <SunflowerHeadParts materials={materials} nodes={nodes} />
        </group>
    );
}

export function Sunflower({ stack, block, rotation }: EntityInstanceProps) {
    const { materials, nodes } = useGameGLTF('Sunflower');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const headRef = useRef<Group>(null);
    const phase = useMemo(() => {
        let hash = 0;
        const key = `${block.id}:${stack.position.x}:${stack.position.z}`;
        for (let index = 0; index < key.length; index += 1) {
            hash = (hash * 31 + key.charCodeAt(index)) % 100_000;
        }
        return (hash / 100_000) * Math.PI * 2;
    }, [block.id, stack.position.x, stack.position.z]);

    useFrame(({ clock }) => {
        const head = headRef.current;
        if (!head) {
            return;
        }

        const target = getHeadRotation(timeOfDay);
        const breeze = Math.sin(clock.elapsedTime * 0.7 + phase) * 0.025;
        head.rotation.x += (target.pitch + breeze - head.rotation.x) * 0.06;
        head.rotation.y += (target.yaw - head.rotation.y) * 0.06;
        head.rotation.z += (target.roll - head.rotation.z) * 0.06;
    });

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={sunflowerScale}
        >
            <SunflowerPart node={nodes[stemNodeName]}>
                <meshStandardMaterial
                    color={colors.stem}
                    metalness={0}
                    roughness={0.82}
                />
            </SunflowerPart>
            {leafNodeNames.map((nodeName, index) => (
                <SunflowerPart key={nodeName} node={nodes[nodeName]}>
                    <meshStandardMaterial
                        color={index % 2 === 0 ? colors.leaf : colors.leafDark}
                        metalness={0}
                        roughness={0.86}
                    />
                </SunflowerPart>
            ))}
            <group ref={headRef} position={headPivot}>
                <SunflowerHeadParts materials={materials} nodes={nodes} />
            </group>
        </animated.group>
    );
}
