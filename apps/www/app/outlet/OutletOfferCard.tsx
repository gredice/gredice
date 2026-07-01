import { Calendar, Discount, Sprout, Timer } from '@gredice/ui/icons';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import {
    type OutletOffer,
    outletGardenUrl,
    outletOfferImage,
} from './outletData';
import {
    currencyFormatter,
    longDateFormatter,
    offerEndFormatter,
    outletDiscountLabel,
    outletRemainingLabel,
} from './outletPresentation';

export function OutletOfferCard({ offer }: { offer: OutletOffer }) {
    const imageUrl = outletOfferImage(offer);

    return (
        <article className="grid overflow-hidden rounded-2xl border border-tertiary border-b-4 bg-card shadow-sm md:grid-cols-[minmax(220px,0.8fr)_1fr]">
            <div className="relative aspect-[4/3] overflow-hidden bg-muted md:aspect-auto">
                {imageUrl ? (
                    <>
                        {/** biome-ignore lint/performance/noImgElement: Offer images come from API data and may use configured external origins. */}
                        <img
                            alt={offer.plantSort.name}
                            className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                            src={imageUrl}
                        />
                    </>
                ) : (
                    <div className="flex h-full min-h-56 items-center justify-center bg-tertiary/15 px-6 text-center">
                        <Typography level="body2" secondary>
                            Fotografija sadnice uskoro stiže
                        </Typography>
                    </div>
                )}
                <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 shadow-sm dark:bg-amber-950 dark:text-amber-200">
                        <Discount aria-hidden className="size-3.5" />
                        {outletDiscountLabel(offer)}
                    </span>
                    <span className="rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-primary shadow-sm">
                        {outletRemainingLabel(offer)}
                    </span>
                </div>
            </div>
            <div className="p-5 sm:p-6">
                <Stack spacing={6}>
                    <Stack spacing={2}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <Typography level="h3" component="h2">
                                    {offer.plantSort.name}
                                </Typography>
                                {offer.plantSort.plant?.name ? (
                                    <Typography level="body2" tertiary>
                                        {offer.plantSort.plant.name}
                                    </Typography>
                                ) : null}
                            </div>
                            <div className="rounded-xl bg-muted/60 px-4 py-3 text-right">
                                <Typography level="body3" tertiary>
                                    Outlet cijena
                                </Typography>
                                <Typography level="h3" component="p">
                                    {currencyFormatter.format(
                                        offer.outletPrice,
                                    )}
                                </Typography>
                                {typeof offer.comparePrice === 'number' ? (
                                    <Typography
                                        level="body2"
                                        secondary
                                        className="line-through"
                                    >
                                        {currencyFormatter.format(
                                            offer.comparePrice,
                                        )}
                                    </Typography>
                                ) : null}
                            </div>
                        </div>
                        {offer.plantSort.description ? (
                            <Typography
                                level="body2"
                                secondary
                                className="max-w-2xl text-pretty"
                            >
                                {offer.plantSort.description}
                            </Typography>
                        ) : null}
                    </Stack>
                    <dl className="grid gap-4 border-y border-tertiary py-4 text-sm sm:grid-cols-3">
                        <div>
                            <dt className="flex items-center gap-1.5 text-muted-foreground">
                                <Sprout aria-hidden className="size-4" />
                                Sjetva
                            </dt>
                            <dd className="mt-1 font-medium">
                                {longDateFormatter.format(
                                    new Date(offer.sowingDate),
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt className="flex items-center gap-1.5 text-muted-foreground">
                                <Calendar aria-hidden className="size-4" />
                                Preostalo
                            </dt>
                            <dd className="mt-1 font-medium">
                                {offer.remainingQuantity} od {offer.quantity}
                            </dd>
                        </div>
                        <div>
                            <dt className="flex items-center gap-1.5 text-muted-foreground">
                                <Timer aria-hidden className="size-4" />
                                Ponuda traje do
                            </dt>
                            <dd className="mt-1 font-medium">
                                {offerEndFormatter.format(
                                    new Date(offer.endAt),
                                )}
                            </dd>
                        </div>
                    </dl>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <Typography
                            level="body2"
                            secondary
                            className="max-w-md text-pretty"
                        >
                            Outlet presadnicu rezerviraš odabirom praznog polja
                            u svom vrtu.
                        </Typography>
                        <NavigatingButton
                            href={outletGardenUrl(offer.id)}
                            className="w-fit"
                        >
                            Odaberi u vrtu
                        </NavigatingButton>
                    </div>
                </Stack>
            </div>
        </article>
    );
}
