import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { rectSwappingStrategy, SortableContext } from '@dnd-kit/sortable';
import { Heart, History, Lightning } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useGameAnalytics } from '../../analytics/GameAnalyticsContext';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useAllSorts } from '../../hooks/usePlantSorts';
import {
    type ShoppingCartItemData,
    useShoppingCart,
} from '../../hooks/useShoppingCart';
import { useSwapShoppingCartPositions } from '../../hooks/useSwapShoppingCartPositions';
import { isRaisedBedAbandoned } from '../../raisedBedConstants';
import { getRaisedBedBlockIds } from '../../utils/raisedBedBlocks';
import { isRaisedBedFieldOccupied } from '../../utils/raisedBedFields';
import { getPositionIndexFromGrid } from '../../utils/raisedBedOrientation';
import {
    getRaisedBedFieldRelationshipIndicators,
    type RaisedBedFieldRelationshipIndicator as RaisedBedFieldRelationshipIndicatorData,
    type RaisedBedFieldRelationshipIndicatorDirection,
} from './plantRelationshipSignals';
import { RaisedBedFieldAbandoned } from './RaisedBedFieldAbandoned';
import { RaisedBedFieldInvalidShape } from './RaisedBedFieldInvalidShape';
import { RaisedBedFieldItem } from './RaisedBedFieldItem';
import { RaisedBedFieldRelationshipIndicator } from './RaisedBedFieldRelationshipIndicator';
import { SortableFieldItem } from './SortableFieldItem';

type PendingFieldMove = {
    fromPositionIndex: number;
    itemA: ShoppingCartItemData;
    itemB?: ShoppingCartItemData;
    sequence: number;
    toPositionIndex: number;
};

type RaisedBedFieldLayerPreferences = {
    showPlantHistoryBadges: boolean;
    showRelationshipIndicators: boolean;
};

type RaisedBedFieldRelationshipIndicatorLayer =
    RaisedBedFieldRelationshipIndicatorData & {
        showBadge: boolean;
    };

const RAISED_BED_FIELD_LAYER_PREFERENCES_STORAGE_KEY =
    'gredice:raised-bed-field-layer-preferences';
const DEFAULT_RAISED_BED_FIELD_LAYER_PREFERENCES: RaisedBedFieldLayerPreferences =
    {
        showPlantHistoryBadges: true,
        showRelationshipIndicators: true,
    };
const OPPOSITE_RELATIONSHIP_DIRECTIONS: Record<
    RaisedBedFieldRelationshipIndicatorDirection,
    RaisedBedFieldRelationshipIndicatorDirection
> = {
    bottom: 'top',
    bottomLeft: 'topRight',
    bottomRight: 'topLeft',
    left: 'right',
    right: 'left',
    top: 'bottom',
    topLeft: 'bottomRight',
    topRight: 'bottomLeft',
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isRaisedBedCartPlantItem(
    item: ShoppingCartItemData,
    gardenId: number,
    raisedBedId: number,
): item is ShoppingCartItemData & { positionIndex: number } {
    return (
        item.gardenId === gardenId &&
        item.raisedBedId === raisedBedId &&
        item.entityTypeName === 'plantSort' &&
        item.status === 'new' &&
        typeof item.positionIndex === 'number'
    );
}

function readRaisedBedFieldLayerPreferences(): RaisedBedFieldLayerPreferences {
    if (typeof window === 'undefined') {
        return DEFAULT_RAISED_BED_FIELD_LAYER_PREFERENCES;
    }

    try {
        const storedValue = window.localStorage.getItem(
            RAISED_BED_FIELD_LAYER_PREFERENCES_STORAGE_KEY,
        );
        if (!storedValue) {
            return DEFAULT_RAISED_BED_FIELD_LAYER_PREFERENCES;
        }

        const parsedValue: unknown = JSON.parse(storedValue);
        if (!isRecord(parsedValue)) {
            return DEFAULT_RAISED_BED_FIELD_LAYER_PREFERENCES;
        }

        return {
            showPlantHistoryBadges:
                typeof parsedValue.showPlantHistoryBadges === 'boolean'
                    ? parsedValue.showPlantHistoryBadges
                    : DEFAULT_RAISED_BED_FIELD_LAYER_PREFERENCES.showPlantHistoryBadges,
            showRelationshipIndicators:
                typeof parsedValue.showRelationshipIndicators === 'boolean'
                    ? parsedValue.showRelationshipIndicators
                    : DEFAULT_RAISED_BED_FIELD_LAYER_PREFERENCES.showRelationshipIndicators,
        };
    } catch {
        return DEFAULT_RAISED_BED_FIELD_LAYER_PREFERENCES;
    }
}

function writeRaisedBedFieldLayerPreferences(
    preferences: RaisedBedFieldLayerPreferences,
) {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(
            RAISED_BED_FIELD_LAYER_PREFERENCES_STORAGE_KEY,
            JSON.stringify(preferences),
        );
    } catch {
        // Layer visibility is a convenience preference; ignore storage failures.
    }
}

function addRelationshipIndicatorLayer(
    indicatorsByPosition: Map<
        number,
        RaisedBedFieldRelationshipIndicatorLayer[]
    >,
    indicator: RaisedBedFieldRelationshipIndicatorLayer,
) {
    const indicators = indicatorsByPosition.get(indicator.positionIndex) ?? [];
    indicators.push(indicator);
    indicatorsByPosition.set(indicator.positionIndex, indicators);
}

function RaisedBedFieldLayerToggle({
    children,
    isPressed,
    label,
    onClick,
    storageName,
}: {
    children: ReactNode;
    isPressed: boolean;
    label: string;
    onClick: () => void;
    storageName: 'history' | 'relationships';
}) {
    return (
        <button
            aria-label={label}
            aria-pressed={isPressed}
            className={cx(
                'inline-flex size-10 items-center justify-center rounded-md border-2 border-white shadow-md ring-1 ring-black/10 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700',
                isPressed
                    ? 'bg-gradient-to-br from-lime-100/90 to-lime-100/80 text-primary hover:text-primary/80 dark:from-lime-200/80 dark:to-lime-200/70 dark:text-primary-foreground dark:hover:text-primary-foreground/80'
                    : 'bg-white/85 text-lime-950 hover:bg-white',
            )}
            data-raised-bed-layer-control={storageName}
            onClick={onClick}
            title={label}
            type="button"
        >
            {children}
        </button>
    );
}

export function RaisedBedField({
    gardenId,
    raisedBedId,
}: {
    gardenId: number;
    raisedBedId: number;
}) {
    const { data: garden } = useCurrentGarden();
    const { data: cart, isLoading: isCartLoading } = useShoppingCart();
    const { data: allSorts } = useAllSorts();
    const { track } = useGameAnalytics();
    const swapPositions = useSwapShoppingCartPositions();
    const [pendingMove, setPendingMove] = useState<PendingFieldMove | null>(
        null,
    );
    const moveSequenceRef = useRef(0);
    const [dropAnimationDisabled, setDropAnimationDisabled] = useState(false);
    const [isHudDialogOpen, setIsHudDialogOpen] = useState(false);
    const [layerPreferences, setLayerPreferences] = useState(
        readRaisedBedFieldLayerPreferences,
    );
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    const plantHistoryToggleLabel = layerPreferences.showPlantHistoryBadges
        ? 'Sakrij prethodne biljke'
        : 'Prikaži prethodne biljke';
    const relationshipsToggleLabel = layerPreferences.showRelationshipIndicators
        ? 'Sakrij dobre i loše susjede'
        : 'Prikaži dobre i loše susjede';

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 200,
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor),
    );

    useEffect(() => {
        if (!dropAnimationDisabled) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setDropAnimationDisabled(false);
        }, 250);

        return () => window.clearTimeout(timeoutId);
    }, [dropAnimationDisabled]);

    useEffect(() => {
        function syncDialogState() {
            const openDialog = document.querySelector(
                '[role="dialog"][data-state="open"], [data-vaul-drawer][data-state="open"]',
            );
            setIsHudDialogOpen(Boolean(openDialog));
        }

        syncDialogState();
        const observer = new MutationObserver(() => {
            syncDialogState();
        });
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['data-state'],
            childList: true,
            subtree: true,
        });

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        writeRaisedBedFieldLayerPreferences(layerPreferences);
    }, [layerPreferences]);

    // Determine which positions have cart items (draggable)
    const baseCartItemsByPosition = useMemo(() => {
        const itemsByPosition = new Map<number, ShoppingCartItemData>();

        for (const item of cart?.items ?? []) {
            if (isRaisedBedCartPlantItem(item, gardenId, raisedBedId)) {
                itemsByPosition.set(item.positionIndex, item);
            }
        }

        return itemsByPosition;
    }, [cart?.items, gardenId, raisedBedId]);

    // Keep a valid drop visually settled while the cart mutation catches up.
    const cartItemsByPosition = useMemo(() => {
        const itemsByPosition = new Map(baseCartItemsByPosition);

        if (!pendingMove) {
            return itemsByPosition;
        }

        itemsByPosition.set(pendingMove.toPositionIndex, {
            ...pendingMove.itemA,
            positionIndex: pendingMove.toPositionIndex,
        });

        if (pendingMove.itemB) {
            itemsByPosition.set(pendingMove.fromPositionIndex, {
                ...pendingMove.itemB,
                positionIndex: pendingMove.fromPositionIndex,
            });
        } else {
            itemsByPosition.delete(pendingMove.fromPositionIndex);
        }

        return itemsByPosition;
    }, [baseCartItemsByPosition, pendingMove]);

    useEffect(() => {
        if (!pendingMove) {
            return;
        }

        const targetItem = baseCartItemsByPosition.get(
            pendingMove.toPositionIndex,
        );
        const sourceItem = baseCartItemsByPosition.get(
            pendingMove.fromPositionIndex,
        );
        const sourceMatches = pendingMove.itemB
            ? sourceItem?.id === pendingMove.itemB.id
            : !sourceItem;

        if (targetItem?.id === pendingMove.itemA.id && sourceMatches) {
            setPendingMove(null);
        }
    }, [baseCartItemsByPosition, pendingMove]);

    if (isRaisedBedAbandoned(raisedBed?.status)) {
        return <RaisedBedFieldAbandoned reason={raisedBed?.abandonReason} />;
    }

    if (!raisedBed?.isValid) {
        return <RaisedBedFieldInvalidShape />;
    }

    const blockCount =
        garden && raisedBed
            ? Math.max(getRaisedBedBlockIds(garden, raisedBed.id).length, 1)
            : 1;
    const totalRows = blockCount * 3;
    const totalColumns = 3;

    const rows = Array.from({ length: totalRows }, (_, index) => ({
        id: `row-${index.toString()}`,
        index,
    }));
    const columns = Array.from({ length: totalColumns }, (_, index) => ({
        id: `col-${index.toString()}`,
        index,
    }));

    // Build position index array for sortable context
    const allPositionIndices: number[] = [];
    for (const row of rows) {
        for (const column of columns) {
            const visualBlockIndex = Math.floor(row.index / 3);
            const blockIndex = blockCount - 1 - visualBlockIndex;
            const rowWithinBlock = row.index % 3;
            const columnWithinBlock = column.index;
            const positionIndex =
                getPositionIndexFromGrid(
                    rowWithinBlock,
                    columnWithinBlock,
                    'vertical',
                ) +
                blockIndex * 9;
            allPositionIndices.push(positionIndex);
        }
    }

    // Determine which positions have planted fields (not draggable)
    const plantedPositions = new Set(
        raisedBed.fields
            .filter((field) => isRaisedBedFieldOccupied(field))
            .map((field) => field.positionIndex),
    );
    const relationshipIndicatorsByPosition = new Map<
        number,
        RaisedBedFieldRelationshipIndicatorLayer[]
    >();
    if (layerPreferences.showRelationshipIndicators) {
        for (const indicator of getRaisedBedFieldRelationshipIndicators({
            blockCount,
            cartItems: Array.from(cartItemsByPosition.values()),
            fields: raisedBed.fields,
            gardenId,
            raisedBedId,
            sorts: allSorts,
        })) {
            addRelationshipIndicatorLayer(relationshipIndicatorsByPosition, {
                ...indicator,
                showBadge: true,
            });
            addRelationshipIndicatorLayer(relationshipIndicatorsByPosition, {
                ...indicator,
                direction:
                    OPPOSITE_RELATIONSHIP_DIRECTIONS[indicator.direction],
                neighborPositionIndex: indicator.positionIndex,
                positionIndex: indicator.neighborPositionIndex,
                showBadge: false,
            });
        }
    }

    function handleDragEnd(event: DragEndEvent) {
        if (isHudDialogOpen) return;

        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const activePos = Number(active.id);
        const overPos = Number(over.id);

        const activeCartItem = cartItemsByPosition.get(activePos);
        const overCartItem = cartItemsByPosition.get(overPos);

        // Active item must be a cart item
        if (!activeCartItem) return;

        // Don't allow moving to a planted position
        if (plantedPositions.has(overPos)) return;

        const moveSequence = moveSequenceRef.current + 1;
        moveSequenceRef.current = moveSequence;

        setPendingMove({
            fromPositionIndex: activePos,
            itemA: activeCartItem,
            itemB: overCartItem,
            sequence: moveSequence,
            toPositionIndex: overPos,
        });
        setDropAnimationDisabled(true);
        track('game_raised_bed_field_moved', {
            from_position_index: activePos,
            garden_id: gardenId,
            raised_bed_id: raisedBedId,
            replaced_existing_cart_item: Boolean(overCartItem),
            to_position_index: overPos,
        });
        swapPositions.mutate(
            {
                itemA: activeCartItem,
                itemB: overCartItem,
                targetPositionIndex: overPos,
            },
            {
                onSettled: () => {
                    setPendingMove((currentMove) =>
                        currentMove?.sequence === moveSequence
                            ? null
                            : currentMove,
                    );
                },
            },
        );
    }

    const sortableItems = allPositionIndices.map((pos) => pos.toString());

    return (
        <div className="relative size-full">
            <div className="absolute -left-12 bottom-0 z-30 flex flex-col gap-2">
                <RaisedBedFieldLayerToggle
                    isPressed={layerPreferences.showPlantHistoryBadges}
                    label={plantHistoryToggleLabel}
                    onClick={() =>
                        setLayerPreferences((current) => ({
                            ...current,
                            showPlantHistoryBadges:
                                !current.showPlantHistoryBadges,
                        }))
                    }
                    storageName="history"
                >
                    <History aria-hidden className="size-5" />
                </RaisedBedFieldLayerToggle>
                <RaisedBedFieldLayerToggle
                    isPressed={layerPreferences.showRelationshipIndicators}
                    label={relationshipsToggleLabel}
                    onClick={() =>
                        setLayerPreferences((current) => ({
                            ...current,
                            showRelationshipIndicators:
                                !current.showRelationshipIndicators,
                        }))
                    }
                    storageName="relationships"
                >
                    <span className="flex items-center justify-center gap-0.5">
                        <Heart
                            aria-hidden
                            className="size-3.5 shrink-0 fill-current"
                            strokeWidth={3}
                        />
                        <Lightning
                            aria-hidden
                            className="size-4 shrink-0 fill-current"
                            strokeWidth={3}
                        />
                    </span>
                </RaisedBedFieldLayerToggle>
            </div>
            <DndContext
                id={`raised-bed-field-${gardenId}-${raisedBedId}`}
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={sortableItems}
                    strategy={rectSwappingStrategy}
                >
                    <div
                        className="size-full grid"
                        style={{
                            gridTemplateRows: `repeat(${totalRows}, minmax(0, 1fr))`,
                        }}
                    >
                        {rows.map((row) => (
                            <div
                                key={row.id}
                                className="size-full grid"
                                style={{
                                    gridTemplateColumns: `repeat(${totalColumns}, minmax(0, 1fr))`,
                                }}
                            >
                                {columns.map((column) => {
                                    const visualBlockIndex = Math.floor(
                                        row.index / 3,
                                    );
                                    const blockIndex =
                                        blockCount - 1 - visualBlockIndex;
                                    const rowWithinBlock = row.index % 3;
                                    const columnWithinBlock = column.index;
                                    const positionIndex =
                                        getPositionIndexFromGrid(
                                            rowWithinBlock,
                                            columnWithinBlock,
                                            'vertical',
                                        ) +
                                        blockIndex * 9;

                                    const isInCart =
                                        cartItemsByPosition.has(positionIndex);
                                    const isPlanted =
                                        plantedPositions.has(positionIndex);
                                    const isDragDisabled =
                                        isHudDialogOpen ||
                                        !isInCart ||
                                        isPlanted;

                                    return (
                                        <div
                                            key={`${row.id}-${column.id}`}
                                            className="size-full p-0.5"
                                        >
                                            <SortableFieldItem
                                                id={positionIndex.toString()}
                                                disabled={isDragDisabled}
                                                dropAnimationDisabled={
                                                    dropAnimationDisabled
                                                }
                                                showHandle={isInCart}
                                            >
                                                {({ isDragging }) => (
                                                    <div className="relative size-full">
                                                        <RaisedBedFieldItem
                                                            cartPlantItem={
                                                                cartItemsByPosition.get(
                                                                    positionIndex,
                                                                ) ?? null
                                                            }
                                                            gardenId={gardenId}
                                                            isCartPending={
                                                                isCartLoading
                                                            }
                                                            raisedBedId={
                                                                raisedBedId
                                                            }
                                                            showPlantHistoryBadges={
                                                                layerPreferences.showPlantHistoryBadges
                                                            }
                                                            positionIndex={
                                                                positionIndex
                                                            }
                                                            isDragging={
                                                                isDragging
                                                            }
                                                        />
                                                        {relationshipIndicatorsByPosition
                                                            .get(positionIndex)
                                                            ?.map(
                                                                (indicator) => (
                                                                    <RaisedBedFieldRelationshipIndicator
                                                                        key={`${indicator.positionIndex.toString()}-${indicator.neighborPositionIndex.toString()}-${indicator.status}-${indicator.showBadge ? 'badge' : 'connector'}`}
                                                                        indicator={
                                                                            indicator
                                                                        }
                                                                        showBadge={
                                                                            indicator.showBadge
                                                                        }
                                                                    />
                                                                ),
                                                            )}
                                                    </div>
                                                )}
                                            </SortableFieldItem>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    );
}
