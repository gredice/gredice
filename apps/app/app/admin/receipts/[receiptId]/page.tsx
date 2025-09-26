import { getReceipt } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Field } from '../../../../components/shared/fields/Field';
import { FieldSet } from '../../../../components/shared/fields/FieldSet';
import { ServerActionButton } from '../../../../components/shared/ServerActionButton';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { fiscalizeReceiptAction } from './actions';
import { ReceiptActions } from './ReceiptActions';

export const dynamic = 'force-dynamic';

function getCisStatusColor(cisStatus: string) {
    switch (cisStatus) {
        case 'pending':
            return 'warning';
        case 'confirmed':
            return 'success';
        case 'failed':
            return 'error';
        default:
            return 'neutral';
    }
}

function getCisStatusLabel(cisStatus: string) {
    switch (cisStatus) {
        case 'pending':
            return 'Na čekanju';
        case 'confirmed':
            return 'Potvrđeno';
        case 'failed':
            return 'Neuspješno';
        default:
            return cisStatus;
    }
}

function getPdfStatusLabel(pdfStatus: string) {
    switch (pdfStatus) {
        case 'pending':
            return 'Priprema';
        case 'processing':
            return 'Generiranje';
        case 'succeeded':
            return 'Spremno';
        case 'failed':
            return 'Neuspješno';
        default:
            return pdfStatus;
    }
}

function getPdfStatusColor(pdfStatus: string) {
    switch (pdfStatus) {
        case 'succeeded':
            return 'success' as const;
        case 'processing':
            return 'warning' as const;
        case 'failed':
            return 'error' as const;
        default:
            return 'neutral' as const;
    }
}

export default async function ReceiptPage({
    params,
}: {
    params: Promise<{ receiptId: string }>;
}) {
    await auth(['admin']);
    const { receiptId } = await params;
    const receiptIdNumber = parseInt(receiptId, 10);
    if (Number.isNaN(receiptIdNumber)) {
        notFound();
    }

    const receipt = await getReceipt(receiptIdNumber);
    if (!receipt) {
        notFound();
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://api.gredice.com';

    const fiscalizeReceiptActionBound = fiscalizeReceiptAction.bind(
        null,
        receiptIdNumber,
    );

    return (
        <Stack spacing={2}>
            <Row spacing={2} justifyContent="space-between">
                <Row spacing={2}>
                    <Typography level="h1" className="text-2xl" semiBold>
                        Fiskalni račun #{receipt.id}
                    </Typography>
                    <Chip color={getCisStatusColor(receipt.cisStatus)}>
                        {getCisStatusLabel(receipt.cisStatus)}
                    </Chip>
                </Row>

                {/* Actions */}
                <ReceiptActions receipt={receipt} />
            </Row>

            <Stack spacing={2}>
                <FieldSet>
                    <Field name="Račun ID" value={receipt.id} mono />
                    <Field
                        name="Broj računa"
                        value={receipt.receiptNumber}
                        mono
                    />
                    <Field
                        name="Kreiran"
                        value={
                            <LocalDateTime>{receipt.createdAt}</LocalDateTime>
                        }
                    />
                    <Field
                        name="Ažuriran"
                        value={
                            <LocalDateTime>{receipt.updatedAt}</LocalDateTime>
                        }
                    />
                </FieldSet>
                <FieldSet>
                    <Field
                        name="Ponuda broj"
                        value={
                            receipt.invoice?.invoiceNumber ||
                            `#${receipt.invoiceId}`
                        }
                    />
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
                                    <Field
                                        name="JIR"
                                        value={receipt.jir || '-'}
                                        mono
                                    />
                                    <Field
                                        name="ZKI"
                                        value={receipt.zki || '-'}
                                        mono
                                    />
                                </FieldSet>
                                <FieldSet>
                                    <Field
                                        name="CIS Status"
                                        value={
                                            <Chip
                                                color={getCisStatusColor(
                                                    receipt.cisStatus,
                                                )}
                                                className="w-fit"
                                            >
                                                {getCisStatusLabel(
                                                    receipt.cisStatus,
                                                )}
                                            </Chip>
                                        }
                                    />
                                    <Field
                                        name="Datum fiskalizacije"
                                        value={
                                            receipt.cisTimestamp ? (
                                                <LocalDateTime>
                                                    {receipt.cisTimestamp}
                                                </LocalDateTime>
                                            ) : (
                                                '-'
                                            )
                                        }
                                    />
                                    {receipt.cisErrorMessage && (
                                        <Field
                                            name="CIS poruka"
                                            value={receipt.cisErrorMessage}
                                        />
                                    )}
                                    {receipt.cisReference && (
                                        <Field
                                            name="CIS referenca"
                                            value={receipt.cisReference}
                                        />
                                    )}
                                </FieldSet>
                                <FieldSet>
                                    <Field
                                        name="PDF status"
                                        value={
                                            <Row spacing={1}>
                                                <Chip
                                                    color={getPdfStatusColor(
                                                        receipt.pdfStatus,
                                                    )}
                                                    className="w-fit"
                                                >
                                                    {getPdfStatusLabel(
                                                        receipt.pdfStatus,
                                                    )}
                                                </Chip>
                                                {receipt.pdfStatus === 'succeeded' && (
                                                    <Link
                                                        href={`${apiBaseUrl}/api/receipts/${receipt.id}/pdf`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-primary-600 underline"
                                                    >
                                                        Preuzmi PDF
                                                    </Link>
                                                )}
                                            </Row>
                                        }
                                    />
                                    {receipt.pdfErrorMessage && (
                                        <Field
                                            name="PDF greška"
                                            value={receipt.pdfErrorMessage}
                                        />
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
                                    <Field
                                        name="Naziv tvrtke"
                                        value={receipt.businessName || '-'}
                                    />
                                    <Field
                                        name="OIB"
                                        value={receipt.businessPin || '-'}
                                        mono
                                    />
                                    <Field
                                        name="Adresa"
                                        value={receipt.businessAddress || '-'}
                                    />
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
                                    <Typography level="body2">
                                        Osnovica
                                    </Typography>
                                    <Typography>
                                        {receipt.subtotal}
                                        {receipt.currency === 'eur'
                                            ? ' €'
                                            : receipt.currency}
                                    </Typography>
                                </Row>
                                <Row justifyContent="space-between">
                                    <Typography level="body2">PDV</Typography>
                                    <Typography>
                                        {receipt.taxAmount}
                                        {receipt.currency === 'eur'
                                            ? ' €'
                                            : receipt.currency}
                                    </Typography>
                                </Row>
                                <Row
                                    justifyContent="space-between"
                                    className="border-t pt-2"
                                >
                                    <Typography semiBold>Ukupno</Typography>
                                    <Typography level="h3" semiBold>
                                        {receipt.totalAmount}
                                        {receipt.currency === 'eur'
                                            ? ' €'
                                            : receipt.currency}
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
                            <Stack spacing={1}>
                                <Row spacing={2}>
                                    <Typography level="body2" className="w-20">
                                        Ponuda:
                                    </Typography>
                                    <Link
                                        href={KnownPages.Invoice(
                                            receipt.invoiceId,
                                        )}
                                    >
                                        {receipt.invoice?.invoiceNumber ||
                                            `#${receipt.invoiceId}`}
                                    </Link>
                                </Row>
                                {receipt.invoice?.transactionId && (
                                    <Row spacing={2}>
                                        <Typography
                                            level="body2"
                                            className="w-20"
                                        >
                                            Transakcija:
                                        </Typography>
                                        <Link
                                            href={KnownPages.Transaction(
                                                receipt.invoice.transactionId,
                                            )}
                                        >
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
