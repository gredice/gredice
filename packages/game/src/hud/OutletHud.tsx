import { Button } from '@gredice/ui/Button';
import { Discount, Navigate } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useState } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import type { OutletOfferData } from '../hooks/useOutletOffers';
import { useOutletOffers } from '../hooks/useOutletOffers';
import { GameModal } from '../shared-ui/game-modal';
import { useSetRaisedBedCloseupParam } from '../useRaisedBedCloseup';
import {
    useOutletOfferSelectionParam,
    useOutletOpenParam,
} from '../useUrlState';
import { HudCard } from './components/HudCard';
import {
    findFirstEmptyRaisedBedField,
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
    const [outletParam, setOutletParam] = useOutletOpenParam();
    const [, setOutletOfferSelectionParam] = useOutletOfferSelectionParam();
    const { mutate: setRaisedBedCloseupParam } = useSetRaisedBedCloseupParam();
    const { track } = useGameAnalytics();
    const [pendingOfferId, setPendingOfferId] = useState<number | null>(null);
    const isOpen = outletParam !== null;
    const highlightedOfferId =
        outletParam && outletParam !== '1'
            ? Number.parseInt(outletParam, 10)
            : null;
    const selectedOffer =
        offers?.find((offer) => offer.id === highlightedOfferId) ??
        offers?.[0] ??
        null;
    const emptyFieldTarget = findFirstEmptyRaisedBedField(currentGarden);

    async function handleStartPlanting(offer: OutletOfferData) {
        if (!emptyFieldTarget || pendingOfferId !== null) {
            return;
        }

        setPendingOfferId(offer.id);
        track('game_outlet_offer_planting_started', {
            garden_id: currentGarden?.id,
            outlet_offer_id: offer.id,
            plant_sort_id: offer.plantSort.id,
            position_index: emptyFieldTarget.positionIndex,
            raised_bed_id: emptyFieldTarget.raisedBedId,
        });

        try {
            await setOutletOfferSelectionParam(offer.id);
            await setOutletParam(null);
            await Promise.resolve(
                setRaisedBedCloseupParam(
                    emptyFieldTarget.raisedBedName,
                    emptyFieldTarget.positionIndex,
                ),
            );
            const trigger = await waitForPlantPickerTrigger(emptyFieldTarget);
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
                        Odaberi outlet sadnicu i nastavi na prvo prazno polje u
                        aktivnoj gredici.
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
                    <div className="grid gap-3">
                        {offers?.map((offer) => {
                            const imageUrl = offerImageUrl(offer);
                            const highlighted = selectedOffer?.id === offer.id;

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
                                        track('game_outlet_offer_viewed', {
                                            outlet_offer_id: offer.id,
                                            plant_sort_id: offer.plantSort.id,
                                        });
                                    }}
                                >
                                    <div className="aspect-square overflow-hidden rounded-md bg-muted">
                                        {imageUrl ? (
                                            <>
                                                {/** biome-ignore lint/performance/noImgElement: Offer images come from API data and may use configured external origins. */}
                                                <img
                                                    alt={offer.plantSort.name}
                                                    className="h-full w-full object-cover"
                                                    src={imageUrl}
                                                />
                                            </>
                                        ) : null}
                                    </div>
                                    <Stack spacing={1}>
                                        <Row justifyContent="space-between">
                                            <Typography level="body1" semiBold>
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
                    {selectedOffer ? (
                        <Stack spacing={2}>
                            {!emptyFieldTarget ? (
                                <Typography level="body2" secondary>
                                    Za outlet sadnicu treba prazno polje u
                                    aktivnoj gredici.
                                </Typography>
                            ) : null}
                            <Row justifyContent="end">
                                <Button
                                    disabled={!emptyFieldTarget}
                                    loading={
                                        pendingOfferId === selectedOffer.id
                                    }
                                    onClick={() =>
                                        void handleStartPlanting(selectedOffer)
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
