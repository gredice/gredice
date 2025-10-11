import { cx } from '@signalco/ui-primitives/cx';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useCallback, useMemo } from 'react';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useAllSorts } from '../../hooks/usePlantSorts';
import { useSetShoppingCartItem } from '../../hooks/useSetShoppingCartItem';
import { useShoppingCart } from '../../hooks/useShoppingCart';
import { ButtonGreen } from '../../shared-ui/ButtonGreen';
import { RaisedBedCard } from './RaisedBedCard';

export function RaisedBedFieldSuggestions({
    gardenId,
    raisedBedId,
}: {
    gardenId: number;
    raisedBedId: number;
}) {
    const { data: currentGarden } = useCurrentGarden();
    const raisedBed = currentGarden?.raisedBeds.find(
        (bed) => bed.id === raisedBedId,
    );
    const { data: shoppingCart, isLoading: isLoadingShoppingCart } =
        useShoppingCart();
    const { data: allSorts, isLoading: isLoadingSorts } = useAllSorts();
    const setCartItem = useSetShoppingCartItem();
    const quickPickLayouts = useMemo(
        () => ({
            summer: [222, 227, 279, 223, 294, 230, 223, 215, 230],
            salad: [282, 229, 209, 299, 234, 221, 281, 215, 204],
        }),
        [],
    );
    const isQuickPickLoading =
        setCartItem.isPending || isLoadingShoppingCart || isLoadingSorts;
    if (!currentGarden || !raisedBed || !shoppingCart) return null;

    // Only show suggestions if the raised bed is valid
    if (!raisedBed.isValid) return null;

    // Check if there are already 9 plants in the cart or planted for this raised bed
    const cartItems = shoppingCart?.items.filter(
        (item) => item.raisedBedId === raisedBedId,
    );
    const cartPlantItems = cartItems?.filter(
        (item) => item.entityTypeName === 'plantSort' && item.status === 'new',
    );
    if (raisedBed.fields.length + (cartPlantItems?.length ?? 0) >= 9)
        return null;

    const handleQuickPick = useCallback(
        async (type: 'summer' | 'salad') => {
            if (!allSorts || !raisedBed || !shoppingCart || isQuickPickLoading)
                return;

            const layout = quickPickLayouts[type];

            for (const [index, sortId] of layout.entries()) {
                const isFieldOccupied = raisedBed.fields.some(
                    (field) => field.positionIndex === index && field.active,
                );
                if (isFieldOccupied) continue;

                const pendingCartItem = shoppingCart.items.find(
                    (item) =>
                        item.raisedBedId === raisedBedId &&
                        item.positionIndex === index &&
                        item.entityTypeName === 'plantSort' &&
                        item.status === 'new',
                );
                if (pendingCartItem) continue;

                const sort = allSorts.find((item) => item.id === sortId);
                const isAvailableInStore =
                    sort?.store?.availableInStore ??
                    sort?.information.plant.store?.availableInStore ??
                    false;

                if (!isAvailableInStore) continue;

                await setCartItem.mutateAsync({
                    entityTypeName: 'plantSort',
                    entityId: sortId.toString(),
                    amount: 1,
                    gardenId,
                    raisedBedId,
                    positionIndex: index,
                });
            }
        },
        [
            allSorts,
            gardenId,
            isQuickPickLoading,
            quickPickLayouts,
            raisedBed,
            raisedBedId,
            setCartItem,
            shoppingCart,
        ],
    );

    return (
        <RaisedBedCard className="flex items-center flex-col gap-1 px-4 py-2 md:gap-2 md:px-4 md:pb-4 md:pt-3">
            <Typography
                level="body1"
                bold
                className="dark:text-primary-foreground"
                noWrap
            >
                Brzo sijanje
            </Typography>
            <div className="flex flex-row md:flex-col gap-2">
                <ButtonGreen
                    variant="plain"
                    className={cx(
                        'md:size-auto bg-black/80 dark:bg-white/10 hover:bg-black/50',
                        'rounded-full size-10 left-[calc(50%+118px)]',
                    )}
                    startDecorator={<span className="text-xl">☀️</span>}
                    onClick={() => handleQuickPick('summer')}
                    loading={isQuickPickLoading}
                >
                    <span className="hidden md:block">Ljetni mix</span>
                </ButtonGreen>
                <ButtonGreen
                    variant="plain"
                    className={cx(
                        'md:size-auto bg-black/80 dark:bg-white/10 hover:bg-black/50',
                        'rounded-full size-10 left-[calc(50%+118px)]',
                    )}
                    startDecorator={<span className="text-xl">🥬</span>}
                    onClick={() => handleQuickPick('salad')}
                    loading={isQuickPickLoading}
                >
                    <span className="hidden md:block">Salatni mix</span>
                </ButtonGreen>
            </div>
        </RaisedBedCard>
    );
}
