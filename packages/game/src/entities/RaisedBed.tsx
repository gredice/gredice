import { animated } from '@react-spring/three';
import { useMemo } from 'react';
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
    getRaisedBedFootprintSegments,
} from '../utils/raisedBedBlocks';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useGroundPatchMaterial } from './helpers/groundPatchMaterial';
import { HoverOutline } from './helpers/HoverOutline';
import { RaisedBedFields } from './raisedBed/RaisedBedFields';
import { getRaisedBedSoilWetPatches } from './raisedBed/raisedBedSoilWetPatches';

export function RaisedBed({ stack, block }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF('RaisedBed');
    const currentStackHeight = useStackHeight(stack, block);
    const hoveredBlock = useHoveredBlockStore((state) => state.hoveredBlock);
    const { data: garden } = useCurrentGarden();
    const raisedBed = findRaisedBedByBlockId(garden, block.id);
    const visualRewards = useRaisedBedOperationVisualRewards(raisedBed);
    const currentTime = useSnapshotTime();
    const targetHighlight = useGameState(
        (state) => state.gardenTargetHighlight,
    );
    const hasActiveDragPreview = useGameState((state) =>
        Boolean(state.activeDragPreview),
    );
    const segments = useMemo(
        () =>
            getRaisedBedFootprintSegments(block.rotation).map((segment) => ({
                ...segment,
                position: [
                    stack.position.x + segment.offset.x,
                    currentStackHeight + 1,
                    stack.position.z + segment.offset.z,
                ] as [number, number, number],
            })),
        [
            block.rotation,
            currentStackHeight,
            stack.position.x,
            stack.position.z,
        ],
    );
    const hovered =
        !hasActiveDragPreview &&
        hoveredBlock?.name === 'Raised_Bed' &&
        hoveredBlock.id === block.id;
    const isTargetHighlighted =
        raisedBed?.id != null && targetHighlight?.raisedBedId === raisedBed.id;
    const soilWetPatches = useMemo(
        () =>
            segments.flatMap((segment) =>
                getRaisedBedSoilWetPatches({
                    blockIndex: segment.blockIndex,
                    blockOffset: segment.blockOffset,
                    blockPosition: segment.position,
                    currentTime,
                    raisedBed,
                    visualRewards,
                }),
            ),
        [currentTime, raisedBed, segments, visualRewards],
    );
    const raisedBedSoilMaterial = useGroundPatchMaterial(
        materials['Material.Dirt'],
        'raisedBedSoil',
        { wetPatches: soilWetPatches },
    );

    return segments.map((segment) => (
        <group key={segment.blockIndex}>
            <HoverOutline
                color={isTargetHighlighted ? '#f6c445' : 'white'}
                hovered={hovered || isTargetHighlighted}
                opacity={isTargetHighlighted ? 0.95 : 1}
                priority={isTargetHighlighted ? 10 : 0}
                thickness={isTargetHighlighted ? 8 : 5}
            >
                <animated.group
                    position={segment.position}
                    rotation={[0, segment.shapeRotation * (Math.PI / 2), 0]}
                >
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Raised_Bed_U_1.geometry}
                        material={raisedBedSoilMaterial}
                    />
                    <SnowOverlay
                        geometry={nodes.Raised_Bed_U_1.geometry}
                        maxThickness={0.16}
                        slopeExponent={2.8}
                        noiseScale={3}
                        coverageMultiplier={0.9}
                    />
                    <RainWetOverlay geometry={nodes.Raised_Bed_U_1.geometry} />
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Raised_Bed_U_2.geometry}
                        material={materials['Material.Planks']}
                    />
                    <SnowOverlay
                        geometry={nodes.Raised_Bed_U_2.geometry}
                        maxThickness={0.16}
                        slopeExponent={2.8}
                        noiseScale={3}
                        coverageMultiplier={0.9}
                    />
                    <RainWetOverlay geometry={nodes.Raised_Bed_U_2.geometry} />
                </animated.group>
            </HoverOutline>
            <group position={segment.position}>
                <RaisedBedFields
                    blockId={block.id}
                    blockIndex={segment.blockIndex}
                    blockOffset={segment.blockOffset}
                />
            </group>
        </group>
    ));
}
