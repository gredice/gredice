import { auth } from "../../../../lib/auth/auth";
import InvoiceForm from "../shared/InvoiceForm";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { KnownPages } from "../../../../src/KnownPages";

export default async function CreateInvoicePage() {
    await auth(['admin']);

    return (
        <Stack spacing={4}>
            <Breadcrumbs items={[
                { label: 'Računi', href: KnownPages.Invoices },
                { label: 'Kreiraj novi račun' }
            ]} />
            <InvoiceForm mode="create" />
        </Stack>
    );
}
