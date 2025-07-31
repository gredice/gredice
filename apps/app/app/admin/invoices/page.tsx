import { getAllInvoices } from "@gredice/storage";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Table } from "@signalco/ui-primitives/Table";
import { Button } from "@signalco/ui-primitives/Button";
import { auth } from "../../../lib/auth/auth";
import { KnownPages } from "../../../src/KnownPages";
import Link from "next/link";
import { NoDataPlaceholder } from "../../../components/shared/placeholders/NoDataPlaceholder";
import { LocaleDateTime } from "../../../components/shared/LocaleDateTime";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";

export const dynamic = 'force-dynamic';

function getStatusColor(status: string) {
    switch (status) {
        case 'draft': return 'neutral';
        case 'pending': return 'warning';
        case 'sent': return 'info';
        case 'paid': return 'success';
        case 'overdue': return 'error';
        case 'cancelled': return 'neutral';
        default: return 'neutral';
    }
}

function getStatusLabel(status: string) {
    switch (status) {
        case 'draft': return 'Nacrt';
        case 'pending': return 'Na čekanju';
        case 'sent': return 'Poslan';
        case 'paid': return 'Plaćen';
        case 'overdue': return 'Dospio';
        case 'cancelled': return 'Otkazan';
        default: return status;
    }
}

export default async function InvoicesPage() {
    await auth(['admin']);
    const invoices = await getAllInvoices();

    return (
        <Stack spacing={2}>
            <Row spacing={1} justifyContent="space-between" alignItems="center">
                <Row spacing={1}>
                    <Typography level="h1" className="text-2xl" semiBold>Ponude</Typography>
                    <Chip color="primary" size="sm">{invoices.length}</Chip>
                </Row>
                <Link href={KnownPages.CreateInvoice}>
                    <Button variant="solid" color="primary">
                        Nova ponuda
                    </Button>
                </Link>
            </Row>
            <Card>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Broj ponude</Table.Head>
                                <Table.Head>Klijent</Table.Head>
                                <Table.Head>Status</Table.Head>
                                <Table.Head>Iznos</Table.Head>
                                <Table.Head>Datum izdavanja</Table.Head>
                                <Table.Head>Datum dospijeća</Table.Head>
                                <Table.Head>Transakcija</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {invoices.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={7}>
                                        <NoDataPlaceholder>
                                            Nema ponuda
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {invoices.map(invoice => (
                                <Table.Row key={invoice.id}>
                                    <Table.Cell>
                                        <Link href={KnownPages.Invoice(invoice.id)}>
                                            {invoice.invoiceNumber}
                                        </Link>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <div>
                                            <div className="font-medium">{invoice.billToName}</div>
                                            <div className="text-sm text-gray-500">{invoice.billToEmail}</div>
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Chip color={getStatusColor(invoice.status)} size="sm" className="w-fit">
                                            <Typography noWrap>
                                                {getStatusLabel(invoice.status)}
                                            </Typography>
                                        </Chip>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Chip color="success" size="sm" className="w-fit">
                                            <Typography noWrap>
                                                {invoice.currency === 'EUR' ? '€' : invoice.currency} {invoice.totalAmount}
                                            </Typography>
                                        </Chip>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <LocaleDateTime time={false}>
                                            {invoice.issueDate}
                                        </LocaleDateTime>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <LocaleDateTime time={false}>
                                            {invoice.dueDate}
                                        </LocaleDateTime>
                                    </Table.Cell>
                                    <Table.Cell>
                                        {invoice.transactionId ? (
                                            <Link href={KnownPages.Transaction(invoice.transactionId)}>
                                                {invoice.transactionId}
                                            </Link>
                                        ) : (
                                            <span className="text-gray-500">Nema transakcije</span>
                                        )}
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
