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
        <article className="grid grid-cols-[7.5rem_minmax(0,1fr)] overflow-hidden rounded-xl border border-tertiary border-b-4 bg-card shadow-sm sm:grid-cols-[minmax(9rem,11rem)_minmax(0,1fr)] lg:grid-cols-[minmax(10rem,13rem)_minmax(0,1fr)_auto]">
            <div className="relative min-h-36 overflow-hidden bg-muted lg:min-h-44">
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
                    <div className="flex h-full min-h-36 items-center justify-center bg-tertiary/15 px-4 text-center">
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
            <div className="p-3 sm:p-4 lg:p-5 lg:pr-4">
                <Stack spacing={3}>
                    <Stack spacing={1}>
                        <div className="min-w-0">
                            <Typography
                                level="h5"
                                component="h2"
                                className="line-clamp-2"
                            >
                                {offer.plantSort.name}
                            </Typography>
                            {offer.plantSort.plant?.name ? (
                                <Typography level="body2" tertiary>
                                    {offer.plantSort.plant.name}
                                </Typography>
                            ) : null}
                        </div>
                        {offer.plantSort.description ? (
                            <Typography
                                level="body2"
                                secondary
                                className="hidden max-w-2xl text-pretty sm:line-clamp-2 sm:block"
                            >
                                {offer.plantSort.description}
                            </Typography>
                        ) : null}
                    </Stack>
                    <dl className="grid gap-2 border-t border-tertiary pt-2 text-xs sm:grid-cols-3 sm:text-sm lg:gap-3 lg:pt-3">
                        <div>
                            <dt className="flex items-center gap-1.5 text-muted-foreground">
                                <Sprout
                                    aria-hidden
                                    className="size-3.5 sm:size-4"
                                />
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
                                <Calendar
                                    aria-hidden
                                    className="size-3.5 sm:size-4"
                                />
                                Preostalo
                            </dt>
                            <dd className="mt-1 font-medium">
                                {offer.remainingQuantity} od {offer.quantity}
                            </dd>
                        </div>
                        <div>
                            <dt className="flex items-center gap-1.5 text-muted-foreground">
                                <Timer
                                    aria-hidden
                                    className="size-3.5 sm:size-4"
                                />
                                Istječe
                            </dt>
                            <dd className="mt-1 font-medium">
                                {offerEndFormatter.format(
                                    new Date(offer.endAt),
                                )}
                            </dd>
                        </div>
                    </dl>
                </Stack>
            </div>
            <div className="col-span-2 flex items-end justify-between gap-3 border-t border-tertiary p-3 sm:p-4 lg:col-span-1 lg:flex-col lg:items-end lg:border-l lg:border-t-0 lg:text-right">
                <div>
                    <Typography level="body3" tertiary>
                        Outlet cijena
                    </Typography>
                    <Typography level="h5" component="p">
                        {currencyFormatter.format(offer.outletPrice)}
                    </Typography>
                    {typeof offer.comparePrice === 'number' ? (
                        <Typography
                            level="body2"
                            secondary
                            className="line-through"
                        >
                            {currencyFormatter.format(offer.comparePrice)}
                        </Typography>
                    ) : null}
                </div>
                <NavigatingButton
                    href={outletGardenUrl(offer.id)}
                    size="sm"
                    className="w-fit shrink-0"
                >
                    Odaberi u vrtu
                </NavigatingButton>
            </div>
        </article>
    );
}
