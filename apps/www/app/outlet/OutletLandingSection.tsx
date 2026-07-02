import { Discount, Sprout } from '@gredice/ui/icons';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { KnownPages } from '../../src/KnownPages';
import { OutletLandingOfferCard } from './OutletLandingOfferCard';
import { getOutletOffers } from './outletData';

export async function OutletLandingSection() {
    const offers = await getOutletOffers();
    const highlightedOffers = offers.slice(0, 3);
    if (highlightedOffers.length === 0) {
        return null;
    }

    return (
        <section className="my-20">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)] lg:items-center">
                <Stack spacing={5}>
                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/70 bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        <Discount aria-hidden className="size-4" />
                        Outlet cijena, Gredice kvaliteta
                    </div>
                    <Stack spacing={2} className="max-w-xl">
                        <Typography level="body1" semiBold tertiary>
                            Gredice Outlet
                        </Typography>
                        <Typography level="h2">
                            Presadnice koje čekaju svoju gredicu
                        </Typography>
                        <Typography level="body1" secondary>
                            Kad u stakleniku ostane nekoliko zdravih presadnica
                            koje su već krenule u rast, ponudimo ih po outlet
                            cijeni da brzo pronađu svoje mjesto u gredici.
                        </Typography>
                    </Stack>
                    <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm text-secondary-foreground ring-1 ring-tertiary">
                            <Sprout
                                aria-hidden
                                className="size-4 text-primary"
                            />
                            Već krenule u rast
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm text-secondary-foreground ring-1 ring-tertiary">
                            <Discount
                                aria-hidden
                                className="size-4 text-amber-600 dark:text-amber-300"
                            />
                            Ograničena outlet cijena
                        </span>
                    </div>
                    <NavigatingButton
                        href={KnownPages.Outlet}
                        variant="outlined"
                        className="w-fit"
                    >
                        Pogledaj outlet
                    </NavigatingButton>
                </Stack>
                <div
                    className={cx(
                        'grid gap-4',
                        highlightedOffers.length === 1
                            ? 'max-w-2xl'
                            : 'sm:grid-cols-2 xl:grid-cols-3',
                    )}
                >
                    {highlightedOffers.map((offer) => (
                        <OutletLandingOfferCard
                            featured={highlightedOffers.length === 1}
                            key={offer.id}
                            offer={offer}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
