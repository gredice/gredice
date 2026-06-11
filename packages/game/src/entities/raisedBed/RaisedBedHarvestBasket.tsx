import { useMemo } from 'react';
import { useBlockData } from '../../hooks/useBlockData';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useDeliveryRequests } from '../../hooks/useDeliveryRequests';
import { useAllSorts } from '../../hooks/usePlantSorts';
import { useRaisedBedOperationVisualRewards } from '../../hooks/useRaisedBedOperationVisualRewards';
import { useGameState } from '../../useGameState';
import {
    findRaisedBedByBlockId,
    getRaisedBedBlockIds,
} from '../../utils/raisedBedBlocks';
import {
    type RaisedBedHarvestBasketFillLevel,
    resolveRaisedBedHarvestBasketPlacement,
    resolveRaisedBedHarvestBasketState,
} from './raisedBedHarvestRewards';

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
        <group
            position={position}
            rotation={[0, rotation, 0]}
            scale={[1.25, 1.12, 1.25]}
        >
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

export function RaisedBedHarvestBasketForBlock({
    blockId,
}: {
    blockId: string;
}) {
    const { data: blockData } = useBlockData();
    const { data: sortData } = useAllSorts();
    const { data: garden } = useCurrentGarden();
    const raisedBed = findRaisedBedByBlockId(garden, blockId);
    const visualRewards = useRaisedBedOperationVisualRewards(raisedBed);
    const isMock = useGameState((state) => state.isMock);
    const isLocalSandbox = useGameState(
        (state) => state.localSandboxStorageKey !== null,
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
        raisedBed && raisedBed.blockId === blockId
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

    if (!harvestBasketState || !harvestBasketPlacement) {
        return null;
    }

    return (
        <RaisedBedHarvestBasketVisual
            fillLevel={harvestBasketState.fillLevel}
            position={harvestBasketPlacement.position}
            produceKinds={harvestProduceKinds}
            rotation={harvestBasketPlacement.rotation}
        />
    );
}
