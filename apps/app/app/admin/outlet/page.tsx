import { getEntitiesFormatted, getOutletOffers } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { Add, Discount } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { AdminPageHeader } from '../../../components/admin/navigation';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';
import { formatDate, formatDateTime, formatPrice } from './format';
import { OutletOfferStatusBadge } from './OutletStatusBadge';

export const dynamic = 'force-dynamic';

function plantSortLabel(plantSort: EntityStandardized | undefined) {
    return (
        plantSort?.information?.label ??
        plantSort?.information?.name ??
        (plantSort ? `Sorta ${plantSort.id}` : 'Nepoznata sorta')
    );
}

export default async function OutletAdminPage() {
    await auth(['admin']);

    const [offers, plantSorts] = await Promise.all([
        getOutletOffers({ includeUnavailable: true }),
        getEntitiesFormatted<EntityStandardized>('plantSort'),
    ]);
    const now = new Date();
    const plantSortsById = new Map(
        plantSorts.map((plantSort) => [plantSort.id, plantSort]),
    );
    const activeOffers = offers.filter(
        (offer) =>
            offer.status === 'published' &&
            offer.startAt.getTime() <= now.getTime() &&
            offer.endAt.getTime() > now.getTime(),
    );
    const totalRemaining = offers.reduce(
        (sum, offer) => sum + offer.remainingQuantity,
        0,
    );
    const heldQuantity = offers.reduce(
        (sum, offer) => sum + offer.reservedQuantity,
        0,
    );
    const soldQuantity = offers.reduce(
        (sum, offer) => sum + offer.soldQuantity,
        0,
    );

    return (
        <Stack spacing={4}>
            <AdminPageHeader
                actions={
                    <Button
                        href={KnownPages.OutletCreate}
                        startDecorator={<Add className="size-4" />}
                    >
                        Nova outlet ponuda
                    </Button>
                }
                heading="Outlet"
            />

            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Ponude</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Typography level="h3" className="text-2xl" semiBold>
                            {offers.length}
                        </Typography>
                        <Typography level="body3" secondary>
                            {activeOffers.length} aktivno
                        </Typography>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Dostupno</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Typography level="h3" className="text-2xl" semiBold>
                            {totalRemaining}
                        </Typography>
                        <Typography level="body3" secondary>
                            sadnica za kupnju
                        </Typography>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Rezervirano</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Typography level="h3" className="text-2xl" semiBold>
                            {heldQuantity}
                        </Typography>
                        <Typography level="body3" secondary>
                            aktivni cart holdovi
                        </Typography>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Prodano</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Typography level="h3" className="text-2xl" semiBold>
                            {soldQuantity}
                        </Typography>
                        <Typography level="body3" secondary>
                            plaćene sadnice
                        </Typography>
                    </CardContent>
                </Card>
            </div>

            {offers.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <Stack spacing={4} className="items-center text-center">
                            <Discount className="size-12 text-muted-foreground" />
                            <Typography level="body1" secondary>
                                Nema outlet ponuda. Kreirajte prvu ponudu za
                                ostatke iz plastenika.
                            </Typography>
                            <Button href={KnownPages.OutletCreate}>
                                Nova outlet ponuda
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardOverflow>
                        <ul className="divide-y">
                            {offers.map((offer) => {
                                const offerHref = KnownPages.OutletOffer(
                                    offer.id,
                                );
                                const offerEditHref =
                                    KnownPages.OutletOfferEdit(offer.id);
                                const plantSortName = plantSortLabel(
                                    plantSortsById.get(offer.plantSortId),
                                );

                                return (
                                    <li
                                        key={offer.id}
                                        className="px-3 py-4 transition-colors hover:bg-muted/40 sm:px-4"
                                    >
                                        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <Stack
                                                spacing={1}
                                                className="min-w-0 flex-1"
                                            >
                                                <Link
                                                    className="min-w-0 truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
                                                    href={offerHref}
                                                >
                                                    Outlet #{offer.id}
                                                </Link>
                                                <Typography
                                                    level="body3"
                                                    className="text-muted-foreground"
                                                >
                                                    Sorta:{' '}
                                                    <span className="text-foreground">
                                                        {plantSortName}
                                                    </span>
                                                </Typography>
                                            </Stack>

                                            <div className="flex min-w-0 flex-col gap-3 lg:items-end">
                                                <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
                                                    <OutletOfferStatusBadge
                                                        status={offer.status}
                                                    />
                                                    <Row
                                                        spacing={2}
                                                        className="min-w-0 flex-wrap"
                                                    >
                                                        <Button
                                                            href={offerHref}
                                                            variant="outlined"
                                                            color="neutral"
                                                            size="sm"
                                                        >
                                                            Otvori
                                                        </Button>
                                                        <Button
                                                            href={offerEditHref}
                                                            variant="plain"
                                                            color="neutral"
                                                            size="sm"
                                                        >
                                                            Uredi
                                                        </Button>
                                                    </Row>
                                                </div>

                                                <dl className="grid min-w-0 gap-x-4 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-4 xl:text-right">
                                                    <div className="min-w-0">
                                                        <dt className="text-xs font-medium uppercase text-muted-foreground">
                                                            Cijena
                                                        </dt>
                                                        <dd className="mt-1">
                                                            <Stack spacing={1}>
                                                                <span>
                                                                    {formatPrice(
                                                                        offer.outletPriceCents,
                                                                    )}
                                                                </span>
                                                                {offer.comparePriceCents ? (
                                                                    <span className="text-xs text-muted-foreground line-through">
                                                                        {formatPrice(
                                                                            offer.comparePriceCents,
                                                                        )}
                                                                    </span>
                                                                ) : null}
                                                            </Stack>
                                                        </dd>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <dt className="text-xs font-medium uppercase text-muted-foreground">
                                                            Stanje
                                                        </dt>
                                                        <dd className="mt-1">
                                                            <Stack spacing={1}>
                                                                <span>
                                                                    {
                                                                        offer.remainingQuantity
                                                                    }{' '}
                                                                    /{' '}
                                                                    {
                                                                        offer.quantity
                                                                    }{' '}
                                                                    dostupno
                                                                </span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {
                                                                        offer.reservedQuantity
                                                                    }{' '}
                                                                    rezervirano,{' '}
                                                                    {
                                                                        offer.soldQuantity
                                                                    }{' '}
                                                                    prodano
                                                                </span>
                                                            </Stack>
                                                        </dd>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <dt className="text-xs font-medium uppercase text-muted-foreground">
                                                            Trajanje
                                                        </dt>
                                                        <dd className="mt-1">
                                                            <Stack spacing={1}>
                                                                <span>
                                                                    {formatDateTime(
                                                                        offer.startAt,
                                                                    )}
                                                                </span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    do{' '}
                                                                    {formatDateTime(
                                                                        offer.endAt,
                                                                    )}
                                                                </span>
                                                            </Stack>
                                                        </dd>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <dt className="text-xs font-medium uppercase text-muted-foreground">
                                                            Sjetva
                                                        </dt>
                                                        <dd className="mt-1">
                                                            {formatDate(
                                                                offer.sowingDate,
                                                            )}
                                                        </dd>
                                                    </div>
                                                </dl>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </CardOverflow>
                </Card>
            )}
        </Stack>
    );
}
