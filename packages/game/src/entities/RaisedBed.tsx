import { animated } from '@react-spring/three';
import { useMemo } from 'react';
import { Vector3 } from 'three';
import { useHoveredBlockStore } from '../controls/useHoveredBlockStore';
import { useBlockData } from '../hooks/useBlockData';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useDeliveryRequests } from '../hooks/useDeliveryRequests';
import { useAllSorts } from '../hooks/usePlantSorts';
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
import { HoverOutline } from './helpers/HoverOutline';
import { useEntityNeighbors } from './helpers/useEntityNeighbors';
import { RaisedBedFields } from './raisedBed/RaisedBedFields';
import {
    type RaisedBedHarvestBasketFillLevel,
    resolveRaisedBedHarvestBasketPlacement,
    resolveRaisedBedHarvestBasketState,
} from './raisedBed/raisedBedHarvestRewards';
import { isWateringRewardVisible } from './raisedBed/raisedBedWateringRewards';

const combinedOverlap = 0.1;
const halfOverlap = combinedOverlap / 2;

type HarvestProduceKind = 'green' | 'leafy' | 'orange' | 'pale' | 'red';

const harvestBasketProduceSlots = [
    { id: 'front-left', position: [-0.12, 0.175, -0.055] },
    { id: 'center-left', position: [-0.045, 0.19, 0.02] },
    { id: 'center-right', position: [0.04, 0.18, -0.04] },
    { id: 'front-right', position: [0.12, 0.19, 0.04] },
    { id: 'back-left', position: [-0.085, 0.22, 0.075] },
    { id: 'back-right', position: [0.075, 0.225, 0.085] },
    { id: 'front-center', position: [0, 0.235, -0.095] },
    { id: 'outer-right', position: [0.145, 0.225, -0.08] },
] as const;

function normalizeProduceLabel(value: string) {
    return value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
}

function resolveHarvestProduceKind(
    labels: Array<string | null | undefined>,
): HarvestProduceKind {
    const text = normalizeProduceLabel(labels.filter(Boolean).join(' '));

    if (
        /rajc|paradajz|tomato|jagod|strawberry|paprika|pepper|rotkv|radish/.test(
            text,
        )
    ) {
        return 'red';
    }

    if (/mrkv|carrot|tikv|pumpkin|dinj|melon|cikla|beet/.test(text)) {
        return 'orange';
    }

    if (
        /salat|lettuce|spinat|spinach|blitv|chard|rukol|arugula|kelj|kale|kupus|cabbage|brokul|broccoli/.test(
            text,
        )
    ) {
        return 'leafy';
    }

    if (/luk|onion|cesnjak|garlic|poriluk|leek/.test(text)) {
        return 'pale';
    }

    return 'green';
}

function HarvestBasketProduce({
    index,
    kind,
}: {
    index: number;
    kind: HarvestProduceKind;
}) {
    const position =
        harvestBasketProduceSlots[index % harvestBasketProduceSlots.length]
            ?.position ?? harvestBasketProduceSlots[0].position;

    if (kind === 'leafy') {
        return (
            <group position={position} rotation={[0, index * 0.9, 0]}>
                <mesh scale={[1.6, 0.45, 0.9]}>
                    <sphereGeometry args={[0.04, 8, 6]} />
                    <meshStandardMaterial color="#4f8d45" roughness={0.85} />
                </mesh>
                <mesh
                    position={[0.018, 0.012, -0.012]}
                    scale={[1.1, 0.35, 0.7]}
                >
                    <sphereGeometry args={[0.032, 8, 6]} />
                    <meshStandardMaterial color="#6aa84f" roughness={0.85} />
                </mesh>
            </group>
        );
    }

    if (kind === 'pale') {
        return (
            <group position={position}>
                <mesh>
                    <sphereGeometry args={[0.034, 8, 6]} />
                    <meshStandardMaterial color="#efe0b8" roughness={0.82} />
                </mesh>
                <mesh position={[0, 0.04, 0]} rotation={[0.35, 0, 0]}>
                    <coneGeometry args={[0.012, 0.075, 5]} />
                    <meshStandardMaterial color="#6c8f42" roughness={0.9} />
                </mesh>
            </group>
        );
    }

    const color =
        kind === 'red' ? '#c74335' : kind === 'orange' ? '#d9822b' : '#5f8c44';
    const scale =
        kind === 'green' ? ([1.65, 0.72, 0.86] as const) : ([1, 1, 1] as const);

    return (
        <mesh position={position} rotation={[0, index * 0.7, 0]} scale={scale}>
            <sphereGeometry args={[0.038, 8, 6]} />
            <meshStandardMaterial color={color} roughness={0.82} />
        </mesh>
    );
}

function RaisedBedHarvestBasketVisual({
    fillLevel,
    position,
    produceKinds,
    rotation,
}: {
    fillLevel: RaisedBedHarvestBasketFillLevel;
    position: [number, number, number];
    produceKinds: HarvestProduceKind[];
    rotation: number;
}) {
    const produceCount =
        fillLevel === 'full' ? 8 : fillLevel === 'partial' ? 5 : 0;
    const visibleProduceKinds =
        produceKinds.length > 0 ? produceKinds : (['green'] as const);

    return (
        <group position={position} rotation={[0, rotation, 0]}>
            <mesh castShadow receiveShadow position={[0, 0.055, 0]}>
                <boxGeometry args={[0.52, 0.08, 0.36]} />
                <meshStandardMaterial color="#7a4f2b" roughness={0.95} />
            </mesh>
            <mesh castShadow position={[0, 0.125, -0.19]}>
                <boxGeometry args={[0.56, 0.13, 0.035]} />
                <meshStandardMaterial color="#b47a43" roughness={0.95} />
            </mesh>
            <mesh castShadow position={[0, 0.125, 0.19]}>
                <boxGeometry args={[0.56, 0.13, 0.035]} />
                <meshStandardMaterial color="#b47a43" roughness={0.95} />
            </mesh>
            <mesh castShadow position={[-0.28, 0.125, 0]}>
                <boxGeometry args={[0.035, 0.13, 0.36]} />
                <meshStandardMaterial color="#a16939" roughness={0.95} />
            </mesh>
            <mesh castShadow position={[0.28, 0.125, 0]}>
                <boxGeometry args={[0.035, 0.13, 0.36]} />
                <meshStandardMaterial color="#a16939" roughness={0.95} />
            </mesh>
            <mesh castShadow position={[0, 0.205, -0.205]}>
                <boxGeometry args={[0.48, 0.028, 0.035]} />
                <meshStandardMaterial color="#d09a5b" roughness={0.9} />
            </mesh>
            <mesh castShadow position={[0, 0.205, 0.205]}>
                <boxGeometry args={[0.48, 0.028, 0.035]} />
                <meshStandardMaterial color="#d09a5b" roughness={0.9} />
            </mesh>
            {harvestBasketProduceSlots
                .slice(0, produceCount)
                .map((slot, index) => (
                    <HarvestBasketProduce
                        key={`harvest-basket-produce-${slot.id}`}
                        index={index}
                        kind={
                            visibleProduceKinds[
                                index % visibleProduceKinds.length
                            ]
                        }
                    />
                ))}
        </group>
    );
}

export function RaisedBed({ stack, block }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF('RaisedBed');
    const { data: blockData } = useBlockData();
    const { data: sortData } = useAllSorts();
    const currentStackHeight = useStackHeight(stack, block);
    const hoveredBlock = useHoveredBlockStore((state) => state.hoveredBlock);
    const { data: garden } = useCurrentGarden();
    const raisedBed = findRaisedBedByBlockId(garden, block.id);
    const visualRewards = useRaisedBedOperationVisualRewards(raisedBed);
    const currentTime = useSnapshotTime();
    const isMock = useGameState((state) => state.isMock);
    const isLocalSandbox = useGameState(
        (state) => state.localSandboxStorageKey !== null,
    );
    const visitSummaryHighlight = useGameState(
        (state) => state.gardenVisitSummaryHighlight,
    );
    const hasHarvestRewards = visualRewards.some(
        (reward) =>
            reward.family === 'harvest' && reward.raisedBedId === raisedBed?.id,
    );
    const deliveryRequests = useDeliveryRequests({
        enabled:
            Boolean(raisedBed) &&
            hasHarvestRewards &&
            !isMock &&
            !isLocalSandbox,
    });
    const hoveredRaisedBed = hoveredBlock
        ? findRaisedBedByBlockId(garden, hoveredBlock.id)
        : null;
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
    const dirtShape = shape1 === 'Raised_Bed_O_1' ? shape2 : shape1;
    const hasRaisedBedWateringReward = visualRewards.some(
        (reward) =>
            reward.scope === 'raisedBed' &&
            reward.raisedBedId === raisedBed?.id &&
            isWateringRewardVisible(reward, currentTime),
    );
    const hiddenHarvestOperationIds = useMemo(
        () =>
            new Set(
                (deliveryRequests.data ?? [])
                    .filter(
                        (request) =>
                            request.state === 'ready' ||
                            request.state === 'fulfilled',
                    )
                    .map((request) => request.operationId),
            ),
        [deliveryRequests.data],
    );
    const harvestBasketState =
        raisedBed && raisedBed.blockId === block.id
            ? resolveRaisedBedHarvestBasketState({
                  fields: raisedBed.fields,
                  hiddenOperationIds: hiddenHarvestOperationIds,
                  raisedBedId: raisedBed.id,
                  visualRewards,
              })
            : null;
    const harvestBasketPlacement =
        garden && raisedBed && harvestBasketState
            ? resolveRaisedBedHarvestBasketPlacement({
                  blockData,
                  blockIds: getRaisedBedBlockIds(garden, raisedBed.id),
                  stacks: garden.stacks,
              })
            : null;
    const sortDataById = useMemo(
        () => new Map((sortData ?? []).map((sort) => [sort.id, sort])),
        [sortData],
    );
    const harvestProduceKinds = useMemo(
        () =>
            harvestBasketState?.producePlantSortIds.map((plantSortId) => {
                const sort = sortDataById.get(plantSortId);

                return resolveHarvestProduceKind([
                    sort?.information.name,
                    sort?.information.plant.information?.name,
                    sort?.information.plant.information?.latinName,
                ]);
            }) ?? [],
        [harvestBasketState?.producePlantSortIds, sortDataById],
    );
    const isVisitSummaryHighlighted =
        raisedBed?.id != null &&
        visitSummaryHighlight?.raisedBedId === raisedBed.id;

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
                            materials[
                                shape1 === 'Raised_Bed_O_1'
                                    ? 'Material.Planks'
                                    : 'Material.Dirt'
                            ]
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
                            materials[
                                shape2 === 'Raised_Bed_O_2'
                                    ? 'Material.Dirt'
                                    : 'Material.Planks'
                            ]
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
                    {hasRaisedBedWateringReward && (
                        <mesh
                            geometry={nodes[dirtShape].geometry}
                            renderOrder={1}
                        >
                            <meshStandardMaterial
                                color="#18201d"
                                depthWrite={false}
                                opacity={0.46}
                                polygonOffset
                                polygonOffsetFactor={-5}
                                roughness={0.6}
                                transparent
                            />
                        </mesh>
                    )}
                </animated.group>
            </HoverOutline>
            <group position={raisedBedPosition}>
                <RaisedBedFields blockId={block.id} />
            </group>
            {harvestBasketState && harvestBasketPlacement && (
                <RaisedBedHarvestBasketVisual
                    fillLevel={harvestBasketState.fillLevel}
                    position={harvestBasketPlacement.position}
                    produceKinds={harvestProduceKinds}
                    rotation={harvestBasketPlacement.rotation}
                />
            )}
        </>
    );
}
