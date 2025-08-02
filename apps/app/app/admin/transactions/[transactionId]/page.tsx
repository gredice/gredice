import { getTransaction } from "@gredice/storage";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { KnownPages } from "../../../../src/KnownPages";
import { notFound } from "next/navigation";
import { Table } from "@signalco/ui-primitives/Table";
import { NoDataPlaceholder } from "../../../../components/shared/placeholders/NoDataPlaceholder";
import { LocaleDateTime } from "../../../../components/shared/LocaleDateTime";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function TransactionDetailsPage({ params }: { params: Promise<{ transactionId: string }> }) {
    const { transactionId } = await params;
    const transactionIdNumber = parseInt(transactionId, 10);
    if (isNaN(transactionIdNumber)) {
        return notFound();
    }
    const transaction = await getTransaction(transactionIdNumber);

    if (!transaction) {
        return notFound();
    }

    return (
        <Stack spacing={4}>
            <Stack spacing={2}>
                <Breadcrumbs items={[
                    { label: 'Transakcije', href: KnownPages.Transactions },
                    { label: transactionId }
                ]} />
                <Typography level="h1" className="text-2xl" semiBold>Detalji transakcije</Typography>
            </Stack>
            <Stack spacing={2}>
                <Row spacing={2} alignItems="center">
                    <Typography level="body1">ID: {transaction.id}</Typography>
                    <Typography level="body1">Tip: {transaction.status}</Typography>
                    <Typography level="body1">Iznos: €{(transaction.amount / 100).toFixed(2)}</Typography>
                    <Typography level="body1">Datum kreiranja: <LocaleDateTime>{transaction.createdAt}</LocaleDateTime></Typography>
                    {(transaction.invoices?.length || 0) === 0 ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-200">
                            ✨ Bez računa - dostupna za fakturiranje
                        </span>
                    ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                            📋 {transaction.invoices.length} račun{transaction.invoices.length > 1 ? 'a' : ''}
                        </span>
                    )}
                </Row>
            </Stack>
            <Card>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Broj računa</Table.Head>
                                <Table.Head>Status</Table.Head>
                                <Table.Head>Iznos</Table.Head>
                                <Table.Head>Datum izdavanja</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {transaction.invoices.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={4}>
                                        <NoDataPlaceholder>
                                            <Stack spacing={2} alignItems="center">
                                                <Typography>Nema povezanih računa</Typography>
                                                <span className="inline-flex px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800 border border-green-200">
                                                    ✨ Ova transakcija je dostupna za fakturiranje
                                                </span>
                                            </Stack>
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {transaction.invoices.map((invoice) => (
                                <Table.Row key={invoice.id}>
                                    <Table.Cell>
                                        <Link href={KnownPages.Invoice(invoice.id)}>
                                            {invoice.invoiceNumber}
                                        </Link>
                                    </Table.Cell>
                                    <Table.Cell>{invoice.status}</Table.Cell>
                                    <Table.Cell>{invoice.currency === 'EUR' ? '€' : invoice.currency} {invoice.totalAmount}</Table.Cell>
                                    <Table.Cell>
                                        <LocaleDateTime time={false}>{invoice.issueDate}</LocaleDateTime>
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