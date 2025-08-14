import { auth } from "../../../../lib/auth/auth";
import InvoiceForm from "../shared/InvoiceForm";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { KnownPages } from "../../../../src/KnownPages";

export default async function CreateInvoicePage() {
    await auth(['admin']);

    return (
        <Stack spacing={2}>
            <Breadcrumbs items={[
                { label: 'Ponude', href: KnownPages.Invoices },
                { label: 'Kreiraj novu ponudu' }
            ]} />
            <InvoiceForm mode="create" />
        </Stack>
    );
}
