import { DoubleSide, type Material, MeshStandardMaterial } from 'three';
import type { GLTFResult } from '../../models/GameAssets';
import { seasonalRoles } from '../../scene/seasonalRoles';
import { useGameGLTF } from '../../utils/useGameGLTF';

type GardenFlowerModelProps = {
    bloomOnly?: boolean;
    /** Albedo override for the centre; the model's colour otherwise. */
    centerColor?: string;
    /** Petal albedo; the blossom white role when left out. */
    petalColor?: string;
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: number | [number, number, number];
    /** Albedo override for stem and leaves; the model's leaf green otherwise. */
    stemColor?: string;
};

type GardenFlowerNodeName = Extract<
    keyof GLTFResult['nodes'],
    `GardenFlower_${string}`
>;
type GardenFlowerNode = GLTFResult['nodes'][GardenFlowerNodeName];

const gardenFlowerNodes = {
    center: 'GardenFlower_Center',
    leaves: 'GardenFlower_Leaves',
    petals: 'GardenFlower_Petals',
    stem: 'GardenFlower_Stem',
} satisfies Record<string, GardenFlowerNodeName>;

const bloomAnchorY = 0.428;

// The model's petals are white vertex colours under a white material, so code
// always tints them. Without a caller colour they take the blossom white role
// from GAME_ART.md, #f2d4e2 on screen.
const defaultPetalColor = seasonalRoles.blossomWhite.albedo;
// Petal role roughness from GAME_ART.md, for a material the model lacks.
const fallbackRoughness = 0.45;

const vectorToTuple = (value: {
    x: number;
    y: number;
    z: number;
}): [number, number, number] => [value.x, value.y, value.z];

// Surface of the model's material, so a tinted part keeps its roughness,
// sidedness and vertex colours.
function modelSurface(material: Material | Material[]) {
    const source = Array.isArray(material) ? material[0] : material;

    return source instanceof MeshStandardMaterial
        ? {
              roughness: source.roughness,
              side: source.side,
              vertexColors: source.vertexColors,
          }
        : { roughness: fallbackRoughness, side: DoubleSide };
}

function GardenFlowerPart({
    color,
    node,
    position,
    scale,
}: {
    color?: string;
    node: GardenFlowerNode;
    position?: [number, number, number];
    scale?: [number, number, number];
}) {
    // Colours come from the model (assets/game-assets/GardenFlower.blend)
    // unless a caller tints the part.
    if (!color) {
        return (
            <mesh
                castShadow
                receiveShadow
                geometry={node.geometry}
                material={node.material}
                position={position}
                scale={scale}
            />
        );
    }

    return (
        <mesh
            castShadow
            receiveShadow
            geometry={node.geometry}
            position={position}
            scale={scale}
        >
            <meshStandardMaterial
                color={color}
                metalness={0}
                {...modelSurface(node.material)}
            />
        </mesh>
    );
}

export function GardenFlowerModel({
    bloomOnly = false,
    centerColor,
    petalColor = defaultPetalColor,
    position,
    rotation,
    scale = 1,
    stemColor,
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
                        <GardenFlowerPart
                            color={stemColor}
                            node={stemNode}
                            position={vectorToTuple(stemNode.position)}
                        />
                        <GardenFlowerPart color={stemColor} node={leavesNode} />
                    </>
                )}
                <GardenFlowerPart color={petalColor} node={petalsNode} />
                <GardenFlowerPart
                    color={centerColor}
                    node={centerNode}
                    position={vectorToTuple(centerNode.position)}
                    scale={vectorToTuple(centerNode.scale)}
                />
            </group>
        </group>
    );
}
