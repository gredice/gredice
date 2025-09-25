import { cx } from '@signalco/ui-primitives/cx';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useSetShoppingCartItem } from '../../hooks/useSetShoppingCartItem';
import { useShoppingCart } from '../../hooks/useShoppingCart';
import { ButtonGreen } from '../../shared-ui/ButtonGreen';
import { useGameState } from '../../useGameState';
import { RaisedBedCard } from './RaisedBedCard';

type QuickSeedType = 'spring' | 'summer' | 'fall' | 'winter';

const quickSeedOptions: Record<
    QuickSeedType,
    { label: string; emoji: string; layout: number[] }
> = {
    spring: {
        label: 'Proljetni mix',
        emoji: '🌱',
        layout: [282, 229, 209, 299, 234, 221, 281, 215, 204],
    },
    summer: {
        label: 'Ljetni mix',
        emoji: '☀️',
        layout: [222, 227, 279, 223, 294, 230, 223, 215, 230],
    },
    fall: {
        label: 'Jesenski mix',
        emoji: '🍂',
        layout: [223, 215, 204, 279, 227, 281, 209, 221, 230],
    },
    winter: {
        label: 'Zimski mix',
        emoji: '❄️',
        layout: [299, 229, 209, 221, 282, 215, 204, 222, 223],
    },
};

function getSeasonForDate(date: Date | null): QuickSeedType {
    if (!date || Number.isNaN(date.getTime())) {
        return 'spring';
    }

    const year = date.getUTCFullYear();
    const day = Date.UTC(year, date.getUTCMonth(), date.getUTCDate());

    const springStart = Date.UTC(year, 2, 20);
    if (day < springStart) {
        return 'winter';
    }

    const summerStart = Date.UTC(year, 5, 21);
    if (day < summerStart) {
        return 'spring';
    }

    const fallStart = Date.UTC(year, 8, 22);
    if (day < fallStart) {
        return 'summer';
    }

    const winterStart = Date.UTC(year, 11, 21);
    if (day < winterStart) {
        return 'fall';
    }

    return 'winter';
}

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
    const setCartItem = useSetShoppingCartItem();
    const currentTime = useGameState((state) => state.currentTime);
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

    const season = getSeasonForDate(currentTime);
    const quickSeed = quickSeedOptions[season];

    if (!quickSeed) return null;

    async function handleQuickPick(type: QuickSeedType) {
        const layout = quickSeedOptions[type]?.layout;
        if (!layout) return;
        await Promise.all(
            Array.from({ length: 9 }).map(async (_, index) => {
                if (!raisedBed || !shoppingCart) return;
                if (
                    raisedBed.fields.find(
                        (field) =>
                            field.positionIndex === index && field.active,
                    )
                )
                    return;
                if (
                    shoppingCart.items.find(
                        (item) =>
                            item.raisedBedId === raisedBedId &&
                            item.positionIndex === index &&
                            item.entityTypeName === 'plantSort' &&
                            item.status === 'new',
                    )
                )
                    return;
                const plantSortId = layout[index];
                if (plantSortId == null) return;
                return setCartItem.mutateAsync({
                    entityTypeName: 'plantSort',
                    entityId: plantSortId.toString(),
                    amount: 1,
                    gardenId,
                    raisedBedId,
                    positionIndex: index,
                });
            }),
        );
    }

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
                    startDecorator={
                        <span className="text-xl">{quickSeed.emoji}</span>
                    }
                    onClick={() => handleQuickPick(season)}
                    loading={setCartItem.isPending || isLoadingShoppingCart}
                >
                    <span className="hidden md:block">{quickSeed.label}</span>
                </ButtonGreen>
            </div>
        </RaisedBedCard>
    );
}
