import { getInvoice, getReceipt } from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { AdminPageHeader } from '../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { AdminPageTitle } from '../../../../components/admin/navigation/AdminPageTitle';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { BillingDocumentPreview } from './_components/BillingDocumentPreview';
import { BillingPreviewControls } from './_components/BillingPreviewControls';
import {
    type BillingDocumentPreviewModel,
    type BillingPreviewSearchState,
    buildInvoicePreviewModel,
    buildReceiptPreviewModel,
    getBillingPreviewSample,
    parseBillingPreviewSearchParams,
    parsePositiveInteger,
} from './billingPreviewModel';

export const dynamic = 'force-dynamic';

interface BillingPreviewPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function previewWidthClassName(width: BillingPreviewSearchState['width']) {
    switch (width) {
        case 'compact':
            return 'max-w-[430px]';
        case 'wide':
            return 'max-w-[1120px]';
        default:
            return 'max-w-[820px]';
    }
}

async function loadPreviewModel(state: BillingPreviewSearchState): Promise<{
    error?: string;
    model?: BillingDocumentPreviewModel;
}> {
    if (state.source === 'invoice') {
        const invoiceId = parsePositiveInteger(state.invoiceId);
        if (!invoiceId) {
            return { error: 'Upisi valjani ID ponude.' };
        }

        const invoice = await getInvoice(invoiceId);
        if (!invoice) {
            return { error: `Ponuda #${invoiceId} nije pronađena.` };
        }

        return { model: buildInvoicePreviewModel(invoice) };
    }

    if (state.source === 'receipt') {
        const receiptId = parsePositiveInteger(state.receiptId);
        if (!receiptId) {
            return { error: 'Upiši valjani ID fiskalnog računa.' };
        }

        const receipt = await getReceipt(receiptId);
        if (!receipt) {
            return { error: `Fiskalni račun #${receiptId} nije pronađen.` };
        }

        return { model: buildReceiptPreviewModel(receipt) };
    }

    return {
        model: getBillingPreviewSample(state.documentKind, state.sampleId),
    };
}

export default async function BillingDocumentPreviewsPage({
    searchParams,
}: BillingPreviewPageProps) {
    await auth(['admin']);

    const resolvedSearchParams = await searchParams;
    const state = parseBillingPreviewSearchParams(resolvedSearchParams);
    const preview = await loadPreviewModel(state);

    return (
        <Stack spacing={6}>
            <AdminPageTitle title="Pregledi obračunskih dokumenata" />
            <AdminPageHeader
                breadcrumbs={
                    <Breadcrumbs
                        items={[
                            {
                                label: <AdminBreadcrumbLevelSelector />,
                                href: KnownPages.BillingPreviews,
                            },
                            { label: 'Pregledi dokumenata' },
                        ]}
                    />
                }
                actions={
                    <Button
                        href={KnownPages.BillingPreviews}
                        variant="outlined"
                    >
                        Počisti
                    </Button>
                }
                heading="Pregledi obračunskih dokumenata"
            />

            <Card>
                <CardHeader>
                    <CardTitle>Kontrole pregleda</CardTitle>
                </CardHeader>
                <CardContent>
                    <BillingPreviewControls state={state} />
                </CardContent>
            </Card>

            <section className="min-w-0 space-y-3">
                <Typography component="h2" level="h4">
                    Dokument
                </Typography>
                {preview.model ? (
                    <div
                        className={`mx-auto w-full ${previewWidthClassName(
                            state.width,
                        )}`}
                    >
                        <BillingDocumentPreview model={preview.model} />
                    </div>
                ) : (
                    <NoDataPlaceholder>
                        {preview.error ?? 'Nema dokumenta za pregled.'}
                    </NoDataPlaceholder>
                )}
            </section>

            <style>
                {`@media print {
                    body * { visibility: hidden; }
                    .billing-preview-print, .billing-preview-print * { visibility: visible; }
                    .billing-preview-print {
                        position: absolute;
                        inset: 0;
                        width: 100%;
                        border: 0;
                        box-shadow: none;
                    }
                }`}
            </style>
        </Stack>
    );
}
