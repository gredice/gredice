import { Container } from '@gredice/ui/Container';
import { Discount, ShoppingCart, Sprout, Timer } from '@gredice/ui/icons';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { StructuredDataScript } from '../../components/shared/seo/StructuredDataScript';
import { KnownPages } from '../../src/KnownPages';
import { OutletOfferCard } from './OutletOfferCard';
import { getOutletOffers, outletOfferImage } from './outletData';
import { currencyFormatter, offerEndFormatter } from './outletPresentation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Outlet sadnica',
    description:
        'Vremenski ograničene outlet ponude presadnica koje su ostale u Gredice stakleniku.',
    alternates: {
        canonical: KnownPages.Outlet,
    },
    openGraph: {
        title: 'Gredice Outlet sadnica',
        description:
            'Pogledaj dostupne presadnice iz staklenika po outlet cijeni.',
        url: KnownPages.Outlet,
    },
};

function outletStructuredData(
    offers: Awaited<ReturnType<typeof getOutletOffers>>,
) {
    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Gredice Outlet sadnica',
        url: `https://www.gredice.com${KnownPages.Outlet}`,
        itemListElement: offers.map((offer, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            item: {
                '@type': 'Product',
                name: offer.plantSort.name,
                description: offer.plantSort.description ?? undefined,
                image: outletOfferImage(offer) ?? undefined,
                brand: {
                    '@type': 'Brand',
                    name: 'Gredice',
                },
                offers: {
                    '@type': 'Offer',
                    price: offer.outletPrice.toFixed(2),
                    priceCurrency: 'EUR',
                    priceValidUntil: offer.endAt.slice(0, 10),
                    availability:
                        offer.remainingQuantity > 0
                            ? 'https://schema.org/InStock'
                            : 'https://schema.org/OutOfStock',
                    inventoryLevel: {
                        '@type': 'QuantitativeValue',
                        value: offer.remainingQuantity,
                    },
                    url: `https://www.gredice.com${KnownPages.Outlet}?offer=${offer.id}`,
                },
            },
        })),
    };
}

function outletSummary(offers: Awaited<ReturnType<typeof getOutletOffers>>) {
    const remainingQuantity = offers.reduce(
        (total, offer) => total + offer.remainingQuantity,
        0,
    );
    const lowestOutletPrice = offers.reduce<number | null>(
        (lowestPrice, offer) =>
            lowestPrice === null
                ? offer.outletPrice
                : Math.min(lowestPrice, offer.outletPrice),
        null,
    );
    const nextEndingOffer = offers.reduce<(typeof offers)[number] | null>(
        (nextOffer, offer) =>
            nextOffer === null ||
            new Date(offer.endAt).getTime() <
                new Date(nextOffer.endAt).getTime()
                ? offer
                : nextOffer,
        null,
    );

    return {
        lowestOutletPrice,
        nextEndingOffer,
        remainingQuantity,
    };
}

export default async function OutletPage() {
    const offers = await getOutletOffers();
    const { lowestOutletPrice, nextEndingOffer, remainingQuantity } =
        outletSummary(offers);

    return (
        <Container className="py-10 sm:py-14">
            {offers.length > 0 ? (
                <StructuredDataScript data={outletStructuredData(offers)} />
            ) : null}
            <Stack spacing={10}>
                <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)] lg:items-end">
                    <Stack spacing={5} className="max-w-3xl">
                        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/70 bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                            <Discount aria-hidden className="size-4" />
                            Outlet cijena, Gredice kvaliteta
                        </div>
                        <Stack spacing={3}>
                            <Typography level="body1" semiBold tertiary>
                                Gredice Outlet
                            </Typography>
                            <Typography level="h1">
                                Presadnice po outlet cijeni
                            </Typography>
                            <Typography
                                level="body1"
                                secondary
                                className="max-w-2xl text-pretty"
                            >
                                Zdrave presadnice koje su već krenule u rast iz
                                našeg staklenika možeš dodati u svoju gredicu po
                                povoljnijoj cijeni. Ponude su vremenski i
                                količinski ograničene.
                            </Typography>
                        </Stack>
                        <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm text-secondary-foreground ring-1 ring-tertiary">
                                <Sprout
                                    aria-hidden
                                    className="size-4 text-primary"
                                />
                                Spremne za tvoju gredicu
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm text-secondary-foreground ring-1 ring-tertiary">
                                <ShoppingCart
                                    aria-hidden
                                    className="size-4 text-primary"
                                />
                                Rezervacija kroz vrt
                            </span>
                        </div>
                    </Stack>
                    {offers.length > 0 ? (
                        <dl className="grid grid-cols-3 gap-2 sm:gap-3">
                            <div className="rounded-2xl border border-tertiary border-b-4 bg-card p-3 sm:p-4">
                                <dt className="text-sm text-muted-foreground">
                                    Ponude
                                </dt>
                                <dd className="mt-1 text-2xl leading-tight sm:text-3xl">
                                    {offers.length}
                                </dd>
                            </div>
                            <div className="rounded-2xl border border-tertiary border-b-4 bg-card p-3 sm:p-4">
                                <dt className="text-sm text-muted-foreground">
                                    Sadnice
                                </dt>
                                <dd className="mt-1 text-2xl leading-tight sm:text-3xl">
                                    {remainingQuantity}
                                </dd>
                            </div>
                            <div className="rounded-2xl border border-tertiary border-b-4 bg-card p-3 sm:p-4">
                                <dt className="text-sm text-muted-foreground">
                                    Od
                                </dt>
                                <dd className="mt-1 text-2xl leading-tight sm:text-3xl">
                                    {lowestOutletPrice === null
                                        ? '-'
                                        : currencyFormatter.format(
                                              lowestOutletPrice,
                                          )}
                                </dd>
                            </div>
                        </dl>
                    ) : null}
                </section>
                {offers.length > 0 ? (
                    <section
                        aria-labelledby="outlet-offers-heading"
                        className="grid gap-5"
                    >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <Stack spacing={1}>
                                <Typography
                                    id="outlet-offers-heading"
                                    level="h2"
                                >
                                    Dostupne outlet sadnice
                                </Typography>
                                {nextEndingOffer ? (
                                    <Typography level="body2" secondary>
                                        Sljedeća ponuda istječe{' '}
                                        {offerEndFormatter.format(
                                            new Date(nextEndingOffer.endAt),
                                        )}
                                        .
                                    </Typography>
                                ) : null}
                            </Stack>
                            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm text-secondary-foreground ring-1 ring-tertiary">
                                <Timer
                                    aria-hidden
                                    className="size-4 text-amber-600 dark:text-amber-300"
                                />
                                Dok traju zalihe
                            </span>
                        </div>
                        <div className="grid gap-5">
                            {offers.map((offer) => (
                                <OutletOfferCard key={offer.id} offer={offer} />
                            ))}
                        </div>
                    </section>
                ) : (
                    <div className="rounded-2xl border border-tertiary border-b-4 bg-card p-6 sm:p-8">
                        <Stack spacing={4} className="max-w-2xl">
                            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Sprout aria-hidden className="size-6" />
                            </div>
                            <Typography level="h3" component="h2">
                                Trenutno nema aktivnih outlet ponuda
                            </Typography>
                            <Typography level="body2" secondary>
                                Kad u stakleniku ostane dostupnih presadnica,
                                prikazat ćemo ih ovdje s rokom ponude i
                                preostalom količinom.
                            </Typography>
                            <NavigatingButton
                                href={KnownPages.Plants}
                                variant="outlined"
                                className="w-fit"
                            >
                                Pregledaj biljke
                            </NavigatingButton>
                        </Stack>
                    </div>
                )}
            </Stack>
        </Container>
    );
}
