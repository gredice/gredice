import { getInvoice } from '@gredice/storage';
import { notFound, redirect } from 'next/navigation';
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

    return <InvoiceForm mode="edit" invoice={invoice} />;
}
