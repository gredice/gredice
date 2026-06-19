import { useEffect, useMemo } from 'react';
import { useGardenOperations } from '../../../hooks/useGardenOperations';
import {
    type ShoppingCartItemData,
    useShoppingCart,
} from '../../../hooks/useShoppingCart';

type OperationContextTarget = {
    gardenId: number;
    raisedBedId?: number;
    positionIndex?: number;
};

function isOperationInCurrentContext(
    {
        entityTypeName,
        status,
        gardenId: itemGardenId,
        raisedBedId: itemRaisedBedId,
        positionIndex: itemPositionIndex,
    }: ShoppingCartItemData,
    { gardenId, raisedBedId, positionIndex }: OperationContextTarget,
) {
    return (
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
}: OperationContextTarget) {
    const { data: cart } = useShoppingCart();
    const scheduledOperations = useGardenOperations({
        includeCompleted: true,
        pageSize: 50,
        raisedBedId,
        positionIndex,
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
                        }),
                    )
                    .map((item) => Number(item.entityId)),
            ),
        [cart?.items, gardenId, raisedBedId, positionIndex],
    );

    const scheduledOperationIds = useMemo(
        () =>
            new Set(
                (scheduledOperationPages ?? []).flatMap((page) =>
                    page.items.flatMap((operation) =>
                        operation.entityTypeName === 'operation'
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
