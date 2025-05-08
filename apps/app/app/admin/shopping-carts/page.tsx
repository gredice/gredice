import { getAllShoppingCarts } from "@gredice/storage";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Table } from "@signalco/ui-primitives/Table";
import { auth } from "../../../lib/auth/auth";
import { KnownPages } from "../../../src/KnownPages";
import Link from "next/link";
import { NoDataPlaceholder } from "../../../components/shared/placeholders/NoDataPlaceholder";
import { LocaleDateTime } from "../../../components/shared/LocaleDateTime";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Stack } from "@signalco/ui-primitives/Stack";

export const dynamic = 'force-dynamic';

export default async function ShoppingCartsPage() {
    await auth(['admin']);
    const shoppingCarts = await getAllShoppingCarts();

    return (
        <Stack spacing={2}>
            <Typography level="h1" className="text-2xl" semiBold>Košarice</Typography>
            <Card>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>ID</Table.Head>
                                <Table.Head>Račun</Table.Head>
                                <Table.Head>Datum isteka</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {shoppingCarts.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={3}>
                                        <NoDataPlaceholder>
                                            Nema košarica
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {shoppingCarts.map(cart => (
                                <Table.Row key={cart.id}>
                                    <Table.Cell>
                                        <Link href={KnownPages.ShoppingCart(cart.id)}>
                                            {cart.id}
                                        </Link>
                                    </Table.Cell>
                                    <Table.Cell>{cart.accountId}</Table.Cell>
                                    <Table.Cell title={cart.expiresAt.toISOString()}>
                                        <LocaleDateTime time={false}>
                                            {cart.expiresAt}
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