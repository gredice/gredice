import { DoubleSide } from 'three';
import type { GLTFResult } from '../../models/GameAssets';
import { useGameGLTF } from '../../utils/useGameGLTF';

type GardenFlowerModelProps = {
    bloomOnly?: boolean;
    centerColor?: string;
    petalColor?: string;
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: number | [number, number, number];
    stemColor?: string;
};

type GardenFlowerNodeName = Extract<
    keyof GLTFResult['nodes'],
    `GardenFlower_${string}`
>;

const gardenFlowerNodes = {
    center: 'GardenFlower_Center',
    leaves: 'GardenFlower_Leaves',
    petals: 'GardenFlower_Petals',
    stem: 'GardenFlower_Stem',
} satisfies Record<string, GardenFlowerNodeName>;

const bloomAnchorY = 0.428;

const vectorToTuple = (value: {
    x: number;
    y: number;
    z: number;
}): [number, number, number] => [value.x, value.y, value.z];

export function GardenFlowerModel({
    bloomOnly = false,
    centerColor = '#f1a923',
    petalColor = '#f8f3e3',
    position,
    rotation,
    scale = 1,
    stemColor = '#4f7d2f',
}: GardenFlowerModelProps) {
    const { nodes } = useGameGLTF('GardenFlower');
    const bloomYOffset = bloomOnly ? -bloomAnchorY : 0;
    const stemNode = nodes[gardenFlowerNodes.stem];
    const leavesNode = nodes[gardenFlowerNodes.leaves];
    const petalsNode = nodes[gardenFlowerNodes.petals];
    const centerNode = nodes[gardenFlowerNodes.center];

    return (
        <group position={position} rotation={rotation} scale={scale}>
            <group position={[0, bloomYOffset, 0]}>
                {!bloomOnly && (
                    <>
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={stemNode.geometry}
                            position={vectorToTuple(stemNode.position)}
                        >
                            <meshStandardMaterial
                                color={stemColor}
                                metalness={0}
                                roughness={0.84}
                            />
                        </mesh>
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={leavesNode.geometry}
                        >
                            <meshStandardMaterial
                                color={stemColor}
                                metalness={0}
                                roughness={0.86}
                                side={DoubleSide}
                            />
                        </mesh>
                    </>
                )}
                <mesh castShadow receiveShadow geometry={petalsNode.geometry}>
                    <meshStandardMaterial
                        color={petalColor}
                        metalness={0}
                        roughness={0.78}
                        side={DoubleSide}
                        vertexColors
                    />
                </mesh>
                <mesh
                    castShadow
                    receiveShadow
                    geometry={centerNode.geometry}
                    position={vectorToTuple(centerNode.position)}
                    scale={vectorToTuple(centerNode.scale)}
                >
                    <meshStandardMaterial
                        color={centerColor}
                        metalness={0}
                        roughness={0.72}
                    />
                </mesh>
            </group>
        </group>
    );
}
