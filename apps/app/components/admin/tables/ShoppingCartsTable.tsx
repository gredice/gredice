import { getAllShoppingCarts } from "@gredice/storage";
import { Table } from "@signalco/ui-primitives/Table";
import { auth } from "../../../lib/auth/auth";
import { KnownPages } from "../../../src/KnownPages";
import Link from "next/link";
import { NoDataPlaceholder } from "../../shared/placeholders/NoDataPlaceholder";
import { LocaleDateTime } from "../../shared/LocaleDateTime";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Typography } from "@signalco/ui-primitives/Typography";

export async function ShoppingCartsTable({ accountId }: { accountId?: string }) {
    await auth(['admin']);
    const shoppingCarts = await getAllShoppingCarts(accountId);

    if (shoppingCarts.length === 0) {
        return <NoDataPlaceholder />;
    }

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>ID</Table.Head>
                    <Table.Head>Račun</Table.Head>
                    <Table.Head>Status</Table.Head>
                    <Table.Head>Ukupno stavki</Table.Head>
                    <Table.Head>Stvoren</Table.Head>
                    <Table.Head>Ažuriran</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {shoppingCarts.map(cart => (
                    <Table.Row key={cart.id}>
                        <Table.Cell>
                            <Link href={KnownPages.ShoppingCartDetails(cart.id)}>
                                <Typography>{cart.id}</Typography>
                            </Link>
                        </Table.Cell>
                        <Table.Cell>
                            <Link href={KnownPages.AccountDetails(cart.accountId)}>
                                <Typography>{cart.accountId}</Typography>
                            </Link>
                        </Table.Cell>
                        <Table.Cell>
                            <Chip color={cart.status === 'active' ? 'success' : 'neutral'}>
                                {cart.status === 'active' ? 'Aktivna' : 'Neaktivna'}
                            </Chip>
                        </Table.Cell>
                        <Table.Cell>{cart.totalItems}</Table.Cell>
                        <Table.Cell>
                            <Typography secondary>
                                <LocaleDateTime>{cart.createdAt}</LocaleDateTime>
                            </Typography>
                        </Table.Cell>
                        <Table.Cell>
                            <Typography secondary>
                                <LocaleDateTime>{cart.updatedAt}</LocaleDateTime>
                            </Typography>
                        </Table.Cell>
                    </Table.Row>
                ))}
            </Table.Body>
        </Table>
    );
}
