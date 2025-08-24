import { getAllShoppingCarts } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';

export async function ShoppingCartsTable({
    accountId,
}: {
    accountId?: string;
}) {
    await auth(['admin']);
    const allShoppingCarts = await getAllShoppingCarts({
        status: null,
        filter: { accountId },
    });

    // Sort shopping carts by newest first (updatedAt descending)
    const shoppingCarts = (allShoppingCarts || []).sort(
        (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    const hasAccountFilter = !!accountId;

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>ID</Table.Head>
                    <Table.Head>Račun</Table.Head>
                    {!hasAccountFilter && <Table.Head>Korisnik</Table.Head>}
                    <Table.Head>Broj stavki</Table.Head>
                    <Table.Head>Status</Table.Head>
                    <Table.Head>Datum izmjene</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {shoppingCarts.length === 0 && (
                    <Table.Row>
                        <Table.Cell colSpan={3}>
                            <NoDataPlaceholder>Nema košarica</NoDataPlaceholder>
                        </Table.Cell>
                    </Table.Row>
                )}
                {shoppingCarts.map((cart) => {
                    const user = cart.account?.accountUsers.at(0)?.user;
                    return (
                        <Table.Row key={cart.id}>
                            <Table.Cell>
                                <Link href={KnownPages.ShoppingCart(cart.id)}>
                                    {cart.id}
                                </Link>
                            </Table.Cell>
                            {!hasAccountFilter && (
                                <Table.Cell>
                                    {cart.accountId ? (
                                        <Link
                                            href={KnownPages.Account(
                                                cart.accountId,
                                            )}
                                        >
                                            {cart.accountId.slice(0, 6)}...
                                        </Link>
                                    ) : (
                                        <Typography level="body2">
                                            Nema računa
                                        </Typography>
                                    )}
                                </Table.Cell>
                            )}
                            <Table.Cell>
                                {user ? (
                                    <Link href={KnownPages.User(user.id)}>
                                        {user.displayName || user.userName}
                                    </Link>
                                ) : (
                                    <span className="text-gray-500">
                                        Nema korisnika
                                    </span>
                                )}
                            </Table.Cell>
                            <Table.Cell>
                                <Chip className="w-fit">
                                    {cart.items.length} stavke
                                </Chip>
                            </Table.Cell>
                            <Table.Cell>
                                <Chip
                                    className="w-fit"
                                    color={
                                        cart.status === 'paid'
                                            ? 'success'
                                            : 'neutral'
                                    }
                                >
                                    {cart.status === 'paid'
                                        ? 'Plaćena'
                                        : cart.status === 'new'
                                          ? 'Nova'
                                          : cart.status}
                                </Chip>
                            </Table.Cell>
                            <Table.Cell>
                                <LocalDateTime time={false}>
                                    {cart.updatedAt}
                                </LocalDateTime>
                            </Table.Cell>
                        </Table.Row>
                    );
                })}
            </Table.Body>
        </Table>
    );
}