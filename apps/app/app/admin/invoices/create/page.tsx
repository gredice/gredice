import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Stack } from '@signalco/ui-primitives/Stack';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import InvoiceForm from '../shared/InvoiceForm';

export default async function CreateInvoicePage() {
    await auth(['admin']);

    return (
        <Stack spacing={2}>
            <Breadcrumbs
                items={[
                    { label: 'Ponude', href: KnownPages.Invoices },
                    { label: 'Kreiraj novu ponudu' },
                ]}
            />
            <InvoiceForm mode="create" />
        </Stack>
    );
}
