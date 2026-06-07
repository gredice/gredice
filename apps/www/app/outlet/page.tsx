import { Container } from '@gredice/ui/Container';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { StructuredDataScript } from '../../components/shared/seo/StructuredDataScript';
import { KnownPages } from '../../src/KnownPages';
import { OutletOfferCard } from './OutletOfferCard';
import { getOutletOffers, outletOfferImage } from './outletData';

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

export default async function OutletPage() {
    const offers = await getOutletOffers();

    return (
        <Container className="py-10 sm:py-14">
            {offers.length > 0 ? (
                <StructuredDataScript data={outletStructuredData(offers)} />
            ) : null}
            <Stack spacing={8}>
                <Stack spacing={3} className="max-w-3xl">
                    <Typography level="body1" semiBold tertiary>
                        Gredice Outlet
                    </Typography>
                    <Typography level="h1">Outlet sadnica</Typography>
                    <Typography level="body1" secondary>
                        Presadnice koje su ostale u našem stakleniku nudimo po
                        nižoj cijeni dok traju zalihe i naznačeno vrijeme
                        ponude.
                    </Typography>
                </Stack>
                {offers.length > 0 ? (
                    <div className="grid gap-5">
                        {offers.map((offer) => (
                            <OutletOfferCard key={offer.id} offer={offer} />
                        ))}
                    </div>
                ) : (
                    <div className="rounded-lg border border-tertiary bg-card p-6">
                        <Stack spacing={2}>
                            <Typography level="h3" component="h2">
                                Trenutno nema aktivnih outlet ponuda
                            </Typography>
                            <Typography level="body2" secondary>
                                Kad u stakleniku ostane dostupnih presadnica,
                                prikazat ćemo ih ovdje s rokom ponude i
                                preostalom količinom.
                            </Typography>
                        </Stack>
                    </div>
                )}
            </Stack>
        </Container>
    );
}
