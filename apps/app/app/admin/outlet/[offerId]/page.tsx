import {
    getEntitiesFormatted,
    getOutletOffer,
    getOutletOfferReservationsForOffer,
    type OutletOfferStatus,
} from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Button } from '@gredice/ui/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { Duplicate, Edit, ExternalLink } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminPageHeader } from '../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import type { EntityStandardized } from '../../../../lib/@types/EntityStandardized';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import {
    duplicateOutletOfferAction,
    updateOutletOfferStatusAction,
} from '../actions';
import { formatDate, formatDateTime, formatPrice } from '../format';
import {
    OutletOfferStatusBadge,
    OutletReservationStatusBadge,
} from '../OutletStatusBadge';

export const dynamic = 'force-dynamic';

function plantSortLabel(plantSort: EntityStandardized | undefined, id: number) {
    return (
        plantSort?.information?.label ??
        plantSort?.information?.name ??
        `Sorta ${id}`
    );
}

function discountLabel(
    outletPriceCents: number,
    comparePriceCents: number | null,
) {
    if (!comparePriceCents || comparePriceCents <= outletPriceCents) {
        return null;
    }

    const percent = Math.round(
        ((comparePriceCents - outletPriceCents) / comparePriceCents) * 100,
    );
    return `${percent}% niže`;
}

function StatusActionForm({
    offerId,
    status,
    label,
    color = 'neutral',
}: {
    offerId: number;
    status: OutletOfferStatus;
    label: string;
    color?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
    const action = updateOutletOfferStatusAction.bind(null, offerId, status);

    return (
        <form action={action}>
            <Button type="submit" variant="outlined" color={color} size="sm">
                {label}
            </Button>
        </form>
    );
}

function DuplicateOutletOfferForm({ offerId }: { offerId: number }) {
    const action = duplicateOutletOfferAction.bind(null, offerId);

    return (
        <form action={action}>
            <Button
                type="submit"
                variant="outlined"
                color="neutral"
                startDecorator={<Duplicate className="size-4" />}
            >
                Dupliciraj
            </Button>
        </form>
    );
}

export default async function OutletOfferPage({
    params,
}: {
    params: Promise<{ offerId: string }>;
}) {
    await auth(['admin']);

    const { offerId } = await params;
    const id = Number.parseInt(offerId, 10);
    const [offer, reservations, plantSorts] = await Promise.all([
        Number.isFinite(id) ? getOutletOffer(id) : null,
        Number.isFinite(id) ? getOutletOfferReservationsForOffer(id) : [],
        getEntitiesFormatted<EntityStandardized>('plantSort'),
    ]);

    if (!offer) {
        notFound();
    }

    const now = new Date();
    const plantSortsById = new Map(
        plantSorts.map((plantSort) => [plantSort.id, plantSort]),
    );
    const plantSort = plantSortsById.get(offer.plantSortId);
    const discount = discountLabel(
        offer.outletPriceCents,
        offer.comparePriceCents,
    );

    return (
        <Stack spacing={4}>
            <AdminPageHeader
                breadcrumbs={
                    <Breadcrumbs
                        items={[
                            {
                                label: <AdminBreadcrumbLevelSelector />,
                                href: KnownPages.Outlet,
                            },
                            { label: `Outlet ponuda ${offer.id}` },
                        ]}
                    />
                }
                actions={
                    <Row spacing={2} className="flex-wrap justify-end">
                        {offer.status !== 'published' ? (
                            <StatusActionForm
                                offerId={offer.id}
                                status="published"
                                label="Objavi"
                                color="success"
                            />
                        ) : (
                            <StatusActionForm
                                offerId={offer.id}
                                status="paused"
                                label="Pauziraj"
                                color="warning"
                            />
                        )}
                        {offer.status !== 'closed' ? (
                            <StatusActionForm
                                offerId={offer.id}
                                status="closed"
                                label="Zatvori"
                                color="danger"
                            />
                        ) : null}
                        <Button
                            href={`https://www.gredice.com/outlet?offer=${offer.id}`}
                            variant="outlined"
                            color="neutral"
                            startDecorator={<ExternalLink className="size-4" />}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Javni prikaz
                        </Button>
                        <DuplicateOutletOfferForm offerId={offer.id} />
                        <Button
                            href={KnownPages.OutletOfferEdit(offer.id)}
                            variant="outlined"
                            color="neutral"
                            startDecorator={<Edit className="size-4" />}
                        >
                            Uredi
                        </Button>
                    </Row>
                }
                heading={`Outlet ponuda ${offer.id}`}
            />

            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <Stack spacing={4}>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl">
                                {plantSortLabel(plantSort, offer.plantSortId)}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-3">
                                <Stack spacing={1}>
                                    <Typography level="body3" secondary>
                                        Status
                                    </Typography>
                                    <OutletOfferStatusBadge
                                        status={offer.status}
                                    />
                                </Stack>
                                <Stack spacing={1}>
                                    <Typography level="body3" secondary>
                                        Cijena
                                    </Typography>
                                    <Typography level="body1" semiBold>
                                        {formatPrice(offer.outletPriceCents)}
                                    </Typography>
                                    {offer.comparePriceCents ? (
                                        <Typography
                                            level="body3"
                                            secondary
                                            className="line-through"
                                        >
                                            {formatPrice(
                                                offer.comparePriceCents,
                                            )}
                                        </Typography>
                                    ) : null}
                                    {discount ? (
                                        <Typography
                                            level="body3"
                                            color="success"
                                            semiBold
                                        >
                                            {discount}
                                        </Typography>
                                    ) : null}
                                </Stack>
                                <Stack spacing={1}>
                                    <Typography level="body3" secondary>
                                        Sjetva
                                    </Typography>
                                    <Typography level="body1">
                                        {formatDate(offer.sowingDate)}
                                    </Typography>
                                    <Typography level="body3" secondary>
                                        {offer.initialPlantStatus}
                                    </Typography>
                                </Stack>
                                <Stack spacing={1}>
                                    <Typography level="body3" secondary>
                                        Ukupno
                                    </Typography>
                                    <Typography level="body1" semiBold>
                                        {offer.quantity}
                                    </Typography>
                                </Stack>
                                <Stack spacing={1}>
                                    <Typography level="body3" secondary>
                                        Dostupno
                                    </Typography>
                                    <Typography level="body1" semiBold>
                                        {offer.remainingQuantity}
                                    </Typography>
                                </Stack>
                                <Stack spacing={1}>
                                    <Typography level="body3" secondary>
                                        Rezervirano / prodano
                                    </Typography>
                                    <Typography level="body1">
                                        {offer.reservedQuantity} /{' '}
                                        {offer.soldQuantity}
                                    </Typography>
                                </Stack>
                                <Stack spacing={1}>
                                    <Typography level="body3" secondary>
                                        Početak
                                    </Typography>
                                    <Typography level="body1">
                                        {formatDateTime(offer.startAt)}
                                    </Typography>
                                </Stack>
                                <Stack spacing={1}>
                                    <Typography level="body3" secondary>
                                        Kraj
                                    </Typography>
                                    <Typography level="body1">
                                        {formatDateTime(offer.endAt)}
                                    </Typography>
                                </Stack>
                                <Stack spacing={1}>
                                    <Typography level="body3" secondary>
                                        Javna dostupnost
                                    </Typography>
                                    <Typography
                                        level="body1"
                                        color={
                                            offer.status === 'published' &&
                                            offer.startAt.getTime() <=
                                                now.getTime() &&
                                            offer.endAt.getTime() >
                                                now.getTime() &&
                                            offer.remainingQuantity > 0
                                                ? 'success'
                                                : 'neutral'
                                        }
                                        semiBold
                                    >
                                        {offer.status === 'published' &&
                                        offer.startAt.getTime() <=
                                            now.getTime() &&
                                        offer.endAt.getTime() > now.getTime() &&
                                        offer.remainingQuantity > 0
                                            ? 'Aktivna'
                                            : 'Nije aktivna'}
                                    </Typography>
                                </Stack>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl">
                                Rezervacije
                            </CardTitle>
                        </CardHeader>
                        <CardOverflow className="overflow-x-auto">
                            {reservations.length === 0 ? (
                                <CardContent>
                                    <Typography level="body2" secondary>
                                        Nema rezervacija za ovu ponudu.
                                    </Typography>
                                </CardContent>
                            ) : (
                                <table className="w-full min-w-[860px] text-sm">
                                    <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">
                                                ID
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Status
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Račun
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Košarica
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Količina
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Hold do
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Plaćeno
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {reservations.map((reservation) => {
                                            const holdExpired =
                                                reservation.status === 'held' &&
                                                reservation.holdExpiresAt.getTime() <=
                                                    now.getTime();

                                            return (
                                                <tr key={reservation.id}>
                                                    <td className="px-4 py-3">
                                                        #{reservation.id}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Stack spacing={1}>
                                                            <OutletReservationStatusBadge
                                                                status={
                                                                    reservation.status
                                                                }
                                                            />
                                                            {holdExpired ? (
                                                                <span className="text-xs text-red-600 dark:text-red-300">
                                                                    Hold je
                                                                    istekao
                                                                </span>
                                                            ) : null}
                                                        </Stack>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Link
                                                            className="text-primary hover:underline"
                                                            href={KnownPages.Account(
                                                                reservation.accountId,
                                                            )}
                                                        >
                                                            {
                                                                reservation.accountId
                                                            }
                                                        </Link>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Link
                                                            className="text-primary hover:underline"
                                                            href={KnownPages.ShoppingCart(
                                                                reservation.cartId,
                                                            )}
                                                        >
                                                            #
                                                            {reservation.cartId}
                                                        </Link>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {reservation.quantity}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {formatDateTime(
                                                            reservation.holdExpiresAt,
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {reservation.convertedAt
                                                            ? formatDateTime(
                                                                  reservation.convertedAt,
                                                              )
                                                            : '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </CardOverflow>
                    </Card>
                </Stack>

                <Stack spacing={4}>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl">Slike</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {offer.imageUrls.length === 0 ? (
                                <Typography level="body2" secondary>
                                    Slike nisu dodane.
                                </Typography>
                            ) : (
                                <Stack spacing={3}>
                                    {offer.imageUrls.map((imageUrl) => (
                                        <div
                                            className="relative aspect-video w-full overflow-hidden rounded-md border"
                                            key={imageUrl}
                                        >
                                            <Image
                                                alt={`Outlet ponuda ${offer.id}`}
                                                className="object-cover"
                                                fill
                                                sizes="(min-width: 1024px) 33vw, 100vw"
                                                src={imageUrl}
                                                unoptimized
                                            />
                                        </div>
                                    ))}
                                </Stack>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl">
                                Interne napomene
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Typography
                                level="body2"
                                secondary={!offer.adminNotes}
                                className="whitespace-pre-wrap"
                            >
                                {offer.adminNotes || 'Nema napomena.'}
                            </Typography>
                        </CardContent>
                    </Card>
                </Stack>
            </div>
        </Stack>
    );
}
