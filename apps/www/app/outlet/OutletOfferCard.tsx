import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import {
    type OutletOffer,
    outletGardenUrl,
    outletOfferImage,
} from './outletData';

const dateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
});

const currencyFormatter = new Intl.NumberFormat('hr-HR', {
    style: 'currency',
    currency: 'EUR',
});

export function OutletOfferCard({ offer }: { offer: OutletOffer }) {
    const imageUrl = outletOfferImage(offer);

    return (
        <article className="grid overflow-hidden rounded-lg border border-tertiary bg-card shadow-sm md:grid-cols-[minmax(220px,0.8fr)_1fr]">
            <div className="relative aspect-[4/3] bg-muted md:aspect-auto">
                {imageUrl ? (
                    <>
                        {/** biome-ignore lint/performance/noImgElement: Offer images come from API data and may use configured external origins. */}
                        <img
                            alt={offer.plantSort.name}
                            className="h-full w-full object-cover"
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
            </div>
            <div className="p-5 sm:p-6">
                <Stack spacing={5}>
                    <Stack spacing={2}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <Typography level="h3" component="h2">
                                    {offer.plantSort.name}
                                </Typography>
                                {offer.plantSort.plant?.name ? (
                                    <Typography level="body2" tertiary>
                                        {offer.plantSort.plant.name}
                                    </Typography>
                                ) : null}
                            </div>
                            <div className="text-right">
                                <Typography level="h4" component="p">
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
                    <dl className="grid gap-3 text-sm sm:grid-cols-3">
                        <div>
                            <dt className="text-muted-foreground">Sjetva</dt>
                            <dd className="font-medium">
                                {dateFormatter.format(
                                    new Date(offer.sowingDate),
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">Preostalo</dt>
                            <dd className="font-medium">
                                {offer.remainingQuantity} od {offer.quantity}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">
                                Ponuda traje do
                            </dt>
                            <dd className="font-medium">
                                {timeFormatter.format(new Date(offer.endAt))}
                            </dd>
                        </div>
                    </dl>
                    <NavigatingButton
                        href={outletGardenUrl(offer.id)}
                        className="w-fit"
                    >
                        Odaberi u vrtu
                    </NavigatingButton>
                </Stack>
            </div>
        </article>
    );
}
