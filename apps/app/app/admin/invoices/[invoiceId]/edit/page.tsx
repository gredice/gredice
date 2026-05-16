import { getInvoice } from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Stack } from '@signalco/ui-primitives/Stack';
import { notFound, redirect } from 'next/navigation';
import { AdminPageHeader } from '../../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { auth } from '../../../../../lib/auth/auth';
import { KnownPages } from '../../../../../src/KnownPages';
import InvoiceForm from '../../shared/InvoiceForm';
import { canEditInvoice } from '../invoiceUtils';

export const dynamic = 'force-dynamic';

export default async function EditInvoicePage({
    params,
}: PageProps<'/admin/invoices/[invoiceId]/edit'>) {
    await auth(['admin']);
    const { invoiceId: invoiceIdParam } = await params;
    const invoiceId = parseInt(invoiceIdParam, 10);
    if (Number.isNaN(invoiceId)) {
        notFound();
    }

    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
        notFound();
    }

    // Check if invoice can be edited
    if (!canEditInvoice(invoice.status)) {
        redirect(KnownPages.Invoice(invoiceId));
    }

    return (
        <Stack spacing={2}>
            <AdminPageHeader
                breadcrumbs={
                    <Breadcrumbs
                        items={[
                            {
                                label: <AdminBreadcrumbLevelSelector />,
                                href: KnownPages.Invoices,
                            },
                            {
                                label: `${invoice.invoiceNumber}`,
                                href: KnownPages.Invoice(invoice.id),
                            },
                            { label: 'Uredi' },
                        ]}
                    />
                }
                heading={`Uredi ponudu ${invoice.invoiceNumber}`}
            />
            <InvoiceForm mode="edit" invoice={invoice} />
        </Stack>
    );
}
