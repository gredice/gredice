import { Button } from '@gredice/ui/Button';
import { Check, Discount, Navigate } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useEffect, useMemo, useState } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import type { OutletOfferData } from '../hooks/useOutletOffers';
import { useOutletOffers } from '../hooks/useOutletOffers';
import { useShoppingCart } from '../hooks/useShoppingCart';
import { GameModal } from '../shared-ui/game-modal';
import { useSetRaisedBedCloseupParam } from '../useRaisedBedCloseup';
import {
    useOutletOfferSelectionParam,
    useOutletOpenParam,
} from '../useUrlState';
import { HudCard } from './components/HudCard';
import {
    type EmptyRaisedBedFieldTarget,
    findEmptyRaisedBedFieldTargets,
    waitForPlantPickerTrigger,
} from './raisedBed/plantPickerNavigation';

const currencyFormatter = new Intl.NumberFormat('hr-HR', {
    style: 'currency',
    currency: 'EUR',
});

const dateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'short',
});

function offerImageUrl(offer: {
    imageUrls: string[];
    plantSort: { imageUrl: string | null };
}) {
    return offer.imageUrls[0] ?? offer.plantSort.imageUrl;
}

export function OutletHud() {
    const { data: offers, isLoading, isError } = useOutletOffers();
    const { data: currentGarden } = useCurrentGarden();
    const { data: cart } = useShoppingCart();
    const [outletParam, setOutletParam] = useOutletOpenParam();
    const [, setOutletOfferSelectionParam] = useOutletOfferSelectionParam();
    const { mutate: setRaisedBedCloseupParam } = useSetRaisedBedCloseupParam();
    const { track } = useGameAnalytics();
    const [pendingOfferId, setPendingOfferId] = useState<number | null>(null);
    const [selectedRaisedBedId, setSelectedRaisedBedId] = useState<
        number | null
    >(null);
    const [isOfferListExpanded, setIsOfferListExpanded] = useState(false);
    const isOpen = outletParam !== null;
    const highlightedOfferId =
        outletParam && outletParam !== '1'
            ? Number.parseInt(outletParam, 10)
            : null;
    const selectedOffer =
        offers?.find((offer) => offer.id === highlightedOfferId) ?? null;
    const selectedOfferId = selectedOffer?.id ?? null;
    const emptyFieldTargets = useMemo(
        () =>
            findEmptyRaisedBedFieldTargets(currentGarden, cart?.items, {
                includeNotYetActiveRaisedBeds: true,
            }),
        [cart?.items, currentGarden],
    );
    const selectedFieldTarget =
        emptyFieldTargets.find(
            (target) => target.raisedBedId === selectedRaisedBedId,
        ) ??
        emptyFieldTargets[0] ??
        null;

    useEffect(() => {
        if (!isOpen) {
            setIsOfferListExpanded(false);
            return;
        }

        setIsOfferListExpanded(selectedOfferId === null);
    }, [isOpen, selectedOfferId]);

    async function handleStartPlanting(
        offer: OutletOfferData,
        fieldTarget: EmptyRaisedBedFieldTarget | null,
    ) {
        if (!fieldTarget || pendingOfferId !== null) {
            return;
        }

        setPendingOfferId(offer.id);
        track('game_outlet_offer_planting_started', {
            garden_id: currentGarden?.id,
            outlet_offer_id: offer.id,
            plant_sort_id: offer.plantSort.id,
            position_index: fieldTarget.positionIndex,
            raised_bed_id: fieldTarget.raisedBedId,
        });

        try {
            await setOutletOfferSelectionParam(offer.id);
            await setOutletParam(null);
            await Promise.resolve(
                setRaisedBedCloseupParam(
                    fieldTarget.raisedBedName,
                    fieldTarget.positionIndex,
                ),
            );
            const trigger = await waitForPlantPickerTrigger(fieldTarget);
            trigger?.click();
        } finally {
            setPendingOfferId(null);
        }
    }

    if (!isLoading && !offers?.length && !isOpen) {
        return null;
    }

    return (
        <HudCard open position="floating" className="static p-0.5">
            <GameModal
                open={isOpen}
                onOpenChange={(open) => {
                    setOutletParam(open ? '1' : null);
                    if (open) {
                        track('game_outlet_opened', {
                            outlet_offer_count: offers?.length ?? 0,
                        });
                    }
                }}
                title="Outlet sadnica"
                className="md:max-w-2xl"
                headerIcon={<Discount className="size-7 shrink-0" />}
                hudLayer
                trigger={
                    <Button
                        title="Outlet sadnica"
                        variant="plain"
                        className="relative rounded-full p-2 gap-2"
                    >
                        <Discount className="size-6 shrink-0" />
                        <Typography
                            level="body2"
                            semiBold
                            className="text-foreground"
                        >
                            Outlet
                        </Typography>
                    </Button>
                }
            >
                <Stack spacing={4}>
                    <Typography level="body2" secondary>
                        Odaberi outlet sadnicu, gredicu i nastavi na prvo prazno
                        polje.
                    </Typography>
                    {isLoading ? (
                        <Typography level="body2">Učitavanje...</Typography>
                    ) : null}
                    {isError ? (
                        <Typography level="body2">
                            Greška prilikom učitavanja outlet ponuda.
                        </Typography>
                    ) : null}
                    {!isLoading && !isError && !offers?.length ? (
                        <Typography level="body2" secondary>
                            Trenutno nema aktivnih outlet ponuda.
                        </Typography>
                    ) : null}
                    {selectedOffer && !isOfferListExpanded ? (
                        <Stack spacing={2}>
                            {(() => {
                                const imageUrl = offerImageUrl(selectedOffer);

                                return (
                                    <div
                                        data-outlet-selected-offer
                                        className={cx(
                                            'grid grid-cols-[72px_1fr] gap-3 rounded-lg border bg-card p-2 text-left transition-colors hover:bg-muted',
                                            'border-green-500',
                                        )}
                                    >
                                        <div className="aspect-square overflow-hidden rounded-md bg-muted">
                                            {imageUrl ? (
                                                <>
                                                    {/** biome-ignore lint/performance/noImgElement: Offer images come from API data and may use configured external origins. */}
                                                    <img
                                                        alt={
                                                            selectedOffer
                                                                .plantSort.name
                                                        }
                                                        className="h-full w-full object-cover"
                                                        src={imageUrl}
                                                    />
                                                </>
                                            ) : null}
                                        </div>
                                        <Stack spacing={1}>
                                            <Row justifyContent="space-between">
                                                <Typography
                                                    level="body1"
                                                    semiBold
                                                >
                                                    {
                                                        selectedOffer.plantSort
                                                            .name
                                                    }
                                                </Typography>
                                                <Typography level="body1" bold>
                                                    {currencyFormatter.format(
                                                        selectedOffer.outletPrice,
                                                    )}
                                                </Typography>
                                            </Row>
                                            <Typography level="body3" secondary>
                                                Sjetva{' '}
                                                {dateFormatter.format(
                                                    new Date(
                                                        selectedOffer.sowingDate,
                                                    ),
                                                )}{' '}
                                                · preostalo{' '}
                                                {
                                                    selectedOffer.remainingQuantity
                                                }{' '}
                                                · do{' '}
                                                {dateFormatter.format(
                                                    new Date(
                                                        selectedOffer.endAt,
                                                    ),
                                                )}
                                            </Typography>
                                        </Stack>
                                    </div>
                                );
                            })()}
                            {(offers?.length ?? 0) > 1 ? (
                                <Row justifyContent="end">
                                    <Button
                                        variant="plain"
                                        onClick={() =>
                                            setIsOfferListExpanded(true)
                                        }
                                    >
                                        Promijeni sadnicu
                                    </Button>
                                </Row>
                            ) : null}
                        </Stack>
                    ) : (
                        <div className="grid gap-3" data-outlet-offer-list>
                            {offers?.map((offer) => {
                                const imageUrl = offerImageUrl(offer);
                                const highlighted =
                                    selectedOffer?.id === offer.id;

                                return (
                                    <button
                                        aria-pressed={highlighted}
                                        key={offer.id}
                                        type="button"
                                        className={cx(
                                            'grid grid-cols-[72px_1fr] gap-3 rounded-lg border bg-card p-2 text-left transition-colors hover:bg-muted',
                                            highlighted
                                                ? 'border-green-500'
                                                : 'border-tertiary',
                                        )}
                                        onClick={() => {
                                            setOutletParam(offer.id.toString());
                                            setIsOfferListExpanded(false);
                                            track('game_outlet_offer_viewed', {
                                                outlet_offer_id: offer.id,
                                                plant_sort_id:
                                                    offer.plantSort.id,
                                            });
                                        }}
                                    >
                                        <div className="aspect-square overflow-hidden rounded-md bg-muted">
                                            {imageUrl ? (
                                                <>
                                                    {/** biome-ignore lint/performance/noImgElement: Offer images come from API data and may use configured external origins. */}
                                                    <img
                                                        alt={
                                                            offer.plantSort.name
                                                        }
                                                        className="h-full w-full object-cover"
                                                        src={imageUrl}
                                                    />
                                                </>
                                            ) : null}
                                        </div>
                                        <Stack spacing={1}>
                                            <Row justifyContent="space-between">
                                                <Typography
                                                    level="body1"
                                                    semiBold
                                                >
                                                    {offer.plantSort.name}
                                                </Typography>
                                                <Typography level="body1" bold>
                                                    {currencyFormatter.format(
                                                        offer.outletPrice,
                                                    )}
                                                </Typography>
                                            </Row>
                                            <Typography level="body3" secondary>
                                                Sjetva{' '}
                                                {dateFormatter.format(
                                                    new Date(offer.sowingDate),
                                                )}{' '}
                                                · preostalo{' '}
                                                {offer.remainingQuantity} · do{' '}
                                                {dateFormatter.format(
                                                    new Date(offer.endAt),
                                                )}
                                            </Typography>
                                        </Stack>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {selectedOffer && !isOfferListExpanded ? (
                        <Stack spacing={3}>
                            {emptyFieldTargets.length > 0 ? (
                                <Stack
                                    spacing={2}
                                    data-outlet-raised-bed-picker
                                >
                                    <Typography level="body2" semiBold>
                                        Gredica
                                    </Typography>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {emptyFieldTargets.map((target) => {
                                            const selected =
                                                target.raisedBedId ===
                                                selectedFieldTarget?.raisedBedId;

                                            return (
                                                <button
                                                    aria-pressed={selected}
                                                    data-outlet-raised-bed-option
                                                    key={target.raisedBedId}
                                                    type="button"
                                                    className={cx(
                                                        'rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700',
                                                        selected
                                                            ? 'border-green-500'
                                                            : 'border-tertiary',
                                                    )}
                                                    onClick={() => {
                                                        setSelectedRaisedBedId(
                                                            target.raisedBedId,
                                                        );
                                                        track(
                                                            'game_outlet_raised_bed_selected',
                                                            {
                                                                garden_id:
                                                                    currentGarden?.id,
                                                                outlet_offer_id:
                                                                    selectedOffer.id,
                                                                position_index:
                                                                    target.positionIndex,
                                                                raised_bed_id:
                                                                    target.raisedBedId,
                                                            },
                                                        );
                                                    }}
                                                >
                                                    <Row
                                                        justifyContent="space-between"
                                                        className="min-w-0"
                                                    >
                                                        <Typography
                                                            level="body2"
                                                            semiBold
                                                            className="min-w-0"
                                                        >
                                                            {
                                                                target.raisedBedName
                                                            }
                                                        </Typography>
                                                        {selected ? (
                                                            <Check className="size-4 shrink-0 text-green-600" />
                                                        ) : null}
                                                    </Row>
                                                    <Typography
                                                        level="body3"
                                                        secondary
                                                    >
                                                        Prvo prazno polje{' '}
                                                        {target.positionIndex +
                                                            1}
                                                    </Typography>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </Stack>
                            ) : (
                                <Typography level="body2" secondary>
                                    Za outlet sadnicu treba prazno polje u
                                    dostupnoj gredici.
                                </Typography>
                            )}
                            <Row justifyContent="end">
                                <Button
                                    disabled={!selectedFieldTarget}
                                    loading={
                                        pendingOfferId === selectedOffer.id
                                    }
                                    onClick={() =>
                                        void handleStartPlanting(
                                            selectedOffer,
                                            selectedFieldTarget,
                                        )
                                    }
                                    startDecorator={
                                        <Navigate className="size-5 shrink-0" />
                                    }
                                >
                                    Nastavi na sijanje
                                </Button>
                            </Row>
                        </Stack>
                    ) : null}
                </Stack>
            </GameModal>
        </HudCard>
    );
}
