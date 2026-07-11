import { Suspense, useEffect, useMemo } from 'react';
import { useBlockData } from '../../hooks/useBlockData';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useDeliveryRequests } from '../../hooks/useDeliveryRequests';
import { useGardenOperations } from '../../hooks/useGardenOperations';
import { useOperations } from '../../hooks/useOperations';
import { useAllSorts } from '../../hooks/usePlantSorts';
import { resolveOperationVisualRewards } from '../../operationVisualRewards';
import { useGameState } from '../../useGameState';
import { getRaisedBedBlockIds } from '../../utils/raisedBedBlocks';
import { useGameGLTF } from '../../utils/useGameGLTF';
import {
    type RaisedBedHarvestBasketFillLevel,
    resolveRaisedBedHarvestBasketPlacements,
    resolveRaisedBedHarvestBasketState,
} from './raisedBedHarvestRewards';

const harvestOperationPageSize = 50;

type HarvestProduceKind =
    | 'green'
    | 'leafy'
    | 'orange'
    | 'pale'
    | 'red'
    | 'yellow';

// Produce models have their origin at the resting bottom; slot y keeps them
// seated on the basket's inner floor (z=0.19 in the model).
const harvestBasketProduceSlots = [
    { id: 'center-back', position: [-0.04, 0.19, 0.08], rotation: 0.4 },
    { id: 'front-right', position: [0.15, 0.188, -0.065], rotation: 1.7 },
    { id: 'front-left', position: [-0.17, 0.188, -0.07], rotation: -0.6 },
    { id: 'back-right', position: [0.16, 0.192, 0.075], rotation: 2.6 },
    { id: 'front-center', position: [-0.01, 0.186, -0.09], rotation: 0.9 },
    { id: 'back-left', position: [-0.17, 0.192, 0.08], rotation: -1.9 },
    { id: 'center-right', position: [0.07, 0.196, 0.01], rotation: 3.4 },
    { id: 'center-left', position: [-0.1, 0.194, -0.005], rotation: -2.8 },
] as const;

const harvestProduceParts = {
    green: [
        { material: 'Material.VeggieGreen', node: 'HarvestBasket_Zucchini' },
    ],
    leafy: [
        { material: 'Material.VeggieLeafy', node: 'HarvestBasket_Cabbage' },
    ],
    orange: [
        { material: 'Material.VeggieOrange', node: 'HarvestBasket_Carrot' },
        {
            material: 'Material.VeggieGreenDark',
            node: 'HarvestBasket_CarrotGreens',
        },
    ],
    pale: [
        { material: 'Material.VeggiePale', node: 'HarvestBasket_Turnip' },
        {
            material: 'Material.VeggieGreenDark',
            node: 'HarvestBasket_TurnipSprout',
        },
    ],
    red: [
        { material: 'Material.VeggieRed', node: 'HarvestBasket_Tomato' },
        {
            material: 'Material.VeggieGreenDark',
            node: 'HarvestBasket_TomatoCalyx',
        },
    ],
    yellow: [
        { material: 'Material.VeggieYellow', node: 'HarvestBasket_Pumpkin' },
        {
            material: 'Material.VeggieGreenDark',
            node: 'HarvestBasket_PumpkinStem',
        },
    ],
} as const satisfies Record<
    HarvestProduceKind,
    readonly { material: string; node: string }[]
>;

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

    if (/tikv|pumpkin|dinj|melon|buc/.test(text)) {
        return 'yellow';
    }

    if (/mrkv|carrot|cikla|beet/.test(text)) {
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
    const { nodes, materials } = useGameGLTF('HarvestBasket');
    const slot =
        harvestBasketProduceSlots[index % harvestBasketProduceSlots.length] ??
        harvestBasketProduceSlots[0];

    return (
        <group position={slot.position} rotation={[0, slot.rotation, 0]}>
            {harvestProduceParts[kind].map((part) => (
                <mesh
                    key={part.node}
                    castShadow
                    geometry={nodes[part.node].geometry}
                    material={materials[part.material]}
                />
            ))}
        </group>
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
    const { nodes, materials } = useGameGLTF('HarvestBasket');
    const produceCount =
        fillLevel === 'full' ? 8 : fillLevel === 'partial' ? 5 : 0;
    const visibleProduceKinds =
        produceKinds.length > 0 ? produceKinds : (['green'] as const);

    return (
        <group position={position} rotation={[0, rotation, 0]}>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.HarvestBasket_Weave.geometry}
                material={materials['Material.BasketWeave']}
            />
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.HarvestBasket_Rim.geometry}
                material={materials['Material.BasketRim']}
            />
            <mesh
                receiveShadow
                geometry={nodes.HarvestBasket_Inner.geometry}
                material={materials['Material.BasketInner']}
            />
            <mesh
                castShadow
                geometry={nodes.HarvestBasket_Handle.geometry}
                material={materials['Material.BasketRim']}
            />
            <mesh
                castShadow
                geometry={nodes.HarvestBasket_Pin.geometry}
                material={materials['Material.BasketPin']}
            />
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

export function RaisedBedHarvestBaskets() {
    const { data: blockData } = useBlockData();
    const { data: sortData } = useAllSorts();
    const { data: garden } = useCurrentGarden();
    const { data: operations } = useOperations();
    const {
        data: operationHistory,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useGardenOperations({
        enabled: Boolean(garden),
        includeCompleted: false,
        pageSize: harvestOperationPageSize,
    });
    const isMock = useGameState((state) => state.isMock);
    const isLocalSandbox = useGameState(
        (state) => state.localSandboxStorageKey !== null,
    );

    useEffect(() => {
        if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
        }
    }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

    const operationItems = useMemo(
        () => operationHistory?.pages.flatMap((page) => page.items) ?? [],
        [operationHistory?.pages],
    );
    const harvestCandidates = useMemo(() => {
        if (!garden || !operations) {
            return [];
        }

        const operationItemsByRaisedBedId = new Map<
            number,
            typeof operationItems
        >();
        for (const operationItem of operationItems) {
            if (operationItem.raisedBedId == null) {
                continue;
            }

            const raisedBedOperationItems =
                operationItemsByRaisedBedId.get(operationItem.raisedBedId) ??
                [];
            raisedBedOperationItems.push(operationItem);
            operationItemsByRaisedBedId.set(
                operationItem.raisedBedId,
                raisedBedOperationItems,
            );
        }

        return garden.raisedBeds.flatMap((raisedBed) => {
            const visualRewards = resolveOperationVisualRewards({
                appliedOperations: (raisedBed.appliedOperations ?? []).map(
                    (operation) => ({
                        ...operation,
                        raisedBedId: raisedBed.id,
                    }),
                ),
                operationItems:
                    operationItemsByRaisedBedId.get(raisedBed.id) ?? [],
                operations,
            });
            const state = resolveRaisedBedHarvestBasketState({
                fields: raisedBed.fields,
                raisedBedId: raisedBed.id,
                visualRewards,
            });

            return state
                ? [
                      {
                          blockIds: getRaisedBedBlockIds(garden, raisedBed.id),
                          raisedBed,
                          visualRewards,
                      },
                  ]
                : [];
        });
    }, [garden, operationItems, operations]);
    const deliveryRequests = useDeliveryRequests({
        enabled: harvestCandidates.length > 0 && !isMock && !isLocalSandbox,
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
    const harvestBaskets = useMemo(
        () =>
            harvestCandidates.flatMap((candidate) => {
                const state = resolveRaisedBedHarvestBasketState({
                    fields: candidate.raisedBed.fields,
                    hiddenOperationIds: hiddenHarvestOperationIds,
                    raisedBedId: candidate.raisedBed.id,
                    visualRewards: candidate.visualRewards,
                });

                return state ? [{ ...candidate, state }] : [];
            }),
        [harvestCandidates, hiddenHarvestOperationIds],
    );
    const harvestBasketPlacements = useMemo(
        () =>
            garden
                ? resolveRaisedBedHarvestBasketPlacements({
                      blockData,
                      raisedBeds: harvestBaskets.map((basket) => ({
                          blockIds: basket.blockIds,
                          raisedBedId: basket.raisedBed.id,
                      })),
                      stacks: garden.stacks,
                  })
                : new Map(),
        [blockData, garden, harvestBaskets],
    );
    const sortDataById = useMemo(
        () => new Map((sortData ?? []).map((sort) => [sort.id, sort])),
        [sortData],
    );

    return (
        <Suspense fallback={null}>
            {harvestBaskets.map((basket) => {
                const placement = harvestBasketPlacements.get(
                    basket.raisedBed.id,
                );
                if (!placement) {
                    return null;
                }

                const produceKinds = basket.state.producePlantSortIds.map(
                    (plantSortId) => {
                        const sort = sortDataById.get(plantSortId);

                        return resolveHarvestProduceKind([
                            sort?.information.name,
                            sort?.information.plant.information?.name,
                            sort?.information.plant.information?.latinName,
                        ]);
                    },
                );

                return (
                    <RaisedBedHarvestBasketVisual
                        key={`raised-bed-harvest-basket-${basket.raisedBed.id}`}
                        fillLevel={basket.state.fillLevel}
                        position={placement.position}
                        produceKinds={produceKinds}
                        rotation={placement.rotation}
                    />
                );
            })}
        </Suspense>
    );
}
