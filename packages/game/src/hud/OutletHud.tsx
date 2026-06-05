import { Button } from '@gredice/ui/Button';
import { Discount } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { useOutletOffers } from '../hooks/useOutletOffers';
import { useOutletOpenParam } from '../useUrlState';
import { HudCard } from './components/HudCard';

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
    const [outletParam, setOutletParam] = useOutletOpenParam();
    const { track } = useGameAnalytics();
    const isOpen = outletParam !== null;
    const highlightedOfferId =
        outletParam && outletParam !== '1'
            ? Number.parseInt(outletParam, 10)
            : null;

    if (!isLoading && !offers?.length && !isOpen) {
        return null;
    }

    return (
        <HudCard open position="floating" className="static p-0.5">
            <Modal
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
                className="z-[46] border-tertiary border-b-4 md:max-w-2xl"
                overlayClassName="z-[46]"
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
                        Odaberi prazno polje u gredici i u popisu sorti uključi
                        Outlet cijenu za dostupnu presadnicu.
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
                            const highlighted = highlightedOfferId === offer.id;

                            return (
                                <button
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
                </Stack>
            </Modal>
        </HudCard>
    );
}
