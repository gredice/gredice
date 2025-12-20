import { animated } from '@react-spring/three';
import { useHoveredBlockStore } from '../controls/useHoveredBlockStore';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { HoverOutline } from './helpers/HoverOutline';
import { useEntityNeighbors } from './helpers/useEntityNeighbors';
import { RiasedBedFields } from './raisedBed/RaisedBedFields';

export function RaisedBed({ stack, block }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF();
    const currentStackHeight = useStackHeight(stack, block);
    const hovered =
        useHoveredBlockStore((state) => state.hoveredBlock) === block;

    // Switch between shapes (O, L, I, U) based on neighbors
    let shape2:
        | 'Raised_Bed_O_2'
        | 'Raised_Bed_L_2'
        | 'Raised_Bed_I_2'
        | 'Raised_Bed_U_2' = 'Raised_Bed_O_2';
    let shape1:
        | 'Raised_Bed_O_1'
        | 'Raised_Bed_L_1'
        | 'Raised_Bed_I_1'
        | 'Raised_Bed_U_1' = 'Raised_Bed_O_1';
    let shapeRotation = 0;
    const neighbors = useEntityNeighbors(stack, block);
    if (neighbors.total === 1) {
        shape1 = 'Raised_Bed_U_1';
        shape2 = 'Raised_Bed_U_2';

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
            shape1 = 'Raised_Bed_I_1';
            shape2 = 'Raised_Bed_I_2';

            if (neighbors.n && neighbors.s) {
                shapeRotation = 1;
            } else {
                shapeRotation = 0;
            }
        } else {
            shape1 = 'Raised_Bed_L_1';
            shape2 = 'Raised_Bed_L_2';

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
        shape1 = 'Raised_Bed_O_1';
        shape2 = 'Raised_Bed_O_2';
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
                    geometry={nodes[shape1].geometry}
                    material={
                        materials[
                            shape1 === 'Raised_Bed_O_1'
                                ? 'Material.Planks'
                                : 'Material.Dirt'
                        ]
                    }
                >
                    <HoverOutline hovered={hovered} />
                </mesh>
                <SnowOverlay
                    geometry={nodes[shape1].geometry}
                    maxThickness={0.16}
                    slopeExponent={2.8}
                    noiseScale={3}
                    coverageMultiplier={0.9}
                />
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes[shape2].geometry}
                    material={
                        materials[
                            shape2 === 'Raised_Bed_O_2'
                                ? 'Material.Dirt'
                                : 'Material.Planks'
                        ]
                    }
                >
                    <HoverOutline hovered={hovered} />
                </mesh>
                <SnowOverlay
                    geometry={nodes[shape2].geometry}
                    maxThickness={0.16}
                    slopeExponent={2.8}
                    noiseScale={3}
                    coverageMultiplier={0.9}
                />
            </animated.group>
            <group
                position={stack.position.clone().setY(currentStackHeight + 1)}
            >
                <RiasedBedFields blockId={block.id} />
            </group>
        </>
    );
}
