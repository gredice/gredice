import { cx } from '@signalco/ui-primitives/cx';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useEffect } from 'react';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useAllSorts } from '../../hooks/usePlantSorts';
import { useSetShoppingCartItem } from '../../hooks/useSetShoppingCartItem';
import { useShoppingCart } from '../../hooks/useShoppingCart';
import { useSnapshotTime } from '../../hooks/useSnapshotTime';
import { ButtonGreen } from '../../shared-ui/ButtonGreen';
import {
    countRaisedBedOccupiedFields,
    findRaisedBedOccupiedField,
} from '../../utils/raisedBedFields';
import { RaisedBedCard } from './RaisedBedCard';

type QuickSeedType = 'spring' | 'summer' | 'fall' | 'winter' | 'salad';

const quickSeedOptions: Record<
    QuickSeedType,
    {
        label: string;
        emoji: string;
        layout: number[]; // Plant sort IDs (18 per raised bed: 2 blocks × 9 fields)
        type: 'seasonal' | 'standard';
    }
> = {
    spring: {
        label: 'Proljetni mix',
        emoji: '🌱',
        layout: [
            // Block 1
            209, // Rotkvica saxa 2
            215, // Rukola coltivata
            230, // Mrkva nantes
            222, // Cikla bikor
            349, // Blitva bright lights
            294, // Koraba delikates weiser
            435, // Kopar
            450, // Rotkvica Cherry Belle
            204, // Mrkva žuta Ljubljansko rumeno
            // Block 2
            207, // Blitva lisnata erbette
            427, // Repa Postrna repa Tonda
            458, // Bosiljak Bazilika
            441, // Vlasac Drobnjak Welta
            213, // Peršin lisnati
            221, // Mrkva flakkee
            456, // Origano
            296, // Repa namenia
            351, // Bosiljak italiano classico
        ],
        type: 'seasonal',
    },
    summer: {
        label: 'Ljetni mix',
        emoji: '☀️',
        layout: [
            // Block 1
            222, // Cikla bikor
            206, // Rajčica saint pierre
            349, // Blitva bright lights
            215, // Rukola coltivata
            294, // Koraba delikates weiser
            410, // Grah mahunar niski Sunray
            233, // Tikvica diamant F1
            209, // Rotkvica saxa 2
            450, // Rotkvica Cherry Belle
            // Block 2
            353, // Brokula gea F1
            292, // Matovilac verte de cambrai
            377, // Raštika lisnati kelj
            205, // Blitva srebrnolisna
            230, // Mrkva nantes
            438, // Ljupčac
            414, // Rotkvica crna zimska
            427, // Repa Postrna repa Tonda
            284, // Špinat matador
        ],
        type: 'seasonal',
    },
    fall: {
        label: 'Jesenski mix',
        emoji: '🍂',
        layout: [
            // Block 1
            372, // Češnjak Messidrome
            355, // Salata zimska nansen's noordpool
            284, // Špinat matador
            450, // Rotkvica Cherry Belle
            292, // Matovilac verte de cambrai
            215, // Rukola coltivata
            357, // Salata vegorka
            209, // Rotkvica saxa 2
            414, // Rotkvica crna zimska
            // Block 2
            228, // Salata puterica nansen
            234, // Endivija dječja glava
            284, // Špinat matador
            229, // Salata ljubljanska ledenka
            227, // Endivija eskariol žuta
            349, // Blitva bright lights
            235, // Salata puterica atrakcija
            292, // Matovilac verte de cambrai
            372, // Češnjak Messidrome
        ],
        type: 'seasonal',
    },
    winter: {
        label: 'Zimski mix',
        emoji: '❄️',
        layout: [
            // Block 1
            372, // Češnjak Messidrome
            284, // Špinat matador
            377, // Raštika lisnati kelj
            292, // Matovilac verte de cambrai
            355, // Salata zimska nansen's noordpool
            414, // Rotkvica crna zimska
            278, // Kelj vertus 2
            349, // Blitva bright lights
            284, // Špinat matador
            // Block 2
            372, // Češnjak Messidrome
            377, // Raštika lisnati kelj
            292, // Matovilac verte de cambrai
            284, // Špinat matador
            355, // Salata zimska nansen's noordpool
            278, // Kelj vertus 2
            349, // Blitva bright lights
            414, // Rotkvica crna zimska
            207, // Blitva lisnata erbette
        ],
        type: 'seasonal',
    },
    salad: {
        label: 'Salata mix',
        emoji: '🥗',
        layout: [
            // Block 1
            229, // Salata ljubljanska ledenka
            215, // Rukola coltivata
            209, // Rotkvica saxa 2
            234, // Endivija dječja glava
            228, // Salata puterica nansen
            227, // Endivija eskariol žuta
            357, // Salata vegorka
            355, // Salata zimska nansen's noordpool
            235, // Salata puterica atrakcija
            // Block 2
            292, // Matovilac verte de cambrai
            450, // Rotkvica Cherry Belle
            230, // Mrkva nantes
            276, // Komorač dragon F1
            221, // Mrkva flakkee
            204, // Mrkva žuta Ljubljansko rumeno
            213, // Peršin lisnati
            214, // Luk vlasac erba cipollina
            299, // Kupus kineski michihili
        ],
        type: 'standard',
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
    const { data: allSorts, isLoading: isLoadingSorts } = useAllSorts();
    const setCartItem = useSetShoppingCartItem();
    const season = getSeasonForDate(useSnapshotTime());
    const hasRequiredData = Boolean(currentGarden && raisedBed && shoppingCart);
    const isRaisedBedValid = raisedBed?.isValid ?? false;

    // Check if there are already 18 plants in the cart or planted for this raised bed (2 blocks × 9 fields)
    const cartItems =
        shoppingCart?.items.filter(
            (item) => item.raisedBedId === raisedBedId,
        ) ?? [];
    const cartPlantItems = cartItems.filter(
        (item) => item.entityTypeName === 'plantSort' && item.status === 'new',
    );
    const plantedFieldsCount = raisedBed
        ? countRaisedBedOccupiedFields(raisedBed.fields)
        : 0;
    const cartPlantItemsCount = cartPlantItems.length;
    const isRaisedBedFull =
        isRaisedBedValid && plantedFieldsCount + cartPlantItemsCount >= 18;

    useEffect(() => {
        if (!hasRequiredData || !isRaisedBedValid || !isRaisedBedFull) return;

        console.debug('Skipping planting suggestions: raised bed is full', {
            raisedBedId,
            plantedFieldsCount,
            cartPlantItemsCount,
        });
    }, [
        cartPlantItemsCount,
        hasRequiredData,
        isRaisedBedFull,
        isRaisedBedValid,
        plantedFieldsCount,
        raisedBedId,
    ]);

    if (!hasRequiredData || !isRaisedBedValid) return null;

    if (isRaisedBedFull) return null;

    // Get seasonal option and standard options
    const seasonalOption = quickSeedOptions[season];
    const standardOptions = Object.entries(quickSeedOptions).filter(
        ([_, option]) => option.type === 'standard',
    );

    if (!seasonalOption && standardOptions.length === 0) return null;

    async function handleQuickPick(type: QuickSeedType) {
        const layout = quickSeedOptions[type]?.layout;
        if (!layout || !allSorts) return;
        await Promise.all(
            Array.from({ length: 18 }).map(async (_, index) => {
                if (!raisedBed || !shoppingCart) return;

                const sortId = layout[index];
                if (!sortId) return;

                // If not in store, ignore
                const sort = allSorts.find((item) => item.id === sortId);
                if (!sort?.store?.availableInStore) return;

                if (findRaisedBedOccupiedField(raisedBed.fields, index)) return;
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

                if (sortId == null) return;
                return setCartItem.mutateAsync({
                    entityTypeName: 'plantSort',
                    entityId: sortId.toString(),
                    amount: 1,
                    gardenId,
                    raisedBedId,
                    positionIndex: index,
                });
            }),
        );
    }

    return (
        <RaisedBedCard className="flex items-center w-fit md:w-auto md:self-stretch flex-col gap-1 px-2 rounded-full py-2 md:gap-2 md:px-2 md:pb-4 md:pt-3">
            <Typography
                level="body2"
                className="dark:text-primary-foreground hidden md:block"
                noWrap
            >
                Brzo sijanje
            </Typography>
            <div className="flex flex-col gap-2">
                {/* Seasonal option */}
                {seasonalOption && (
                    <ButtonGreen
                        variant="plain"
                        className={cx(
                            'md:size-auto bg-black/80 dark:bg-white/10 hover:bg-black/50',
                            'rounded-full size-10 left-[calc(50%+118px)]',
                        )}
                        startDecorator={
                            <span className="text-xl">
                                {seasonalOption.emoji}
                            </span>
                        }
                        onClick={() => handleQuickPick(season)}
                        loading={
                            setCartItem.isPending ||
                            isLoadingShoppingCart ||
                            isLoadingSorts
                        }
                    >
                        <span className="hidden md:block">
                            {seasonalOption.label}
                        </span>
                    </ButtonGreen>
                )}

                {/* Standard options */}
                {standardOptions.map(([type, option]) => (
                    <ButtonGreen
                        key={type}
                        variant="plain"
                        className={cx(
                            'md:size-auto bg-black/80 dark:bg-white/10 hover:bg-black/50',
                            'rounded-full size-10 left-[calc(50%+118px)]',
                        )}
                        startDecorator={
                            <span className="text-xl">{option.emoji}</span>
                        }
                        onClick={() => handleQuickPick(type as QuickSeedType)}
                        loading={
                            setCartItem.isPending ||
                            isLoadingShoppingCart ||
                            isLoadingSorts
                        }
                    >
                        <span className="hidden md:block">{option.label}</span>
                    </ButtonGreen>
                ))}
            </div>
        </RaisedBedCard>
    );
}
