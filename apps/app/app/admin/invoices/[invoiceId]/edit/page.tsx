import { getInvoice } from "@gredice/storage";
import { auth } from "../../../../../lib/auth/auth";
import { notFound, redirect } from "next/navigation";
import { KnownPages } from "../../../../../src/KnownPages";
import InvoiceForm from "../../shared/InvoiceForm";
import { canEditInvoice } from "../invoiceUtils";

export const dynamic = 'force-dynamic';

export default async function EditInvoicePage({ params }: { params: { invoiceId: string } }) {
    await auth(['admin']);

    const invoiceId = parseInt(params.invoiceId);
    if (isNaN(invoiceId)) {
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
