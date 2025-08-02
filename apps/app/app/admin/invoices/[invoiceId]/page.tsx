import { getInvoice } from "@gredice/storage";
import { Card, CardContent, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Table } from "@signalco/ui-primitives/Table";
import { auth } from "../../../../lib/auth/auth";
import { KnownPages } from "../../../../src/KnownPages";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocaleDateTime } from "../../../../components/shared/LocaleDateTime";
import { InvoiceActions } from "./InvoiceActions";
import { isOverdue } from "./invoiceUtils";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";

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

export default async function InvoicePage({ params }: { params: { invoiceId: string } }) {
    await auth(['admin']);

    const invoiceId = parseInt(params.invoiceId);
    if (isNaN(invoiceId)) {
        notFound();
    }

    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
        notFound();
    }

    return (
        <Stack spacing={4}>
            <Breadcrumbs items={[
                { label: 'Ponude', href: KnownPages.Invoices },
                { label: `${invoice.invoiceNumber}` }
            ]} />
            <Stack spacing={2}>
                <Row spacing={2} alignItems="center" justifyContent="space-between">
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
                                            <Typography level="body2" className="text-gray-600">Broj ponude</Typography>
                                            <Typography>{invoice.invoiceNumber}</Typography>
                                        </Stack>
                                        <Stack spacing={1} className="flex-1">
                                            <Typography level="body2" className="text-gray-600">Valuta</Typography>
                                            <Typography>{invoice.currency}</Typography>
                                        </Stack>
                                    </Row>
                                    <Row spacing={4}>
                                        <Stack spacing={1} className="flex-1">
                                            <Typography level="body2" className="text-gray-600">Datum izdavanja</Typography>
                                            <LocaleDateTime time={false}>{invoice.issueDate}</LocaleDateTime>
                                        </Stack>
                                        <Stack spacing={1} className="flex-1">
                                            <Typography level="body2" className="text-gray-600">Datum dospijeća</Typography>
                                            <LocaleDateTime time={false}>{invoice.dueDate}</LocaleDateTime>
                                        </Stack>
                                    </Row>
                                    {invoice.notes && (
                                        <Stack spacing={1}>
                                            <Typography level="body2" className="text-gray-600">Napomene</Typography>
                                            <Typography>{invoice.notes}</Typography>
                                        </Stack>
                                    )}
                                    <Stack spacing={1} className="flex-1">
                                        <Typography level="body2" className="text-gray-600">Status</Typography>
                                        <Row spacing={2} alignItems="center">
                                            <Chip color={getStatusColor(invoice.status)} size="sm">
                                                {getStatusLabel(invoice.status)}
                                            </Chip>
                                            {isOverdue(invoice) && (
                                                <Chip color="error" size="sm">
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
                                        <Typography level="body2" className="text-gray-600">Naziv</Typography>
                                        <Typography>{invoice.billToName}</Typography>
                                    </Stack>
                                    {invoice.billToEmail && (
                                        <Stack spacing={1}>
                                            <Typography level="body2" className="text-gray-600">Email</Typography>
                                            <Typography>{invoice.billToEmail}</Typography>
                                        </Stack>
                                    )}
                                    {invoice.billToAddress && (
                                        <Stack spacing={1}>
                                            <Typography level="body2" className="text-gray-600">Adresa</Typography>
                                            <Typography className="whitespace-pre-line">{invoice.billToAddress}</Typography>
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
                                        <Typography level="body2" className="text-gray-600">Osnovica</Typography>
                                        <Typography>{invoice.subtotal}{invoice.currency === 'eur' ? '€' : invoice.currency}</Typography>
                                    </Row>
                                    <Row justifyContent="space-between">
                                        <Typography level="body2" className="text-gray-600">PDV</Typography>
                                        <Typography>{invoice.taxAmount}{invoice.currency === 'eur' ? '€' : invoice.currency}</Typography>
                                    </Row>
                                    <Row justifyContent="space-between" className="border-t pt-2">
                                        <Typography semiBold>Ukupno</Typography>
                                        <Typography level="h3" semiBold>{invoice.totalAmount}{invoice.currency === 'eur' ? '€' : invoice.currency}</Typography>
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
                                    {invoice.transactionId && (
                                        <Row spacing={2} alignItems="center">
                                            <Typography level="body2" className="w-20">Transakcija:</Typography>
                                            <Link href={KnownPages.Transaction(invoice.transactionId)}>
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
                                        <Table.Head className="text-right">Količina</Table.Head>
                                        <Table.Head className="text-right">Jedinična cijena</Table.Head>
                                        <Table.Head className="text-right">Ukupno</Table.Head>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {invoice.invoiceItems.map((item, index) => (
                                        <Table.Row key={index}>
                                            <Table.Cell>
                                                <Typography>{item.description}</Typography>
                                            </Table.Cell>
                                            <Table.Cell className="text-right">
                                                <Typography>{item.quantity} kom</Typography>
                                            </Table.Cell>
                                            <Table.Cell className="text-right">
                                                <Typography>{item.unitPrice}{invoice.currency === 'eur' ? '€' : invoice.currency}</Typography>
                                            </Table.Cell>
                                            <Table.Cell className="text-right">
                                                <Typography>{item.totalPrice}{invoice.currency === 'eur' ? '€' : invoice.currency}</Typography>
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
