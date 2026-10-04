import { readSelectedPlantingOperationTarget } from '@gredice/js/plants';
import { useEffect, useMemo } from 'react';
import {
    type GardenOperationItem,
    useGardenOperations,
} from '../../../hooks/useGardenOperations';
import {
    type ShoppingCartItemData,
    useShoppingCart,
} from '../../../hooks/useShoppingCart';

type OperationContextTarget = {
    gardenId: number;
    raisedBedId?: number;
    positionIndex?: number;
    plantingId?: number;
};

const scheduledOperationStatuses = new Set<GardenOperationItem['status']>([
    'new',
    'planned',
    'assigned',
    'confirmed',
]);

function isOperationInCurrentContext(
    {
        entityTypeName,
        status,
        gardenId: itemGardenId,
        raisedBedId: itemRaisedBedId,
        positionIndex: itemPositionIndex,
        additionalData,
    }: ShoppingCartItemData,
    {
        gardenId,
        raisedBedId,
        positionIndex,
        plantingId,
    }: OperationContextTarget,
) {
    let selectedPlantingId: number | undefined;
    try {
        selectedPlantingId =
            readSelectedPlantingOperationTarget(additionalData)?.plantingId;
    } catch {
        return false;
    }
    return (
        selectedPlantingId === plantingId &&
        entityTypeName === 'operation' &&
        status === 'new' &&
        itemGardenId === gardenId &&
        (itemRaisedBedId ?? undefined) === raisedBedId &&
        (itemPositionIndex ?? undefined) === positionIndex
    );
}

export function useOperationContextIndicators({
    gardenId,
    raisedBedId,
    positionIndex,
    plantingId,
}: OperationContextTarget) {
    const { data: cart } = useShoppingCart();
    const scheduledOperations = useGardenOperations({
        includeCompleted: true,
        raisedBedId,
        positionIndex,
        plantingId,
    });
    const scheduledOperationPages = scheduledOperations.data?.pages;

    useEffect(() => {
        if (
            scheduledOperations.hasNextPage &&
            !scheduledOperations.isFetchingNextPage
        ) {
            scheduledOperations.fetchNextPage();
        }
    }, [
        scheduledOperations.fetchNextPage,
        scheduledOperations.hasNextPage,
        scheduledOperations.isFetchingNextPage,
    ]);

    const shoppingCartOperationIds = useMemo(
        () =>
            new Set(
                (cart?.items ?? [])
                    .filter((item) =>
                        isOperationInCurrentContext(item, {
                            gardenId,
                            raisedBedId,
                            positionIndex,
                            plantingId,
                        }),
                    )
                    .map((item) => Number(item.entityId)),
            ),
        [cart?.items, gardenId, raisedBedId, positionIndex, plantingId],
    );

    const scheduledOperationIds = useMemo(
        () =>
            new Set(
                (scheduledOperationPages ?? []).flatMap((page) =>
                    page.items.flatMap((operation) =>
                        operation.entityTypeName === 'operation' &&
                        scheduledOperationStatuses.has(operation.status)
                            ? [operation.entityId]
                            : [],
                    ),
                ),
            ),
        [scheduledOperationPages],
    );

    return {
        shoppingCartOperationIds,
        scheduledOperationIds,
    };
}
