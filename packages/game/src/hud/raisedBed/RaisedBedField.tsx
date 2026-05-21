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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameAnalytics } from '../../analytics/GameAnalyticsContext';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import {
    type ShoppingCartItemData,
    useShoppingCart,
} from '../../hooks/useShoppingCart';
import { useSwapShoppingCartPositions } from '../../hooks/useSwapShoppingCartPositions';
import { getRaisedBedBlockIds } from '../../utils/raisedBedBlocks';
import { isRaisedBedFieldOccupied } from '../../utils/raisedBedFields';
import { getPositionIndexFromGrid } from '../../utils/raisedBedOrientation';
import { RaisedBedFieldInvalidShape } from './RaisedBedFieldInvalidShape';
import { RaisedBedFieldItem } from './RaisedBedFieldItem';
import { SortableFieldItem } from './SortableFieldItem';

type PendingFieldMove = {
    fromPositionIndex: number;
    itemA: ShoppingCartItemData;
    itemB?: ShoppingCartItemData;
    sequence: number;
    toPositionIndex: number;
};

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

export function RaisedBedField({
    gardenId,
    raisedBedId,
}: {
    gardenId: number;
    raisedBedId: number;
}) {
    const { data: garden } = useCurrentGarden();
    const { data: cart, isLoading: isCartLoading } = useShoppingCart();
    const { track } = useGameAnalytics();
    const swapPositions = useSwapShoppingCartPositions();
    const [pendingMove, setPendingMove] = useState<PendingFieldMove | null>(
        null,
    );
    const moveSequenceRef = useRef(0);
    const [dropAnimationDisabled, setDropAnimationDisabled] = useState(false);
    const [isHudDialogOpen, setIsHudDialogOpen] = useState(false);
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);

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
        <>
            <div></div>
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
                                                        positionIndex={
                                                            positionIndex
                                                        }
                                                        isDragging={isDragging}
                                                    />
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
        </>
    );
}
