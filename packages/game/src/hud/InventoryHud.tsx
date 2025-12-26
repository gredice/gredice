import type { OperationData, PlantSortData } from '@gredice/client';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { OperationImage } from '@gredice/ui/OperationImage';
import { Chip } from '@signalco/ui-primitives/Chip';
import { DotIndicator } from '@signalco/ui-primitives/DotIndicator';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useMemo, useState } from 'react';
import { useInventory } from '../hooks/useInventory';
import { useOperations } from '../hooks/useOperations';
import { useSorts } from '../hooks/usePlantSorts';
import { BackpackIcon } from '../icons/Backpack';
import { useBackpackOpenParam } from '../useUrlState';
import { HudCard } from './components/HudCard';

const GRID_SIZE = 24; // 3x4 grid

type InventoryItemData = {
    entityTypeName: string;
    entityId: string;
    amount: number;
    name?: string;
    image?: string;
};

function InventoryItemCell({
    item,
    sortData,
    operationData,
    onClick,
}: {
    item?: InventoryItemData;
    sortData?: PlantSortData;
    operationData?: OperationData;
    onClick: () => void;
}) {
    if (!item) {
        // Empty slot
        return (
            <div className="aspect-square rounded-lg border-2 border-dashed bg-card/20" />
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            className="aspect-square rounded-lg border p-0.5 relative transition-all bg-card hover:bg-primary/10"
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
            ) : (
                <div className="flex items-center justify-center h-full w-full rounded-md bg-muted">
                    <Typography level="body2" className="text-center">
                        {item.name ?? item.entityTypeName}
                    </Typography>
                </div>
            )}

            <div className="absolute -top-1.5 -right-1.5">
                <DotIndicator
                    size={18}
                    color={'success'}
                    content={<small>{item.amount?.toString()}</small>}
                />
            </div>
        </button>
    );
}

function InventoryItemModal({
    item,
    sortData,
    operationData,
    open,
    onClose,
}: {
    item: InventoryItemData;
    sortData?: PlantSortData;
    operationData?: OperationData;
    open: boolean;
    onClose: () => void;
}) {
    const displayName =
        sortData?.information?.name ??
        operationData?.information?.label ??
        item.name ??
        'Nepoznati predmet';
    const description =
        sortData?.information?.shortDescription ??
        operationData?.information?.shortDescription;

    const entityTypeLabel =
        item.entityTypeName === 'plantSort'
            ? 'Sorta biljke'
            : operationData
              ? 'Radnja'
            : item.entityTypeName;

    return (
        <Modal
            open={open}
            onOpenChange={(isOpen) => !isOpen && onClose()}
            title={displayName}
        >
            <Stack spacing={3}>
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
                    ) : (
                        <div className="size-20 rounded-lg border shrink-0 flex items-center justify-center bg-muted">
                            <Typography level="body2" className="text-center">
                                {item.name ?? item.entityTypeName}
                            </Typography>
                        </div>
                    )}
                    <Stack spacing={1} className="min-w-0">
                        <Row spacing={1} alignItems="center">
                            <Typography level="body2" secondary>
                                {entityTypeLabel}
                            </Typography>
                            <Chip color="success" className="text-xs">
                                {item.amount}
                            </Chip>
                        </Row>
                        {description && (
                            <Typography level="body2" secondary>
                                {description}
                            </Typography>
                        )}
                    </Stack>
                </div>

                <Stack spacing={1.5} className="bg-card rounded-lg p-3 border">
                    <Typography level="body2" semiBold>
                        Kako koristiti:
                    </Typography>
                    <Stack spacing={1}>
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
                                    3. U košarici označi &quot;Koristi iz
                                    ruksaka&quot;
                                </Typography>
                            </>
                        ) : (
                            <>
                                <Typography level="body3">
                                    1. Odaberi gredicu u vrtu
                                </Typography>
                                <Typography level="body3">
                                    2. Dodaj radnju u košaricu
                                </Typography>
                                <Typography level="body3">
                                    3. U košarici označi &quot;Koristi iz
                                    ruksaka&quot;
                                </Typography>
                            </>
                        )}
                    </Stack>
                </Stack>
            </Stack>
        </Modal>
    );
}

export function InventoryHud() {
    const { data: inventory } = useInventory();
    const { data: operations } = useOperations();
    const [isOpen, setIsOpen] = useBackpackOpenParam();
    const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);

    const items = inventory?.items as InventoryItemData[] | undefined;

    // Extract plant sort IDs for fetching sort data
    const plantSortIds = useMemo(() => {
        return (
            items
                ?.filter((item) => item.entityTypeName === 'plantSort')
                .map((item) => Number(item.entityId)) ?? []
        );
    }, [items]);

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

    const totalItems = useMemo(
        () => items?.reduce((sum, item) => sum + item.amount, 0) ?? 0,
        [items],
    );

    // Create grid items: fill with actual items, then empty slots
    const gridItems = useMemo(() => {
        const result: (InventoryItemData | null)[] = [];
        if (items) {
            result.push(...items);
        }
        // Fill remaining slots with nulls up to GRID_SIZE
        while (result.length < GRID_SIZE) {
            result.push(null);
        }
        return result;
    }, [items]);

    const selectedItem = selectedItemKey
        ? items?.find(
              (item) =>
                  `${item.entityTypeName}-${item.entityId}` === selectedItemKey,
          )
        : null;

    const selectedSortData =
        selectedItem?.entityTypeName === 'plantSort'
            ? sortData?.find((s) => s.id === Number(selectedItem.entityId))
            : undefined;
    const selectedOperationData = selectedItemKey
        ? operationLookup.get(selectedItemKey)
        : undefined;

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) setSelectedItemKey(null);
    };

    return (
        <HudCard open position="floating" className="static p-0.5">
            <Modal
                open={isOpen}
                onOpenChange={handleOpenChange}
                title="Ruksak"
                trigger={
                    <IconButton
                        variant="plain"
                        className="rounded-full size-10"
                        title="Inventar"
                    >
                        <div className="relative flex items-center justify-center">
                            <BackpackIcon className="size-6" />
                            {totalItems > 0 && (
                                <div className="absolute -top-4 -right-4">
                                    <DotIndicator
                                        size={24}
                                        color={'success'}
                                        content={<span>{totalItems}</span>}
                                    />
                                </div>
                            )}
                        </div>
                    </IconButton>
                }
            >
                <Stack spacing={2}>
                    <Row spacing={1}>
                        <BackpackIcon className="size-8 shrink-0" />
                        <Typography level="h6" className="font-bold">
                            Ruksak
                        </Typography>
                    </Row>
                    <Stack>
                        <Typography level="body2" semiBold>
                            Predmeti u ruksaku koje možeš iskoristiti pri sadnji
                            ili izvođenju radnji u vrtu.
                        </Typography>
                        <Typography level="body3" secondary>
                            Klikni na predmet za više informacija.
                        </Typography>
                    </Stack>
                    {/* Grid display - 6 columns */}
                    <div className="grid grid-cols-6 gap-1">
                        {gridItems.map((item, index) => {
                            const key = item
                                ? `${item.entityTypeName}-${item.entityId}`
                                : `empty-${index}`;
                            const itemSortData =
                                item?.entityTypeName === 'plantSort'
                                    ? sortData?.find(
                                          (s) => s.id === Number(item.entityId),
                                      )
                                    : undefined;
                            const itemOperationData = item
                                ? operationLookup.get(
                                      `${item.entityTypeName}-${item.entityId}`,
                                  )
                                : undefined;

                            return (
                                <InventoryItemCell
                                    key={key}
                                    item={item ?? undefined}
                                    sortData={itemSortData}
                                    operationData={itemOperationData}
                                    onClick={() => {
                                        if (item) {
                                            setSelectedItemKey(key);
                                        }
                                    }}
                                />
                            );
                        })}
                    </div>

                    {/* Empty state message */}
                    {(!items || items.length === 0) && (
                        <Typography
                            level="body3"
                            secondary
                            className="text-center"
                        >
                            Predmeti se dodaju kroz kupnju ili nagrade.
                        </Typography>
                    )}
                </Stack>
            </Modal>

            {/* Item details modal */}
            {selectedItem && (
                <InventoryItemModal
                    item={selectedItem}
                    sortData={selectedSortData}
                    operationData={selectedOperationData}
                    open={Boolean(selectedItemKey)}
                    onClose={() => setSelectedItemKey(null)}
                />
            )}
        </HudCard>
    );
}
