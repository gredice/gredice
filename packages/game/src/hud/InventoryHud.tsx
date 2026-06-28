import type { BlockData, OperationData, PlantSortData } from '@gredice/client';
import { BackpackIcon } from '@gredice/ui/BackpackIcon';
import { BlockImage } from '@gredice/ui/BlockImage';
import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Add } from '@gredice/ui/icons';
import { OperationImage } from '@gredice/ui/OperationImage';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@gredice/ui/Tabs';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import {
    GARDEN_BOX_BLOCK_STACK_LIMIT,
    getGardenBoxInventoryCapacity,
} from '../gardenBoxInventoryLimits';
import { useBlockData } from '../hooks/useBlockData';
import { useGardenBoxPlaceBlock } from '../hooks/useGardenBoxPlaceBlock';
import { useInventory } from '../hooks/useInventory';
import { useOperations } from '../hooks/useOperations';
import { useSorts } from '../hooks/usePlantSorts';
import { GameModal } from '../shared-ui/game-modal';
import { useGameState } from '../useGameState';
import {
    normalizeBackpackTab,
    useBackpackOpenParam,
    useBackpackTabParam,
} from '../useUrlState';
import { HudCard } from './components/HudCard';

const BACKPACK_GRID_SIZE = 24;

type InventoryItemData = {
    entityTypeName: string;
    entityId: string;
    amount: number;
    name?: string;
    image?: string;
};

type GardenBoxInventoryData = {
    blockId: string;
    gardenId: number;
    gardenName?: string | null;
    items: InventoryItemData[];
};

type InventoryData = {
    items: InventoryItemData[];
    gardenBoxes?: GardenBoxInventoryData[];
};

type SelectedInventoryItem = {
    item: InventoryItemData;
    source: 'backpack' | 'gardenBox';
    gardenBox?: GardenBoxInventoryData;
};

function inventoryItemKey(
    item: Pick<InventoryItemData, 'entityTypeName' | 'entityId'>,
) {
    return `${item.entityTypeName}-${item.entityId}`;
}

function inventoryItemTotal(items: InventoryItemData[]) {
    return items.reduce((sum, item) => sum + item.amount, 0);
}

function getInventoryBlockData(
    blockData: BlockData[] | null | undefined,
    item: InventoryItemData | null | undefined,
) {
    if (item?.entityTypeName !== 'block') {
        return undefined;
    }

    const blockById = blockData?.find(
        (block) => block.id.toString() === item.entityId,
    );
    if (blockById) {
        return blockById;
    }

    return blockData?.find(
        (block) =>
            block.information.name === item.entityId ||
            block.information.name === item.name ||
            block.information.label === item.entityId ||
            block.information.label === item.name,
    );
}

function inventoryItemDisplayName({
    item,
    sortData,
    operationData,
    blockData,
}: {
    item: InventoryItemData;
    sortData?: PlantSortData;
    operationData?: OperationData;
    blockData?: BlockData;
}) {
    return (
        sortData?.information?.name ??
        operationData?.information?.label ??
        blockData?.information.label ??
        item.name ??
        operationData?.information?.name ??
        item.entityTypeName
    );
}

function resolveBlockImageName(item?: InventoryItemData) {
    if (item?.entityTypeName !== 'block') {
        return null;
    }

    const blockName = item.name ?? item.entityId;
    return /^\d+$/u.test(blockName) ? null : blockName;
}

function InventoryItemCell({
    item,
    sortData,
    operationData,
    blockData,
    onClick,
}: {
    item?: InventoryItemData;
    sortData?: PlantSortData;
    operationData?: OperationData;
    blockData?: BlockData;
    onClick: () => void;
}) {
    if (!item) {
        // Empty slot
        return (
            <div className="aspect-square rounded-lg border-2 border-dashed bg-card/20" />
        );
    }

    const displayName = inventoryItemDisplayName({
        item,
        sortData,
        operationData,
        blockData,
    });
    const blockImageName = resolveBlockImageName(item);

    return (
        <button
            type="button"
            onClick={onClick}
            className="relative aspect-square overflow-visible rounded-lg border bg-card p-0.5 transition-all hover:bg-primary/10"
        >
            {sortData ? (
                <PlantOrSortImage
                    width={48}
                    height={48}
                    className="rounded-md w-full h-full object-cover"
                    plantSort={sortData}
                />
            ) : operationData ? (
                <div className="flex items-center justify-center h-full w-full rounded-md bg-card">
                    <OperationImage operation={operationData} size={48} />
                </div>
            ) : blockData ? (
                <div className="flex items-center justify-center h-full w-full rounded-md bg-card">
                    <BlockImage
                        blockName={blockData.information.name}
                        alt={blockData.information.label}
                        width={48}
                        height={48}
                        className="size-full object-contain"
                    />
                </div>
            ) : blockImageName ? (
                <div className="flex items-center justify-center h-full w-full rounded-md bg-muted/40">
                    <BlockImage
                        blockName={blockImageName}
                        alt={item.name ?? blockImageName}
                        width={64}
                        height={64}
                        className="size-full object-contain p-2"
                    />
                </div>
            ) : (
                <div className="flex items-center justify-center h-full w-full rounded-md bg-muted px-1">
                    <Typography
                        level="body3"
                        className="line-clamp-2 max-w-full break-all text-center text-xs leading-tight"
                    >
                        {displayName}
                    </Typography>
                </div>
            )}

            <div className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-tertiary-foreground/30 bg-tertiary px-1 text-[10px] font-semibold leading-none text-tertiary-foreground shadow-xs">
                {item.amount > 99 ? '99+' : item.amount}
            </div>
        </button>
    );
}

function InventoryItemsGrid({
    items,
    keyPrefix,
    minSlots = BACKPACK_GRID_SIZE,
    operationLookup,
    sortData,
    blockData,
    onItemClick,
}: {
    items: InventoryItemData[];
    keyPrefix: string;
    minSlots?: number;
    operationLookup: Map<string, OperationData>;
    sortData?: PlantSortData[];
    blockData?: BlockData[] | null;
    onItemClick: (item: InventoryItemData) => void;
}) {
    const gridItems = useMemo(() => {
        const result: (InventoryItemData | null)[] = [...items];
        while (result.length < minSlots) {
            result.push(null);
        }
        return result;
    }, [items, minSlots]);

    return (
        <div className="grid grid-cols-6 gap-1">
            {gridItems.map((item, index) => {
                const key = item
                    ? `${keyPrefix}-${inventoryItemKey(item)}`
                    : `${keyPrefix}-empty-${index}`;
                const itemSortData =
                    item?.entityTypeName === 'plantSort'
                        ? sortData?.find((s) => s.id === Number(item.entityId))
                        : undefined;
                const itemOperationData = item
                    ? operationLookup.get(inventoryItemKey(item))
                    : undefined;
                const itemBlockData = getInventoryBlockData(blockData, item);

                return (
                    <InventoryItemCell
                        key={key}
                        item={item ?? undefined}
                        sortData={itemSortData}
                        operationData={itemOperationData}
                        blockData={itemBlockData}
                        onClick={() => {
                            if (item) {
                                onItemClick(item);
                            }
                        }}
                    />
                );
            })}
        </div>
    );
}

function InventoryItemModal({
    item,
    source,
    gardenBox,
    sortData,
    operationData,
    blockData,
    open,
    onClose,
}: {
    item: InventoryItemData;
    source: SelectedInventoryItem['source'];
    gardenBox?: GardenBoxInventoryData;
    sortData?: PlantSortData;
    operationData?: OperationData;
    blockData?: BlockData;
    open: boolean;
    onClose: () => void;
}) {
    const placeGardenBoxBlock = useGardenBoxPlaceBlock();
    const blockImageName = resolveBlockImageName(item);
    const isGardenBoxBlock =
        source === 'gardenBox' && item.entityTypeName === 'block';
    const displayName = inventoryItemDisplayName({
        item,
        sortData,
        operationData,
        blockData,
    });
    const description =
        blockData?.information.shortDescription ??
        sortData?.information?.shortDescription ??
        sortData?.information?.plant?.information?.description ??
        operationData?.information?.shortDescription ??
        blockData?.information.fullDescription;
    const showHowTo = item.entityTypeName !== 'block';
    const placeGardenBoxBlockError =
        placeGardenBoxBlock.error instanceof Error
            ? placeGardenBoxBlock.error.message
            : null;

    async function handlePlaceGardenBoxBlock() {
        if (!gardenBox) {
            return;
        }

        await placeGardenBoxBlock.mutateAsync({
            gardenId: gardenBox.gardenId,
            gardenBoxBlockId: gardenBox.blockId,
            entityId: item.entityId,
        });
        onClose();
    }

    return (
        <GameModal
            open={open}
            onOpenChange={(isOpen) => !isOpen && onClose()}
            title={displayName}
        >
            <Stack spacing={6}>
                <div className="flex gap-4 items-start">
                    {sortData ? (
                        <PlantOrSortImage
                            width={80}
                            height={80}
                            className="rounded-lg border shrink-0"
                            plantSort={sortData}
                        />
                    ) : operationData ? (
                        <div className="size-20 rounded-lg border shrink-0 flex items-center justify-center bg-card">
                            <OperationImage
                                operation={operationData}
                                size={64}
                            />
                        </div>
                    ) : blockData ? (
                        <BlockImage
                            blockName={blockData.information.name}
                            alt={blockData.information.label}
                            width={80}
                            height={80}
                            className="size-20 rounded-lg border shrink-0 bg-card object-contain"
                        />
                    ) : blockImageName ? (
                        <div className="size-20 rounded-lg border shrink-0 flex items-center justify-center bg-muted/40">
                            <BlockImage
                                blockName={blockImageName}
                                alt={displayName}
                                width={72}
                                height={72}
                                className="size-full object-contain p-2"
                            />
                        </div>
                    ) : (
                        <div className="size-20 rounded-lg border shrink-0 flex items-center justify-center bg-muted">
                            <Typography level="body2" center>
                                {displayName}
                            </Typography>
                        </div>
                    )}
                    <Stack spacing={2} className="min-w-0">
                        <Row spacing={2} alignItems="center">
                            <Typography level="body1">{displayName}</Typography>
                        </Row>
                        {description && (
                            <Typography level="body2">{description}</Typography>
                        )}
                    </Stack>
                </div>

                {showHowTo && (
                    <Stack
                        spacing={3}
                        className="bg-card rounded-lg p-3 border"
                    >
                        <Typography level="body2">Kako koristiti:</Typography>
                        <Stack spacing={2}>
                            {item.entityTypeName === 'plantSort' ? (
                                <>
                                    <Typography level="body3">
                                        1. Odaberi prazno polje na gredici
                                    </Typography>
                                    <Typography level="body3">
                                        2. Klikni &quot;Posadi biljku&quot; i
                                        odaberi ovu sortu
                                    </Typography>
                                    <Typography level="body3">
                                        3. U košari označi &quot;Koristi iz
                                        ruksaka&quot;
                                    </Typography>
                                </>
                            ) : (
                                <>
                                    <Typography level="body3">
                                        1. Odaberi gredicu u vrtu
                                    </Typography>
                                    <Typography level="body3">
                                        2. Dodaj radnju u košaru
                                    </Typography>
                                    <Typography level="body3">
                                        3. U košari označi &quot;Koristi iz
                                        ruksaka&quot;
                                    </Typography>
                                </>
                            )}
                        </Stack>
                    </Stack>
                )}
                {isGardenBoxBlock && (
                    <Stack spacing={1}>
                        <Button
                            type="button"
                            variant="soft"
                            color="primary"
                            startDecorator={<Add className="size-4" />}
                            loading={placeGardenBoxBlock.isPending}
                            disabled={
                                !gardenBox || placeGardenBoxBlock.isPending
                            }
                            onClick={handlePlaceGardenBoxBlock}
                        >
                            Dodaj u vrt
                        </Button>
                        {placeGardenBoxBlockError && (
                            <Typography level="body3" className="text-red-600">
                                {placeGardenBoxBlockError}
                            </Typography>
                        )}
                    </Stack>
                )}
            </Stack>
        </GameModal>
    );
}

function GardenBoxInventoryGroup({
    gardenBox,
    index,
    operationLookup,
    sortData,
    blockData,
    onItemClick,
}: {
    gardenBox: GardenBoxInventoryData;
    index: number;
    operationLookup: Map<string, OperationData>;
    sortData?: PlantSortData[];
    blockData?: BlockData[] | null;
    onItemClick: (item: InventoryItemData) => void;
}) {
    const capacity = getGardenBoxInventoryCapacity(gardenBox.items);

    return (
        <Stack spacing={3} className="rounded-lg border bg-card/50 p-3">
            <Row spacing={3} alignItems="center">
                <BlockImage
                    blockName="GardenBox"
                    alt="Vrtna kutija"
                    width={40}
                    height={40}
                    className="size-10 rounded-md border bg-card"
                />
                <Stack spacing={0} className="min-w-0 flex-1">
                    <Typography level="body2" semiBold>
                        Vrtna kutija {index + 1}
                    </Typography>
                    <Typography level="body3" secondary>
                        {[
                            gardenBox.gardenName,
                            `${capacity.stackCount.toString()}/${capacity.maxStacks.toString()} vrsta`,
                            `${capacity.blockCount.toString()}/${capacity.maxBlocks.toString()} blokova`,
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    </Typography>
                </Stack>
            </Row>
            <InventoryItemsGrid
                items={gardenBox.items}
                keyPrefix={`garden-box-${gardenBox.gardenId}-${gardenBox.blockId}`}
                minSlots={GARDEN_BOX_BLOCK_STACK_LIMIT}
                operationLookup={operationLookup}
                sortData={sortData}
                blockData={blockData}
                onItemClick={onItemClick}
            />
            {gardenBox.items.length === 0 && (
                <Typography level="body3" secondary className="text-center">
                    Kutija je prazna.
                </Typography>
            )}
        </Stack>
    );
}

export function InventoryHud() {
    const { data: inventory } = useInventory();
    const { data: operations } = useOperations();
    const { data: blockData } = useBlockData();
    const { track } = useGameAnalytics();
    const [isOpen, setIsOpen] = useBackpackOpenParam();
    const [backpackTabParam, setBackpackTabParam] = useBackpackTabParam();
    const backpackTab = normalizeBackpackTab(backpackTabParam);
    const openGardenBoxBlockId = useGameState(
        (state) => state.openGardenBoxBlockId,
    );
    const setOpenGardenBoxBlockId = useGameState(
        (state) => state.setOpenGardenBoxBlockId,
    );
    const wasOpenRef = useRef(isOpen);
    const [selectedItem, setSelectedItem] =
        useState<SelectedInventoryItem | null>(null);

    const inventoryData = inventory as InventoryData | null | undefined;
    const items = inventoryData?.items ?? [];
    const gardenBoxes = inventoryData?.gardenBoxes ?? [];
    const gardenBoxItems = useMemo(
        () => gardenBoxes.flatMap((gardenBox) => gardenBox.items),
        [gardenBoxes],
    );
    const allItems = useMemo(
        () => [...items, ...gardenBoxItems],
        [gardenBoxItems, items],
    );

    // Extract plant sort IDs for fetching sort data
    const plantSortIds = useMemo(() => {
        return Array.from(
            new Set(
                allItems
                    .filter((item) => item.entityTypeName === 'plantSort')
                    .map((item) => Number(item.entityId)),
            ),
        );
    }, [allItems]);

    const { data: sortData } = useSorts(
        plantSortIds.length > 0 ? plantSortIds : undefined,
    );

    const operationLookup = useMemo(() => {
        if (!operations) {
            return new Map<string, OperationData>();
        }
        return new Map(
            operations.map((operation) => [
                `${operation.entityType.name}-${operation.id}`,
                operation,
            ]),
        );
    }, [operations]);

    const backpackItemsTotal = useMemo(
        () => inventoryItemTotal(items),
        [items],
    );
    const gardenBoxItemsTotal = useMemo(
        () => inventoryItemTotal(gardenBoxItems),
        [gardenBoxItems],
    );
    const totalItems = useMemo(
        () => backpackItemsTotal + gardenBoxItemsTotal,
        [backpackItemsTotal, gardenBoxItemsTotal],
    );

    useEffect(() => {
        if (!openGardenBoxBlockId) return;

        setBackpackTabParam('gardenBoxes');
        setIsOpen(true);
    }, [openGardenBoxBlockId, setBackpackTabParam, setIsOpen]);

    useEffect(() => {
        if (wasOpenRef.current && !isOpen) {
            setSelectedItem(null);
            setOpenGardenBoxBlockId(null);
        }

        wasOpenRef.current = isOpen;
    }, [isOpen, setOpenGardenBoxBlockId]);

    const selectedSortData =
        selectedItem?.item.entityTypeName === 'plantSort'
            ? sortData?.find((s) => s.id === Number(selectedItem.item.entityId))
            : undefined;
    const selectedOperationData = selectedItem
        ? operationLookup.get(inventoryItemKey(selectedItem.item))
        : undefined;
    const selectedBlockData = getInventoryBlockData(
        blockData,
        selectedItem?.item,
    );

    const handleItemClick = (
        item: InventoryItemData,
        source: 'backpack' | 'gardenBox',
        gardenBox?: GardenBoxInventoryData,
    ) => {
        track('game_inventory_item_opened', {
            entity_id: item.entityId,
            entity_type: item.entityTypeName,
            source,
        });
        setSelectedItem({
            item,
            source,
            gardenBox,
        });
    };

    const handleOpenChange = (open: boolean) => {
        if (open) {
            track('game_inventory_opened', {
                total_items: totalItems,
            });
        }
        setIsOpen(open);
        if (!open) {
            setSelectedItem(null);
            setOpenGardenBoxBlockId(null);
        }
    };
    const handleTabChange = (value: string) => {
        setBackpackTabParam(normalizeBackpackTab(value));
    };

    const tabCountClassName =
        'ml-1 rounded-full bg-muted px-1.5 text-[10px] font-semibold leading-4 text-muted-foreground';

    return (
        <HudCard open position="floating" className="static p-0.5">
            <GameModal
                open={isOpen}
                onOpenChange={handleOpenChange}
                title="Inventar"
                headerIcon={<BackpackIcon className="size-7 shrink-0" />}
                trigger={
                    <IconButton
                        variant="plain"
                        className="rounded-full size-10"
                        title="Inventar"
                    >
                        <div className="relative flex items-center justify-center">
                            <BackpackIcon className="size-6" />
                            {backpackItemsTotal > 0 && (
                                <div
                                    className={cx(
                                        'absolute -top-4 -right-4 size-6 px-1.5 rounded-full bg-tertiary text-tertiary-foreground text-sm font-semibold leading-none flex items-center justify-center shadow-md border border-tertiary-foreground/30',
                                        backpackItemsTotal > 99 &&
                                            'text-[10px]',
                                    )}
                                >
                                    {backpackItemsTotal > 99
                                        ? '99+'
                                        : backpackItemsTotal}
                                </div>
                            )}
                        </div>
                    </IconButton>
                }
            >
                <Stack spacing={4}>
                    <Tabs
                        value={backpackTab}
                        onValueChange={handleTabChange}
                        className="flex flex-col"
                    >
                        <TabsList className="self-start bg-muted-foreground/10">
                            <TabsTrigger value="backpack">
                                <Row spacing={2} alignItems="center">
                                    <BackpackIcon className="size-4 shrink-0" />
                                    <Typography>Ruksak</Typography>
                                    <span className={tabCountClassName}>
                                        {backpackItemsTotal}
                                    </span>
                                </Row>
                            </TabsTrigger>
                            <TabsTrigger value="gardenBoxes">
                                <Row spacing={2} alignItems="center">
                                    <BlockImage
                                        blockName="GardenBox"
                                        alt=""
                                        width={16}
                                        height={16}
                                        className="size-4 shrink-0"
                                    />
                                    <Typography>Kutije</Typography>
                                    <span className={tabCountClassName}>
                                        {gardenBoxes.length}
                                    </span>
                                </Row>
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="backpack" className="mt-4">
                            <Stack spacing={4}>
                                <Stack>
                                    <Typography level="body2" semiBold>
                                        Predmeti u ruksaku koje možeš
                                        iskoristiti pri sadnji ili izvođenju
                                        radnji u vrtu.
                                    </Typography>
                                    <Typography level="body3" secondary>
                                        Klikni na predmet za više informacija.
                                    </Typography>
                                </Stack>
                                <InventoryItemsGrid
                                    items={items}
                                    keyPrefix="backpack"
                                    operationLookup={operationLookup}
                                    sortData={sortData}
                                    blockData={blockData}
                                    onItemClick={(item) =>
                                        handleItemClick(item, 'backpack')
                                    }
                                />
                                {items.length === 0 && (
                                    <Typography
                                        level="body3"
                                        secondary
                                        className="text-center"
                                    >
                                        Predmeti se dodaju kroz kupnju ili
                                        nagrade.
                                    </Typography>
                                )}
                            </Stack>
                        </TabsContent>
                        <TabsContent value="gardenBoxes" className="mt-4">
                            <Stack spacing={3}>
                                {gardenBoxes.length === 0 ? (
                                    <Typography
                                        level="body3"
                                        secondary
                                        className="text-center"
                                    >
                                        Još nema vrtnih kutija.
                                    </Typography>
                                ) : (
                                    gardenBoxes.map((gardenBox, index) => (
                                        <GardenBoxInventoryGroup
                                            key={`${gardenBox.gardenId}-${gardenBox.blockId}`}
                                            gardenBox={gardenBox}
                                            index={index}
                                            operationLookup={operationLookup}
                                            sortData={sortData}
                                            blockData={blockData}
                                            onItemClick={(item) =>
                                                handleItemClick(
                                                    item,
                                                    'gardenBox',
                                                    gardenBox,
                                                )
                                            }
                                        />
                                    ))
                                )}
                            </Stack>
                        </TabsContent>
                    </Tabs>
                </Stack>
            </GameModal>

            {selectedItem && (
                <InventoryItemModal
                    item={selectedItem.item}
                    source={selectedItem.source}
                    gardenBox={selectedItem.gardenBox}
                    sortData={selectedSortData}
                    operationData={selectedOperationData}
                    blockData={selectedBlockData}
                    open={Boolean(selectedItem)}
                    onClose={() => setSelectedItem(null)}
                />
            )}
        </HudCard>
    );
}
