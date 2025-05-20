import { Card, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { Table } from "@signalco/ui-primitives/Table";
import { NoDataPlaceholder } from "../../../../components/shared/placeholders/NoDataPlaceholder";
import { LocaleDateTime } from "../../../../components/shared/LocaleDateTime";
import { getTransactions } from "@gredice/storage";

export async function AccountTransactionsCard({ accountId }: { accountId: string }) {
    const transactions = await getTransactions(accountId);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Transakcije</CardTitle>
            </CardHeader>
            <CardOverflow>
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>ID</Table.Head>
                            <Table.Head>Iznos</Table.Head>
                            <Table.Head>Valuta</Table.Head>
                            <Table.Head>Status</Table.Head>
                            <Table.Head>Datum</Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {transactions.length === 0 && (
                            <Table.Row>
                                <Table.Cell colSpan={5}>
                                    <NoDataPlaceholder>
                                        Nema transakcija
                                    </NoDataPlaceholder>
                                </Table.Cell>
                            </Table.Row>
                        )}
                        {transactions.map(transaction => (
                            <Table.Row key={transaction.id}>
                                <Table.Cell>{transaction.id}</Table.Cell>
                                <Table.Cell>{transaction.amount}</Table.Cell>
                                <Table.Cell>{transaction.currency}</Table.Cell>
                                <Table.Cell>{transaction.status}</Table.Cell>
                                <Table.Cell title={transaction.createdAt.toISOString()}>
                                    <LocaleDateTime>
                                        {transaction.createdAt}
                                    </LocaleDateTime>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </CardOverflow>
        </Card>
    );
}