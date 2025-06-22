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
import { Chip } from "@signalco/ui-primitives/Chip";

export const dynamic = 'force-dynamic';

export default async function ShoppingCartsPage() {
    await auth(['admin']);
    const shoppingCarts = await getAllShoppingCarts({ status: null });

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
                                <Table.Head>Korisnik</Table.Head>
                                <Table.Head>Broj stavki</Table.Head>
                                <Table.Head>Status</Table.Head>
                                <Table.Head>Datum kreiranja</Table.Head>
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
                            {shoppingCarts.map(cart => {
                                const user = cart.account.accountUsers.at(0)?.user;
                                return (
                                    <Table.Row key={cart.id}>
                                        <Table.Cell>
                                            <Link href={KnownPages.ShoppingCart(cart.id)}>
                                                {cart.id}
                                            </Link>
                                        </Table.Cell>
                                        <Table.Cell>{cart.accountId}</Table.Cell>
                                        <Table.Cell>
                                            {user ? (
                                                <Link href={KnownPages.User(user.id)}>
                                                    {user.displayName || user.userName}
                                                </Link>
                                            ) : (
                                                <span className="text-gray-500">Nema korisnika</span>
                                            )}
                                        </Table.Cell>
                                        <Table.Cell>
                                            {cart.items.length}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Chip className="w-fit" color={cart.status === 'paid' ? 'success' : 'neutral'}>
                                                {cart.status === 'paid' ? 'Plaćena' : (cart.status === 'new' ? 'Nova' : cart.status)}
                                            </Chip>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <LocaleDateTime time={false}>
                                                {cart.createdAt}
                                            </LocaleDateTime>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <LocaleDateTime time={false}>
                                                {cart.expiresAt}
                                            </LocaleDateTime>
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            })}
                        </Table.Body>
                    </Table>
                </CardOverflow>
            </Card>
        </Stack>
    );
}