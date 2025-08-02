import { getReceipt } from "@gredice/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Chip } from "@signalco/ui-primitives/Chip";
import { auth } from "../../../../lib/auth/auth";
import { KnownPages } from "../../../../src/KnownPages";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocaleDateTime } from "../../../../components/shared/LocaleDateTime";
import { FieldSet } from "../../../../components/shared/fields/FieldSet";
import { Field } from "../../../../components/shared/fields/Field";
import { ReceiptActions } from "./ReceiptActions";
import { ServerActionButton } from "../../../../components/shared/ServerActionButton";
import { fiscalizeReceiptAction } from "./actions";

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

export default async function ReceiptPage({ params }: { params: Promise<{ receiptId: string }> }) {
    await auth(['admin']);
    const { receiptId } = await params;
    const receiptIdNumber = parseInt(receiptId);
    if (isNaN(receiptIdNumber)) {
        notFound();
    }

    const receipt = await getReceipt(receiptIdNumber);
    if (!receipt) {
        notFound();
    }

    const fiscalizeReceiptActionBound = fiscalizeReceiptAction.bind(null, receiptIdNumber);

    return (
        <Stack spacing={2}>
            <Row spacing={2} justifyContent="space-between">
                <Row spacing={2} alignItems="center">
                    <Typography level="h1" className="text-2xl" semiBold>
                        Fiskalni račun #{receipt.id}
                    </Typography>
                    <Chip color={getCisStatusColor(receipt.cisStatus)} size="sm">
                        {getCisStatusLabel(receipt.cisStatus)}
                    </Chip>
                </Row>

                {/* Actions */}
                <ReceiptActions receipt={receipt} />
            </Row>

            <Stack spacing={2}>
                <FieldSet>
                    <Field name="Račun ID" value={receipt.id} mono />
                    <Field name="Broj računa" value={receipt.receiptNumber} mono />
                    <Field name="Kreiran" value={<LocaleDateTime>{receipt.createdAt}</LocaleDateTime>} />
                    <Field name="Ažuriran" value={<LocaleDateTime>{receipt.updatedAt}</LocaleDateTime>} />
                </FieldSet>
                <FieldSet>
                    <Field name="Ponuda broj" value={receipt.invoice?.invoiceNumber || `#${receipt.invoiceId}`} />
                </FieldSet>
            </Stack>
            <Row spacing={2} alignItems="stretch">
                <Stack spacing={2} className="flex-1">
                    {/* Receipt Details */}
                    <Card>
                        <CardHeader>
                            <Row spacing={2} justifyContent="space-between">
                                <CardTitle>Fiskalni podaci</CardTitle>
                                <ServerActionButton
                                    onClick={fiscalizeReceiptActionBound}
                                >
                                    Fiskaliziraj račun
                                </ServerActionButton>
                            </Row>
                        </CardHeader>
                        <CardContent>
                            <Stack spacing={2}>
                                <FieldSet>
                                    <Field name="JIR" value={receipt.jir || '-'} mono />
                                    <Field name="ZKI" value={receipt.zki || '-'} mono />
                                </FieldSet>
                                <FieldSet>
                                    <Field name="CIS Status" value={
                                        <Chip color={getCisStatusColor(receipt.cisStatus)} size="sm" className="w-fit">
                                            {getCisStatusLabel(receipt.cisStatus)}
                                        </Chip>
                                    } />
                                    <Field name="Datum fiskalizacije" value={
                                        receipt.cisTimestamp ? (
                                            <LocaleDateTime>{receipt.cisTimestamp}</LocaleDateTime>
                                        ) : '-'
                                    } />
                                    {receipt.cisErrorMessage && (
                                        <Field name="CIS poruka" value={receipt.cisErrorMessage} />
                                    )}
                                    {receipt.cisReference && (
                                        <Field name="CIS referenca" value={receipt.cisReference} />
                                    )}
                                </FieldSet>
                            </Stack>
                        </CardContent>
                    </Card>

                    {/* Business Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Podaci o poslovnom subjektu</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Stack spacing={2}>
                                <FieldSet>
                                    <Field name="Naziv tvrtke" value={receipt.businessName || '-'} />
                                    <Field name="OIB" value={receipt.businessPin || '-'} mono />
                                    <Field name="Adresa" value={receipt.businessAddress || '-'} />
                                </FieldSet>
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
                            <Stack spacing={1}>
                                <Row justifyContent="space-between">
                                    <Typography level="body2" className="text-gray-600">Osnovica</Typography>
                                    <Typography>{receipt.subtotal}{receipt.currency === 'eur' ? ' €' : receipt.currency}</Typography>
                                </Row>
                                <Row justifyContent="space-between">
                                    <Typography level="body2" className="text-gray-600">PDV</Typography>
                                    <Typography>{receipt.taxAmount}{receipt.currency === 'eur' ? ' €' : receipt.currency}</Typography>
                                </Row>
                                <Row justifyContent="space-between" className="border-t pt-2">
                                    <Typography semiBold>Ukupno</Typography>
                                    <Typography level="h3" semiBold>{receipt.totalAmount}{receipt.currency === 'eur' ? ' €' : receipt.currency}</Typography>
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
                            <Stack spacing={1}>
                                <Row spacing={2} alignItems="center">
                                    <Typography level="body2" className="text-gray-600 w-20">Ponuda:</Typography>
                                    <Link href={KnownPages.Invoice(receipt.invoiceId)}>
                                        {receipt.invoice?.invoiceNumber || `#${receipt.invoiceId}`}
                                    </Link>
                                </Row>
                                {receipt.invoice?.transactionId && (
                                    <Row spacing={2} alignItems="center">
                                        <Typography level="body2" className="text-gray-600 w-20">Transakcija:</Typography>
                                        <Link href={KnownPages.Transaction(receipt.invoice.transactionId)}>
                                            #{receipt.invoice.transactionId}
                                        </Link>
                                    </Row>
                                )}
                            </Stack>
                        </CardContent>
                    </Card>
                </Stack>
            </Row>
        </Stack>
    );
}
