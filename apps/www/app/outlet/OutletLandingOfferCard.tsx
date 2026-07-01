import { Discount } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import Link from 'next/link';
import { KnownPages } from '../../src/KnownPages';
import { type OutletOffer, outletOfferImage } from './outletData';
import {
    compactDateFormatter,
    currencyFormatter,
    outletDiscountLabel,
    outletRemainingLabel,
} from './outletPresentation';

export function OutletLandingOfferCard({
    featured,
    offer,
}: {
    featured?: boolean;
    offer: OutletOffer;
}) {
    const imageUrl = outletOfferImage(offer);

    return (
        <Link
            className={cx(
                'group grid h-full overflow-hidden rounded-2xl border border-tertiary border-b-4 bg-card text-card-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-muted-foreground/50 hover:shadow-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                featured && 'sm:grid-cols-[minmax(11rem,0.9fr)_1fr]',
            )}
            href={`${KnownPages.Outlet}?offer=${offer.id}`}
        >
            <div
                className={cx(
                    'relative aspect-[4/3] overflow-hidden bg-muted',
                    featured && 'sm:aspect-auto',
                )}
            >
                {imageUrl ? (
                    <>
                        {/** biome-ignore lint/performance/noImgElement: Offer images come from API data and may use configured external origins. */}
                        <img
                            alt={offer.plantSort.name}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            src={imageUrl}
                        />
                    </>
                ) : (
                    <div className="flex h-full min-h-48 items-center justify-center bg-tertiary/15 p-5 text-center">
                        <Typography level="body2" secondary>
                            Fotografija sadnice uskoro stiže
                        </Typography>
                    </div>
                )}
            </div>
            <div className="flex h-full flex-col gap-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                        <Discount aria-hidden className="size-3.5" />
                        {outletDiscountLabel(offer)}
                    </span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        {outletRemainingLabel(offer)}
                    </span>
                </div>
                <div>
                    <Typography level="h5" component="h3">
                        {offer.plantSort.name}
                    </Typography>
                    <Typography level="body3" tertiary>
                        Sjetva{' '}
                        {compactDateFormatter.format(
                            new Date(offer.sowingDate),
                        )}
                    </Typography>
                </div>
                <div className="mt-auto flex items-end justify-between gap-3">
                    <div>
                        <Typography level="body3" tertiary>
                            Outlet cijena
                        </Typography>
                        <Typography level="h4" component="p">
                            {currencyFormatter.format(offer.outletPrice)}
                        </Typography>
                    </div>
                    {typeof offer.comparePrice === 'number' ? (
                        <div className="text-right">
                            <Typography level="body3" tertiary>
                                redovna cijena
                            </Typography>
                            <Typography
                                level="body2"
                                secondary
                                className="line-through"
                            >
                                {currencyFormatter.format(offer.comparePrice)}
                            </Typography>
                        </div>
                    ) : null}
                </div>
            </div>
        </Link>
    );
}
