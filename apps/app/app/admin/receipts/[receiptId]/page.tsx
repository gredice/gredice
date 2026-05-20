import { getReceipt } from '@gredice/storage';
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
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    EntityDetailsPanelCard,
    EntityDetailsPropertiesLayout,
    EntityDetailsPropertiesPanel,
    EntityDetailsPropertiesProvider,
    EntityDetailsPropertiesToggle,
    EntityDetailsPropertyList,
    type EntityDetailsPropertyListItem,
} from '../../../../components/admin/details';
import { AdminPageHeader } from '../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { AdminPageTitle } from '../../../../components/admin/navigation/AdminPageTitle';
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

    const fiscalizeReceiptActionBound = fiscalizeReceiptAction.bind(
        null,
        receiptIdNumber,
    );
    const propertyItems: EntityDetailsPropertyListItem[] = [
        { id: 'id', label: 'Račun ID', value: receipt.id, mono: true },
        {
            id: 'receipt-number',
            label: 'Broj računa',
            value: receipt.receiptNumber,
            mono: true,
        },
        { id: 'created-at', label: 'Kreiran', value: receipt.createdAt },
        { id: 'updated-at', label: 'Ažuriran', value: receipt.updatedAt },
        {
            id: 'invoice',
            label: 'Ponuda broj',
            value: receipt.invoice?.invoiceNumber || `#${receipt.invoiceId}`,
        },
    ];
    const propertiesPanel = (
        <EntityDetailsPropertiesPanel>
            <EntityDetailsPanelCard title="Detalji">
                <EntityDetailsPropertyList items={propertyItems} />
            </EntityDetailsPanelCard>
        </EntityDetailsPropertiesPanel>
    );

    return (
        <EntityDetailsPropertiesProvider>
            <Stack spacing={2}>
                <AdminPageTitle
                    title={`Fiskalni račun ${receipt.receiptNumber || `#${receipt.id}`}`}
                />
                <h1 className="sr-only">Fiskalni račun #{receipt.id}</h1>
                <AdminPageHeader
                    breadcrumbs={
                        <Row spacing={2} className="flex-wrap">
                            <Breadcrumbs
                                items={[
                                    {
                                        label: <AdminBreadcrumbLevelSelector />,
                                        href: KnownPages.Receipts,
                                    },
                                    { label: `Fiskalni račun #${receipt.id}` },
                                ]}
                            />
                            <Chip color={getCisStatusColor(receipt.cisStatus)}>
                                {getCisStatusLabel(receipt.cisStatus)}
                            </Chip>
                        </Row>
                    }
                    actions={
                        <Row className="items-center" spacing={1}>
                            <ReceiptActions receipt={receipt} />
                            <EntityDetailsPropertiesToggle />
                        </Row>
                    }
                    heading={`Fiskalni račun #${receipt.id}`}
                />

                <EntityDetailsPropertiesLayout properties={propertiesPanel}>
                    <Row spacing={2} alignItems="stretch">
                        <Stack spacing={2} className="flex-1">
                            {/* Receipt Details */}
                            <Card>
                                <CardHeader>
                                    <Row
                                        spacing={2}
                                        justifyContent="space-between"
                                    >
                                        <CardTitle>Fiskalni podaci</CardTitle>
                                        <ServerActionButton
                                            onClick={
                                                fiscalizeReceiptActionBound
                                            }
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
                                                            {
                                                                receipt.cisTimestamp
                                                            }
                                                        </LocalDateTime>
                                                    ) : (
                                                        '-'
                                                    )
                                                }
                                            />
                                            {receipt.cisErrorMessage && (
                                                <Field
                                                    name="CIS poruka"
                                                    value={
                                                        receipt.cisErrorMessage
                                                    }
                                                />
                                            )}
                                            {receipt.cisReference && (
                                                <Field
                                                    name="CIS referenca"
                                                    value={receipt.cisReference}
                                                />
                                            )}
                                        </FieldSet>
                                    </Stack>
                                </CardContent>
                            </Card>

                            {/* Business Information */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>
                                        Podaci o poslovnom subjektu
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Stack spacing={2}>
                                        <FieldSet>
                                            <Field
                                                name="Naziv tvrtke"
                                                value={
                                                    receipt.businessName || '-'
                                                }
                                            />
                                            <Field
                                                name="OIB"
                                                value={
                                                    receipt.businessPin || '-'
                                                }
                                                mono
                                            />
                                            <Field
                                                name="Adresa"
                                                value={
                                                    receipt.businessAddress ||
                                                    '-'
                                                }
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
                                            <Typography level="body2">
                                                PDV
                                            </Typography>
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
                                            <Typography semiBold>
                                                Ukupno
                                            </Typography>
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
                                            <Typography
                                                level="body2"
                                                className="w-20"
                                            >
                                                Ponuda:
                                            </Typography>
                                            <Link
                                                href={KnownPages.Invoice(
                                                    receipt.invoiceId,
                                                )}
                                            >
                                                {receipt.invoice
                                                    ?.invoiceNumber ||
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
                                                        receipt.invoice
                                                            .transactionId,
                                                    )}
                                                >
                                                    #
                                                    {
                                                        receipt.invoice
                                                            .transactionId
                                                    }
                                                </Link>
                                            </Row>
                                        )}
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Stack>
                    </Row>
                </EntityDetailsPropertiesLayout>
            </Stack>
        </EntityDetailsPropertiesProvider>
    );
}
