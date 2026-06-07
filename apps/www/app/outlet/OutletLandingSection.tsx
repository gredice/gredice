import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { KnownPages } from '../../src/KnownPages';
import { getOutletOffers, outletOfferImage } from './outletData';

const currencyFormatter = new Intl.NumberFormat('hr-HR', {
    style: 'currency',
    currency: 'EUR',
});

export async function OutletLandingSection() {
    const offers = await getOutletOffers();
    const highlightedOffers = offers.slice(0, 3);
    if (highlightedOffers.length === 0) {
        return null;
    }

    return (
        <section className="my-20 border-y border-tertiary bg-card/60 py-10">
            <Stack spacing={6}>
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <Stack spacing={2} className="max-w-2xl">
                        <Typography level="body1" semiBold tertiary>
                            Gredice Outlet
                        </Typography>
                        <Typography level="h2">
                            Presadnice iz staklenika
                        </Typography>
                        <Typography level="body1" secondary>
                            Ograničene količine presadnica koje su već krenule u
                            rast, dostupne po nižoj cijeni dok traje ponuda.
                        </Typography>
                    </Stack>
                    <NavigatingButton
                        href={KnownPages.Outlet}
                        variant="outlined"
                        className="w-fit"
                    >
                        Pogledaj outlet
                    </NavigatingButton>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                    {highlightedOffers.map((offer) => {
                        const imageUrl = outletOfferImage(offer);
                        return (
                            <a
                                key={offer.id}
                                href={`${KnownPages.Outlet}?offer=${offer.id}`}
                                className="group overflow-hidden rounded-lg border border-tertiary bg-background transition-colors hover:bg-muted"
                            >
                                <div className="aspect-[4/3] bg-muted">
                                    {imageUrl ? (
                                        <>
                                            {/** biome-ignore lint/performance/noImgElement: Offer images come from API data and may use configured external origins. */}
                                            <img
                                                alt={offer.plantSort.name}
                                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                                src={imageUrl}
                                            />
                                        </>
                                    ) : null}
                                </div>
                                <div className="p-4">
                                    <Typography level="h5" component="h3">
                                        {offer.plantSort.name}
                                    </Typography>
                                    <Typography level="body2" secondary>
                                        {currencyFormatter.format(
                                            offer.outletPrice,
                                        )}{' '}
                                        · preostalo {offer.remainingQuantity}
                                    </Typography>
                                </div>
                            </a>
                        );
                    })}
                </div>
            </Stack>
        </section>
    );
}
