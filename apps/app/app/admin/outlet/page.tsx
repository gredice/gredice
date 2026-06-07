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
                    <CardOverflow className="overflow-x-auto">
                        <table className="w-full min-w-[980px] text-sm">
                            <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium">
                                        Ponuda
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Sorta
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Cijena
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Stanje
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Trajanje
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Sjetva
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Akcije
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {offers.map((offer) => (
                                    <tr key={offer.id}>
                                        <td className="px-4 py-3 align-top">
                                            <Stack spacing={1}>
                                                <Link
                                                    className="font-medium text-primary hover:underline"
                                                    href={KnownPages.OutletOffer(
                                                        offer.id,
                                                    )}
                                                >
                                                    Outlet #{offer.id}
                                                </Link>
                                                <OutletOfferStatusBadge
                                                    status={offer.status}
                                                />
                                            </Stack>
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            {plantSortLabel(
                                                plantSortsById.get(
                                                    offer.plantSortId,
                                                ),
                                            )}
                                        </td>
                                        <td className="px-4 py-3 align-top">
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
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <Stack spacing={1}>
                                                <span>
                                                    {offer.remainingQuantity} /
                                                    {offer.quantity} dostupno
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {offer.reservedQuantity}{' '}
                                                    rezervirano,{' '}
                                                    {offer.soldQuantity} prodano
                                                </span>
                                            </Stack>
                                        </td>
                                        <td className="px-4 py-3 align-top">
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
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            {formatDate(offer.sowingDate)}
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <Row spacing={2}>
                                                <Button
                                                    href={KnownPages.OutletOffer(
                                                        offer.id,
                                                    )}
                                                    variant="outlined"
                                                    color="neutral"
                                                    size="sm"
                                                >
                                                    Otvori
                                                </Button>
                                                <Button
                                                    href={KnownPages.OutletOfferEdit(
                                                        offer.id,
                                                    )}
                                                    variant="plain"
                                                    color="neutral"
                                                    size="sm"
                                                >
                                                    Uredi
                                                </Button>
                                            </Row>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardOverflow>
                </Card>
            )}
        </Stack>
    );
}
