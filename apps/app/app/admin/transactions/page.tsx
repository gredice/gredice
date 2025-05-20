import { getAllTransactions } from "@gredice/storage";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Table } from "@signalco/ui-primitives/Table";
import { auth } from "../../../lib/auth/auth";
import { KnownPages } from "../../../src/KnownPages";
import Link from "next/link";
import { NoDataPlaceholder } from "../../../components/shared/placeholders/NoDataPlaceholder";
import { LocaleDateTime } from "../../../components/shared/LocaleDateTime";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";

export const dynamic = 'force-dynamic';

export default async function TransactionsPage() {
    await auth(['admin']);
    const transactions = await getAllTransactions();

    return (
        <Stack spacing={2}>
            <Row spacing={1}>
                <Typography level="h1" className="text-2xl" semiBold>{"Transakcije"}</Typography>
                <Chip color="primary" size="sm">{transactions.length}</Chip>
            </Row>
            <Card>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>ID</Table.Head>
                                <Table.Head>Status</Table.Head>
                                <Table.Head>Iznos</Table.Head>
                                <Table.Head>Datum kreiranja</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {transactions.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={4}>
                                        <NoDataPlaceholder>
                                            Nema transakcija
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {transactions.map(transaction => (
                                <Table.Row key={transaction.id}>
                                    <Table.Cell>
                                        <Link href={KnownPages.Transaction(transaction.id)}>
                                            {transaction.id}
                                        </Link>
                                    </Table.Cell>
                                    <Table.Cell>{transaction.status}</Table.Cell>
                                    <Table.Cell>{transaction.amount}</Table.Cell>
                                    <Table.Cell title={transaction.createdAt.toISOString()}>
                                        <LocaleDateTime time={false}>
                                            {transaction.createdAt}
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