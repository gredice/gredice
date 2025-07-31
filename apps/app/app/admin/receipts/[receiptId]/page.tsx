import { getReceipt } from "@gredice/storage";
import { Card, CardContent, CardHeader } from "@signalco/ui-primitives/Card";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Chip } from "@signalco/ui-primitives/Chip";
import { auth } from "../../../../lib/auth/auth";
import { KnownPages } from "../../../../src/KnownPages";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocaleDateTime } from "../../../../components/shared/LocaleDateTime";

export const dynamic = 'force-dynamic';

function getCisStatusColor(cisStatus: string) {
    switch (cisStatus) {
        case 'sent': return 'success';
        case 'pending': return 'warning';
        case 'failed': return 'error';
        default: return 'neutral';
    }
}

function getCisStatusLabel(cisStatus: string) {
    switch (cisStatus) {
        case 'sent': return 'Poslano';
        case 'pending': return 'Na čekanju';
        case 'failed': return 'Neuspješno';
        default: return cisStatus;
    }
}

export default async function ReceiptPage({ params }: { params: { receiptId: string } }) {
    await auth(['admin']);

    const receiptId = parseInt(params.receiptId);
    if (isNaN(receiptId)) {
        notFound();
    }

    const receipt = await getReceipt(receiptId);
    if (!receipt) {
        notFound();
    }

    return (
        <Stack spacing={2}>
            <Row spacing={2} alignItems="center">
                <Typography level="h1" className="text-2xl" semiBold>
                    Fiskalni račun #{receipt.id}
                </Typography>
                <Chip color={getCisStatusColor(receipt.cisStatus)} size="sm">
                    {getCisStatusLabel(receipt.cisStatus)}
                </Chip>
            </Row>

            <Row spacing={2} alignItems="stretch">
                <Stack spacing={2} className="flex-1">
                    {/* Receipt Details */}
                    <Card>
                        <CardHeader>
                            <Typography level="h2" semiBold>Fiskalni podaci</Typography>
                        </CardHeader>
                        <CardContent>
                            <Stack spacing={2}>
                                <Row spacing={4}>
                                    <Stack spacing={1} className="flex-1">
                                        <Typography level="body2" className="text-gray-600">JIR (Jedinstveni identifikator računa)</Typography>
                                        <Typography className="font-mono">{receipt.jir || 'N/A'}</Typography>
                                    </Stack>
                                    <Stack spacing={1} className="flex-1">
                                        <Typography level="body2" className="text-gray-600">ZKI (Zaštitni kod izdavatelja)</Typography>
                                        <Typography className="font-mono">{receipt.zki || 'N/A'}</Typography>
                                    </Stack>
                                </Row>
                                <Row spacing={4}>
                                    <Stack spacing={1} className="flex-1">
                                        <Typography level="body2" className="text-gray-600">CIS Status</Typography>
                                        <Chip color={getCisStatusColor(receipt.cisStatus)} size="sm" className="w-fit">
                                            {getCisStatusLabel(receipt.cisStatus)}
                                        </Chip>
                                    </Stack>
                                    <Stack spacing={1} className="flex-1">
                                        <Typography level="body2" className="text-gray-600">Datum fiskaalizacije</Typography>
                                        <LocaleDateTime>{receipt.cisTimestamp}</LocaleDateTime>
                                    </Stack>
                                </Row>
                                {receipt.cisErrorMessage && (
                                    <Stack spacing={1}>
                                        <Typography level="body2" className="text-gray-600">CIS poruka</Typography>
                                        <Typography>{receipt.cisErrorMessage}</Typography>
                                    </Stack>
                                )}
                            </Stack>
                        </CardContent>
                    </Card>

                    {/* Business Information */}
                    <Card>
                        <CardHeader>
                            <Typography level="h2" semiBold>Podaci o poslovnom subjektu</Typography>
                        </CardHeader>
                        <CardContent>
                            <Stack spacing={2}>
                                <Stack spacing={1}>
                                    <Typography level="body2" className="text-gray-600">OIB</Typography>
                                    <Typography className="font-mono">{receipt.businessPin || 'N/A'}</Typography>
                                </Stack>
                                <Stack spacing={1}>
                                    <Typography level="body2" className="text-gray-600">Lokacija</Typography>
                                    <Typography>{receipt.businessAddress || 'N/A'}</Typography>
                                </Stack>
                                <Stack spacing={1}>
                                    <Typography level="body2" className="text-gray-600">Naziv tvrtke</Typography>
                                    <Typography>{receipt.businessName || 'N/A'}</Typography>
                                </Stack>
                            </Stack>
                        </CardContent>
                    </Card>
                </Stack>

                <Stack spacing={2} className="flex-1">
                    {/* Amount Summary */}
                    <Card>
                        <CardHeader>
                            <Typography level="h2" semiBold>Iznosi</Typography>
                        </CardHeader>
                        <CardContent>
                            <Stack spacing={2}>
                                <Row justifyContent="space-between">
                                    <Typography level="body2" className="text-gray-600">Osnovica</Typography>
                                    <Typography>€ {receipt.subtotal}</Typography>
                                </Row>
                                <Row justifyContent="space-between">
                                    <Typography level="body2" className="text-gray-600">PDV</Typography>
                                    <Typography>€ {receipt.taxAmount}</Typography>
                                </Row>
                                <Row justifyContent="space-between" className="border-t pt-2">
                                    <Typography semiBold>Ukupno</Typography>
                                    <Typography level="h3" semiBold>€ {receipt.totalAmount}</Typography>
                                </Row>
                            </Stack>
                        </CardContent>
                    </Card>

                    {/* Related Links */}
                    <Card>
                        <CardHeader>
                            <Typography level="h2" semiBold>Povezano</Typography>
                        </CardHeader>
                        <CardContent>
                            <Stack spacing={2}>
                                <Row spacing={2} alignItems="center">
                                    <Typography level="body2" className="text-gray-600 w-20">Račun:</Typography>
                                    <Link href={KnownPages.Invoice(receipt.invoiceId)}>
                                        <Typography className="text-blue-600 hover:underline">
                                            {receipt.invoice?.invoiceNumber || `#${receipt.invoiceId}`}
                                        </Typography>
                                    </Link>
                                </Row>
                                {receipt.invoice?.transactionId && (
                                    <Row spacing={2} alignItems="center">
                                        <Typography level="body2" className="text-gray-600 w-20">Transakcija:</Typography>
                                        <Link href={KnownPages.Transaction(receipt.invoice.transactionId)}>
                                            <Typography className="text-blue-600 hover:underline">
                                                #{receipt.invoice.transactionId}
                                            </Typography>
                                        </Link>
                                    </Row>
                                )}
                            </Stack>
                        </CardContent>
                    </Card>

                    {/* Timestamps */}
                    <Card>
                        <CardHeader>
                            <Typography level="h2" semiBold>Timestamp podaci</Typography>
                        </CardHeader>
                        <CardContent>
                            <Stack spacing={2}>
                                <Stack spacing={1}>
                                    <Typography level="body2" className="text-gray-600">Kreiran</Typography>
                                    <LocaleDateTime>{receipt.createdAt}</LocaleDateTime>
                                </Stack>
                                <Stack spacing={1}>
                                    <Typography level="body2" className="text-gray-600">Ažuriran</Typography>
                                    <LocaleDateTime>{receipt.updatedAt}</LocaleDateTime>
                                </Stack>
                            </Stack>
                        </CardContent>
                    </Card>
                </Stack>
            </Row>
        </Stack>
    );
}
