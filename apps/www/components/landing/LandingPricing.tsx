import { getGardenBaseUrl } from '@gredice/js/urls';
import { Button } from '@gredice/ui/Button';
import { ArrowRight, Security } from '@gredice/ui/icons';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { getLandingPricing } from '../../app/getLandingPricing';
import { formatPrice } from '../../lib/formatPrice';
import { KnownPages } from '../../src/KnownPages';
import { LandingCheckItem } from './LandingCheckItem';
import { LandingPricingCard } from './LandingPricingCard';
import { LandingSectionHeader } from './LandingSectionHeader';

export async function LandingPricing() {
    const pricing = await getLandingPricing();
    if (!pricing) {
        return null;
    }

    const { minPlantPrice, cheapestOperation, delivery } = pricing;

    return (
        <section
            aria-labelledby="landing-pricing-title"
            className="-mx-2 rounded-3xl bg-card p-6 sm:-mx-4 sm:p-10"
        >
            <div className="flex flex-col gap-8">
                <LandingSectionHeader
                    id="landing-pricing-title"
                    eyebrow="Cijene"
                    title="Plaćaš samo ono što posadiš i naručiš"
                    description="Prije potvrde u košari vidiš svaku stavku i ukupni iznos."
                />
                <div className="grid gap-5 md:grid-cols-3">
                    {typeof minPlantPrice === 'number' ? (
                        <LandingPricingCard
                            title="Sadnja"
                            fromPrice
                            price={formatPrice(minPlantPrice)}
                            description="po biljci, ovisno o kulturi i sorti"
                            href={KnownPages.Plants}
                            linkLabel="Pogledaj biljke"
                        >
                            <LandingCheckItem>
                                Povrat na saldo ako biljka ne nikne
                            </LandingCheckItem>
                            <LandingCheckItem>
                                30 dana za reklamacije biljaka
                            </LandingCheckItem>
                        </LandingPricingCard>
                    ) : null}
                    {cheapestOperation ? (
                        <LandingPricingCard
                            title="Radnje"
                            fromPrice
                            price={formatPrice(cheapestOperation.price)}
                            description={`po radnji, npr. „${cheapestOperation.label}”`}
                            href={KnownPages.Operations}
                            linkLabel="Sve radnje"
                        >
                            <LandingCheckItem>
                                Naručuješ samo radnje koje želiš
                            </LandingCheckItem>
                            <LandingCheckItem>
                                30 dana za reklamacije radnji
                            </LandingCheckItem>
                        </LandingPricingCard>
                    ) : null}
                    <LandingPricingCard
                        title="Dostava"
                        price="0 €"
                        description="na adrese u Gradu Zagrebu"
                        href={KnownPages.Delivery}
                        linkLabel="Provjeri dostavu"
                    >
                        {delivery ? (
                            <LandingCheckItem>
                                Izvan Zagreba{' '}
                                {formatPrice(delivery.pricePerKilometer)}/km, do{' '}
                                {delivery.zoneRadius.toString()} km vožnje
                            </LandingCheckItem>
                        ) : null}
                        <LandingCheckItem>
                            Ili osobno preuzimanje u Zagrebu
                        </LandingCheckItem>
                    </LandingPricingCard>
                </div>
                <div className="flex flex-col gap-4 rounded-2xl border border-brand/40 bg-brand/10 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
                    <span
                        aria-hidden
                        className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground"
                    >
                        <Security className="size-6" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <Typography level="h5" component="h3">
                            Biljka nije niknula? Vraćamo novac.
                        </Typography>
                        <Typography
                            level="body1"
                            secondary
                            className="text-pretty"
                        >
                            Ako biljka ne nikne ni nakon 15 dana, označi to u
                            aplikaciji i puni iznos sadnje vraćamo na tvoj
                            saldo.
                        </Typography>
                    </div>
                    <NavigatingButton
                        variant="link"
                        className="w-fit shrink-0"
                        href={KnownPages.Refunds}
                    >
                        Pravila povrata
                    </NavigatingButton>
                </div>
                <div className="flex flex-col gap-5 border-t pt-8 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap gap-3">
                        <NavigatingButton
                            href={getGardenBaseUrl()}
                            size="lg"
                            color="brand"
                            endDecorator={
                                <ArrowRight aria-hidden className="size-4" />
                            }
                        >
                            Složi svoju gredicu
                        </NavigatingButton>
                        <Button
                            href={KnownPages.Pricing}
                            size="lg"
                            color="neutral"
                            variant="outlined"
                            className="bg-background text-primary"
                        >
                            Cijeli cjenik
                        </Button>
                    </div>
                    <Typography
                        level="body2"
                        className="max-w-sm text-pretty md:text-right"
                    >
                        Radiš više radnji? Nadoplati saldo{' '}
                        <Link
                            href={KnownPages.Sunflowers}
                            className="font-medium text-brand underline underline-offset-4"
                        >
                            paketom suncokreta
                        </Link>{' '}
                        s bonusom.
                    </Typography>
                </div>
            </div>
        </section>
    );
}
