import { getInvoice } from "@gredice/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
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
        <Stack spacing={2}>
            <Row spacing={2} alignItems="center" justifyContent="space-between">
                <div>
                    <Typography level="h1" className="text-2xl" semiBold>
                        Ponuda {invoice.invoiceNumber}
                    </Typography>
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
                </div>
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
                                    <Typography>{invoice.currency === 'EUR' ? '€' : invoice.currency} {invoice.subtotal}</Typography>
                                </Row>
                                <Row justifyContent="space-between">
                                    <Typography level="body2" className="text-gray-600">PDV</Typography>
                                    <Typography>{invoice.currency === 'EUR' ? '€' : invoice.currency} {invoice.taxAmount}</Typography>
                                </Row>
                                <Row justifyContent="space-between" className="border-t pt-2">
                                    <Typography semiBold>Ukupno</Typography>
                                    <Typography level="h3" semiBold>{invoice.currency === 'EUR' ? '€' : invoice.currency} {invoice.totalAmount}</Typography>
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
                                    <Table.Head className="text-right">PDV stopa</Table.Head>
                                    <Table.Head className="text-right">Ukupno</Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {invoice.invoiceItems.map((item: any, index: number) => (
                                    <Table.Row key={index}>
                                        <Table.Cell>
                                            <div>
                                                <Typography>{item.description}</Typography>
                                                {item.sku && (
                                                    <Typography level="body2" className="text-gray-600">SKU: {item.sku}</Typography>
                                                )}
                                            </div>
                                        </Table.Cell>
                                        <Table.Cell className="text-right">
                                            <Typography>{item.quantity} {item.unit || 'kom'}</Typography>
                                        </Table.Cell>
                                        <Table.Cell className="text-right">
                                            <Typography>{invoice.currency === 'eur' ? '€' : invoice.currency} {item.unitPrice}</Typography>
                                        </Table.Cell>
                                        <Table.Cell className="text-right">
                                            <Typography>{item.taxRate ? `${item.taxRate}%` : '0%'}</Typography>
                                        </Table.Cell>
                                        <Table.Cell className="text-right">
                                            <Typography>{invoice.currency === 'eur' ? '€' : invoice.currency} {item.totalPrice}</Typography>
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </Stack>
    );
}
