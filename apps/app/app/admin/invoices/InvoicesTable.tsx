import { getAllInvoices } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { ExternalLink } from '@signalco/ui-icons';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { KnownPages } from '../../../src/KnownPages';

function getStatusColor(status: string) {
    switch (status) {
        case 'draft':
            return 'neutral';
        case 'pending':
            return 'warning';
        case 'sent':
            return 'info';
        case 'paid':
            return 'success';
        case 'overdue':
            return 'error';
        case 'cancelled':
            return 'neutral';
        default:
            return 'neutral';
    }
}

function getStatusLabel(status: string) {
    switch (status) {
        case 'draft':
            return 'Nacrt';
        case 'pending':
            return 'Na čekanju';
        case 'sent':
            return 'Poslan';
        case 'paid':
            return 'Plaćen';
        case 'overdue':
            return 'Dospio';
        case 'cancelled':
            return 'Otkazan';
        default:
            return status;
    }
}

export async function InvoicesTable({
    transactionId,
}: {
    transactionId?: number;
}) {
    const invoices = await getAllInvoices({ transactionId });

    return (
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
                            <NoDataPlaceholder>Nema ponuda</NoDataPlaceholder>
                        </Table.Cell>
                    </Table.Row>
                )}
                {invoices.map((invoice) => (
                    <Table.Row key={invoice.id}>
                        <Table.Cell>
                            <Link href={KnownPages.Invoice(invoice.id)}>
                                {invoice.invoiceNumber}
                            </Link>
                        </Table.Cell>
                        <Table.Cell>
                            <div>
                                <Typography>{invoice.billToName}</Typography>
                                <Typography level="body2">
                                    {invoice.billToEmail}
                                </Typography>
                            </div>
                        </Table.Cell>
                        <Table.Cell>
                            <Chip
                                color={getStatusColor(invoice.status)}
                                className="w-fit"
                            >
                                {getStatusLabel(invoice.status)}
                            </Chip>
                        </Table.Cell>
                        <Table.Cell>
                            <Chip color="success" className="w-fit">
                                {invoice.totalAmount}
                                {invoice.currency === 'eur'
                                    ? '€'
                                    : invoice.currency}
                            </Chip>
                        </Table.Cell>
                        <Table.Cell>
                            <LocalDateTime time={false}>
                                {invoice.issueDate}
                            </LocalDateTime>
                        </Table.Cell>
                        <Table.Cell>
                            <LocalDateTime time={false}>
                                {invoice.dueDate}
                            </LocalDateTime>
                        </Table.Cell>
                        <Table.Cell>
                            {invoice.transactionId ? (
                                <Link
                                    href={KnownPages.Transaction(
                                        invoice.transactionId,
                                    )}
                                >
                                    <Chip
                                        startDecorator={
                                            <ExternalLink className="size-4 shrink-0" />
                                        }
                                        className="w-fit"
                                    >
                                        #{invoice.transactionId}
                                    </Chip>
                                </Link>
                            ) : (
                                <NoDataPlaceholder>
                                    Nema transakcije
                                </NoDataPlaceholder>
                            )}
                        </Table.Cell>
                    </Table.Row>
                ))}
            </Table.Body>
        </Table>
    );
}
