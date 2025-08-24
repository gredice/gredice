import { animated, } from '@react-spring/three';
import { useHoveredBlockStore } from '../controls/SelectableGroup';
import { models } from '../data/models';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { HoverOutline } from './helpers/HoverOutline';
import { useEntityNeighbors } from './helpers/useEntityNeighbors';
import { RiasedBedFields } from './raisedBed/RaisedBedFields';

export function RaisedBed({ stack, block }: EntityInstanceProps) {
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url);
    const currentStackHeight = useStackHeight(stack, block);
    const hovered =
        useHoveredBlockStore((state) => state.hoveredBlock) === block;

    // Switch between shapes (O, L, I, U) based on neighbors
    let shape = 'O';
    let shapeRotation = 0;
    const neighbors = useEntityNeighbors(stack, block);
    if (neighbors.total === 1) {
        shape = 'U';

        if (neighbors.n) {
            shapeRotation = 0;
        } else if (neighbors.e) {
            shapeRotation = 1;
        } else if (neighbors.s) {
            shapeRotation = 2;
        } else if (neighbors.w) {
            shapeRotation = 3;
        }
    } else if (neighbors.total === 2) {
        if ((neighbors.n && neighbors.s) || (neighbors.e && neighbors.w)) {
            shape = 'I';

            if (neighbors.n && neighbors.s) {
                shapeRotation = 1;
            } else {
                shapeRotation = 0;
            }
        } else {
            shape = 'L';

            if (neighbors.n && neighbors.e) {
                shapeRotation = 0;
            } else if (neighbors.e && neighbors.s) {
                shapeRotation = 1;
            } else if (neighbors.s && neighbors.w) {
                shapeRotation = 2;
            } else {
                shapeRotation = 3;
            }
        }
    } else if (neighbors.total === 3) {
        shape = 'O';
    }

    return (
        <>
            <animated.group
                position={stack.position.clone().setY(currentStackHeight + 1)}
                rotation={[0, shapeRotation * (Math.PI / 2), 0]}
            >
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes[`Raised_Bed_${shape}_2`].geometry}
                    material={materials[shape === 'O' ? 'Material.Dirt' : 'Material.Planks']}
                >
                    <HoverOutline hovered={hovered} />
                </mesh>
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes[`Raised_Bed_${shape}_1`].geometry}
                    material={materials[shape === 'O' ? 'Material.Planks' : 'Material.Dirt']}
                >
                    <HoverOutline hovered={hovered} />
                </mesh>
            </animated.group>
            <group
                position={stack.position.clone().setY(currentStackHeight + 1)}
            >
                <RiasedBedFields blockId={block.id} />
            </group>
        </>
    );
}
