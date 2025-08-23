import { getAllTransactions } from "@gredice/storage";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Table } from "@signalco/ui-primitives/Table";
import { auth } from "../../../lib/auth/auth";
import { KnownPages } from "../../../src/KnownPages";
import Link from "next/link";
import { NoDataPlaceholder } from "../../../components/shared/placeholders/NoDataPlaceholder";
import { LocalDateTime } from "@gredice/ui/LocalDateTime";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { ExternalLink } from "@signalco/ui-icons";

export async function TransactionsTable({ accountId }: { accountId?: string }) {
    await auth(['admin']);
    const allTransactions = await getAllTransactions({ filter: { accountId } });

    // Sort transactions by newest first (createdAt descending)
    const transactions = (allTransactions || []).sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const hasAccountFilter = !!accountId;

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>ID</Table.Head>
                    {!hasAccountFilter && (
                        <Table.Head>Račun</Table.Head>
                    )}
                    <Table.Head>Status</Table.Head>
                    <Table.Head>Iznos</Table.Head>
                    <Table.Head>Ponude</Table.Head>
                    <Table.Head>Datum kreiranja</Table.Head>
                    <Table.Head>Stripe Payment ID</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {transactions.length === 0 && (
                    <Table.Row>
                        <Table.Cell colSpan={7}>
                            <NoDataPlaceholder>
                                Nema transakcija
                            </NoDataPlaceholder>
                        </Table.Cell>
                    </Table.Row>
                )}
                {transactions.map(transaction => {
                    const invoiceCount = transaction.invoices?.length || 0;
                    const hasNoInvoices = invoiceCount === 0;
                    const isTest = transaction.stripePaymentId?.startsWith('cs_test_') || false;

                    return (
                        <Table.Row key={transaction.id} className={hasNoInvoices ? 'bg-green-50 dark:bg-green-950' : ''}>
                            <Table.Cell>
                                <Link href={KnownPages.Transaction(transaction.id)}>
                                    {transaction.id}
                                </Link>
                            </Table.Cell>
                            {!hasAccountFilter && (
                                <Table.Cell>
                                    {transaction.accountId && (
                                        <Link href={KnownPages.Account(transaction.accountId)}>
                                            {transaction.accountId}
                                        </Link>
                                    )}
                                </Table.Cell>
                            )}
                            <Table.Cell>
                                <Chip color="info" className="w-fit">
                                    <Typography noWrap>
                                        {transaction.status}
                                    </Typography>
                                </Chip>
                            </Table.Cell>
                            <Table.Cell>
                                <Chip color="success" className="w-fit">
                                    <Typography noWrap>
                                        €{(transaction.amount / 100).toFixed(2)}
                                    </Typography>
                                </Chip>
                            </Table.Cell>
                            <Table.Cell>
                                <Row spacing={1}>
                                    {hasNoInvoices ? (
                                        <Chip color="error" className="w-fit">
                                            <Typography noWrap>
                                                Bez ponuda
                                            </Typography>
                                        </Chip>
                                    ) : (
                                        <Chip color="success" className="w-fit">
                                            <Typography noWrap>
                                                📋 {invoiceCount} ponuda
                                            </Typography>
                                        </Chip>
                                    )}
                                </Row>
                            </Table.Cell>
                            <Table.Cell>
                                <LocalDateTime time={false}>
                                    {transaction.createdAt}
                                </LocalDateTime>
                            </Table.Cell>
                            <Table.Cell>
                                {transaction.stripePaymentId ? (
                                    <Link href={KnownPages.StripePayment(transaction.stripePaymentId)}>
                                        <Chip
                                            className="w-fit"
                                            color={isTest ? 'warning' : 'neutral'}
                                            startDecorator={<ExternalLink className="size-4" />}>
                                            Stripe{isTest && ' (test)'}
                                        </Chip>
                                    </Link>
                                ) : (
                                    <Typography level="body3">Nema Stripe poveznicu</Typography>
                                )}
                            </Table.Cell>
                        </Table.Row>
                    );
                })}
            </Table.Body>
        </Table>
    )
}