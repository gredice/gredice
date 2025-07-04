import { getEntitiesFormatted, getShoppingCart } from "@gredice/storage";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Table } from "@signalco/ui-primitives/Table";
import { auth } from "../../../../lib/auth/auth";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { KnownPages } from "../../../../src/KnownPages";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { NoDataPlaceholder } from "../../../../components/shared/placeholders/NoDataPlaceholder";
import { notFound } from "next/navigation";
import { LocaleDateTime } from "../../../../components/shared/LocaleDateTime";
import { EntityStandardized } from "../../../../lib/@types/EntityStandardized";

export const dynamic = 'force-dynamic';

export default async function ShoppingCartDetailsPage({ params }: { params: { cartId: number; } }) {
    const { cartId } = params;
    await auth(['admin']);
    const cart = await getShoppingCart(cartId);
    if (!cart) {
        notFound();
    }

    const plantSorts = await getEntitiesFormatted('plantSort') as EntityStandardized[];

    return (
        <Stack spacing={4}>
            <Stack spacing={2}>
                <Breadcrumbs items={[
                    { label: 'Košarice', href: KnownPages.ShoppingCarts },
                    { label: `Košarica ${cartId}` }
                ]} />
                <Typography level="h1" className="text-2xl" semiBold>Detalji košarice</Typography>
            </Stack>
            <Card>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Entitet</Table.Head>
                                <Table.Head>Količina</Table.Head>
                                <Table.Head>Status</Table.Head>
                                <Table.Head>Vrt | Gredica | Pozicija</Table.Head>
                                <Table.Head>Stvoreno</Table.Head>
                                <Table.Head>Ažurirano</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {cart.items.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={3}>
                                        <NoDataPlaceholder>
                                            Nema stavki u košarici
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {cart.items.map(item => (
                                <Table.Row key={item.id}>
                                    <Table.Cell>
                                        {item.entityTypeName === 'plantSort' && plantSorts.find((sort) => sort.id?.toString() === item.entityId)
                                            ? <span>{plantSorts.find(sort => sort.id?.toString() === item.entityId)?.information?.name}</span>
                                            : <span>{item.entityTypeName} | {item.entityId}</span>}
                                    </Table.Cell>
                                    <Table.Cell>{item.amount}</Table.Cell>
                                    <Table.Cell>{item.status}</Table.Cell>
                                    <Table.Cell>
                                        {item.gardenId ? `Vrt ${item.gardenId}` : ''}
                                        {item.raisedBedId ? ` | Gredica ${item.raisedBedId}` : ''}
                                        {typeof item.positionIndex === 'number' ? ` | Pozicija ${item.positionIndex}` : ''}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <LocaleDateTime>
                                            {item.createdAt}
                                        </LocaleDateTime>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <LocaleDateTime>
                                            {item.updatedAt}
                                        </LocaleDateTime>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </CardOverflow>
            </Card>
        </Stack>
    );
}