import { getInvoice } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { InvoiceActions } from './InvoiceActions';
import { isOverdue } from './invoiceUtils';

export const dynamic = 'force-dynamic';

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

export default async function InvoicePage({
    params,
}: PageProps<'/admin/invoices/[invoiceId]'>) {
    await auth(['admin']);

    const { invoiceId: invoiceIdString } = await params;
    const invoiceId = parseInt(invoiceIdString, 10);
    if (Number.isNaN(invoiceId)) {
        notFound();
    }

    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
        notFound();
    }

    return (
        <Stack spacing={4}>
            <Breadcrumbs
                items={[
                    { label: 'Ponude', href: KnownPages.Invoices },
                    { label: `${invoice.invoiceNumber}` },
                ]}
            />
            <Stack spacing={2}>
                <Row spacing={2} justifyContent="space-between">
                    <Typography level="h1">
                        Ponuda {invoice.invoiceNumber}
                    </Typography>
                    <InvoiceActions invoice={invoice} />
                </Row>

                <Row spacing={2} alignItems="stretch">
                    <Stack spacing={2} className="flex-1">
                        {/* Invoice Details */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Podaci o ponudi</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Stack spacing={2}>
                                    <Row spacing={4}>
                                        <Stack spacing={1} className="flex-1">
                                            <Typography level="body2">
                                                Broj ponude
                                            </Typography>
                                            <Typography>
                                                {invoice.invoiceNumber}
                                            </Typography>
                                        </Stack>
                                        <Stack spacing={1} className="flex-1">
                                            <Typography level="body2">
                                                Valuta
                                            </Typography>
                                            <Typography>
                                                {invoice.currency}
                                            </Typography>
                                        </Stack>
                                    </Row>
                                    <Row spacing={4}>
                                        <Stack spacing={1} className="flex-1">
                                            <Typography level="body2">
                                                Datum izdavanja
                                            </Typography>
                                            <LocalDateTime time={false}>
                                                {invoice.issueDate}
                                            </LocalDateTime>
                                        </Stack>
                                        <Stack spacing={1} className="flex-1">
                                            <Typography level="body2">
                                                Datum dospijeća
                                            </Typography>
                                            <LocalDateTime time={false}>
                                                {invoice.dueDate}
                                            </LocalDateTime>
                                        </Stack>
                                    </Row>
                                    {invoice.notes && (
                                        <Stack spacing={1}>
                                            <Typography level="body2">
                                                Napomene
                                            </Typography>
                                            <Typography>
                                                {invoice.notes}
                                            </Typography>
                                        </Stack>
                                    )}
                                    <Stack spacing={1} className="flex-1">
                                        <Typography level="body2">
                                            Status
                                        </Typography>
                                        <Row spacing={2}>
                                            <Chip
                                                color={getStatusColor(
                                                    invoice.status,
                                                )}
                                            >
                                                {getStatusLabel(invoice.status)}
                                            </Chip>
                                            {isOverdue(invoice) && (
                                                <Chip color="error">
                                                    Dospio
                                                </Chip>
                                            )}
                                        </Row>
                                    </Stack>
                                </Stack>
                            </CardContent>
                        </Card>

                        {/* Billing Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Podaci o kupcu</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Stack spacing={2}>
                                    <Stack spacing={1}>
                                        <Typography level="body2">
                                            Naziv
                                        </Typography>
                                        <Typography>
                                            {invoice.billToName}
                                        </Typography>
                                    </Stack>
                                    {invoice.billToEmail && (
                                        <Stack spacing={1}>
                                            <Typography level="body2">
                                                Email
                                            </Typography>
                                            <Typography>
                                                {invoice.billToEmail}
                                            </Typography>
                                        </Stack>
                                    )}
                                    {invoice.billToAddress && (
                                        <Stack spacing={1}>
                                            <Typography level="body2">
                                                Adresa
                                            </Typography>
                                            <Typography className="whitespace-pre-line">
                                                {invoice.billToAddress}
                                            </Typography>
                                        </Stack>
                                    )}
                                </Stack>
                            </CardContent>
                        </Card>
                    </Stack>

                    <Stack spacing={2} className="flex-1">
                        {/* Amount Summary */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Iznosi</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Stack spacing={2}>
                                    <Row justifyContent="space-between">
                                        <Typography level="body2">
                                            Osnovica
                                        </Typography>
                                        <Typography>
                                            {invoice.subtotal}
                                            {invoice.currency === 'eur'
                                                ? '€'
                                                : invoice.currency}
                                        </Typography>
                                    </Row>
                                    <Row justifyContent="space-between">
                                        <Typography level="body2">
                                            PDV
                                        </Typography>
                                        <Typography>
                                            {invoice.taxAmount}
                                            {invoice.currency === 'eur'
                                                ? '€'
                                                : invoice.currency}
                                        </Typography>
                                    </Row>
                                    <Row
                                        justifyContent="space-between"
                                        className="border-t pt-2"
                                    >
                                        <Typography semiBold>Ukupno</Typography>
                                        <Typography level="h3" semiBold>
                                            {invoice.totalAmount}
                                            {invoice.currency === 'eur'
                                                ? '€'
                                                : invoice.currency}
                                        </Typography>
                                    </Row>
                                </Stack>
                            </CardContent>
                        </Card>

                        {/* Related Links */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Povezano</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Stack spacing={2}>
                                    {!invoice.transactionId && (
                                        <NoDataPlaceholder>
                                            Nema povezanih stavki
                                        </NoDataPlaceholder>
                                    )}
                                    {invoice.transactionId && (
                                        <Row spacing={2}>
                                            <Typography
                                                level="body2"
                                                className="w-20"
                                            >
                                                Transakcija:
                                            </Typography>
                                            <Link
                                                href={KnownPages.Transaction(
                                                    invoice.transactionId,
                                                )}
                                            >
                                                #{invoice.transactionId}
                                            </Link>
                                        </Row>
                                    )}
                                </Stack>
                            </CardContent>
                        </Card>
                    </Stack>
                </Row>

                {/* Invoice Items */}
                {invoice.invoiceItems && invoice.invoiceItems.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Stavke ponude</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.Head>Opis</Table.Head>
                                        <Table.Head className="text-right">
                                            Količina
                                        </Table.Head>
                                        <Table.Head className="text-right">
                                            Jedinična cijena
                                        </Table.Head>
                                        <Table.Head className="text-right">
                                            Ukupno
                                        </Table.Head>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {invoice.invoiceItems.map((item) => (
                                        <Table.Row key={item.id}>
                                            <Table.Cell>
                                                <Typography>
                                                    {item.description}
                                                </Typography>
                                            </Table.Cell>
                                            <Table.Cell className="text-right">
                                                <Typography>
                                                    {item.quantity} kom
                                                </Typography>
                                            </Table.Cell>
                                            <Table.Cell className="text-right">
                                                <Typography>
                                                    {Number(
                                                        item.unitPrice,
                                                    ).toFixed(2)}
                                                    {invoice.currency === 'eur'
                                                        ? '€'
                                                        : invoice.currency}
                                                </Typography>
                                            </Table.Cell>
                                            <Table.Cell className="text-right">
                                                <Typography>
                                                    {Number(
                                                        item.totalPrice,
                                                    ).toFixed(2)}
                                                    {invoice.currency === 'eur'
                                                        ? '€'
                                                        : invoice.currency}
                                                </Typography>
                                            </Table.Cell>
                                        </Table.Row>
                                    ))}
                                </Table.Body>
                            </Table>
                        </CardContent>
                    </Card>
                )}
            </Stack>
        </Stack>
    );
}
