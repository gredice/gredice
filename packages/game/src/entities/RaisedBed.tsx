import { animated } from '@react-spring/three';
import { useMemo } from 'react';
import { Vector3 } from 'three';
import { useHoveredBlockStore } from '../controls/useHoveredBlockStore';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useRaisedBedOperationVisualRewards } from '../hooks/useRaisedBedOperationVisualRewards';
import { useSnapshotTime } from '../hooks/useSnapshotTime';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import {
    findRaisedBedByBlockId,
    getRaisedBedBlockIds,
} from '../utils/raisedBedBlocks';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useGroundPatchMaterial } from './helpers/groundPatchMaterial';
import { HoverOutline } from './helpers/HoverOutline';
import { useEntityNeighbors } from './helpers/useEntityNeighbors';
import { RaisedBedFields } from './raisedBed/RaisedBedFields';
import { RaisedBedHarvestBasketForBlock } from './raisedBed/RaisedBedHarvestBasket';
import { getRaisedBedSoilWetPatches } from './raisedBed/raisedBedSoilWetPatches';

const combinedOverlap = 0.1;
const halfOverlap = combinedOverlap / 2;

export function RaisedBed({ stack, block }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF('RaisedBed');
    const currentStackHeight = useStackHeight(stack, block);
    const hoveredBlock = useHoveredBlockStore((state) => state.hoveredBlock);
    const { data: garden } = useCurrentGarden();
    const raisedBed = findRaisedBedByBlockId(garden, block.id);
    const visualRewards = useRaisedBedOperationVisualRewards(raisedBed);
    const currentTime = useSnapshotTime();
    const visitSummaryHighlight = useGameState(
        (state) => state.gardenVisitSummaryHighlight,
    );
    const hoveredRaisedBed = hoveredBlock
        ? findRaisedBedByBlockId(garden, hoveredBlock.id)
        : null;
    const raisedBedBlockIds =
        garden && raisedBed ? getRaisedBedBlockIds(garden, raisedBed.id) : [];
    const hovered = Boolean(
        garden &&
            hoveredRaisedBed &&
            getRaisedBedBlockIds(garden, hoveredRaisedBed.id).includes(
                block.id,
            ),
    );

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

    // Handle overlap
    const overlapOffset = new Vector3(0, 0, 0);
    if (neighbors.total === 1) {
        if (neighbors.n) {
            overlapOffset.x = halfOverlap;
        } else if (neighbors.e) {
            overlapOffset.z = -halfOverlap;
        } else if (neighbors.s) {
            overlapOffset.x = -halfOverlap;
        } else if (neighbors.w) {
            overlapOffset.z = halfOverlap;
        }
    }

    const raisedBedPosition = stack.position
        .clone()
        .setY(currentStackHeight + 1)
        .add(overlapOffset);

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
    const isVisitSummaryHighlighted =
        raisedBed?.id != null &&
        visitSummaryHighlight?.raisedBedId === raisedBed.id;
    const blockIndex = Math.max(raisedBedBlockIds.indexOf(block.id), 0);
    const blockOffset =
        Math.max(raisedBedBlockIds.length - 1 - blockIndex, 0) * 9;
    const soilWetPatches = useMemo(
        () =>
            getRaisedBedSoilWetPatches({
                blockIndex,
                blockOffset,
                blockPosition: [
                    raisedBedPosition.x,
                    raisedBedPosition.y,
                    raisedBedPosition.z,
                ],
                currentTime,
                raisedBed,
                visualRewards,
            }),
        [
            blockIndex,
            blockOffset,
            currentTime,
            raisedBed,
            raisedBedPosition.x,
            raisedBedPosition.y,
            raisedBedPosition.z,
            visualRewards,
        ],
    );
    const raisedBedSoilMaterial = useGroundPatchMaterial(
        materials['Material.Dirt'],
        'raisedBedSoil',
        { wetPatches: soilWetPatches },
    );

    return (
        <>
            <HoverOutline
                color={isVisitSummaryHighlighted ? '#f6c445' : 'white'}
                hovered={hovered || isVisitSummaryHighlighted}
                opacity={isVisitSummaryHighlighted ? 0.95 : 1}
                priority={isVisitSummaryHighlighted ? 10 : 0}
                thickness={isVisitSummaryHighlighted ? 8 : 5}
            >
                <animated.group
                    position={raisedBedPosition}
                    rotation={[0, shapeRotation * (Math.PI / 2), 0]}
                >
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes[shape1].geometry}
                        material={
                            shape1 === 'Raised_Bed_O_1'
                                ? materials['Material.Planks']
                                : raisedBedSoilMaterial
                        }
                    />
                    <SnowOverlay
                        geometry={nodes[shape1].geometry}
                        maxThickness={0.16}
                        slopeExponent={2.8}
                        noiseScale={3}
                        coverageMultiplier={0.9}
                    />
                    <RainWetOverlay geometry={nodes[shape1].geometry} />
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes[shape2].geometry}
                        material={
                            shape2 === 'Raised_Bed_O_2'
                                ? raisedBedSoilMaterial
                                : materials['Material.Planks']
                        }
                    />
                    <SnowOverlay
                        geometry={nodes[shape2].geometry}
                        maxThickness={0.16}
                        slopeExponent={2.8}
                        noiseScale={3}
                        coverageMultiplier={0.9}
                    />
                    <RainWetOverlay geometry={nodes[shape2].geometry} />
                </animated.group>
            </HoverOutline>
            <group position={raisedBedPosition}>
                <RaisedBedFields blockId={block.id} />
            </group>
            <RaisedBedHarvestBasketForBlock blockId={block.id} />
        </>
    );
}
