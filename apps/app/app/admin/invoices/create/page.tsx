import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Stack } from '@gredice/ui/Stack';
import { AdminPageHeader } from '../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import InvoiceForm from '../shared/InvoiceForm';

export default async function CreateInvoicePage() {
    await auth(['admin']);

    return (
        <Stack spacing={4}>
            <AdminPageHeader
                breadcrumbs={
                    <Breadcrumbs
                        items={[
                            {
                                label: <AdminBreadcrumbLevelSelector />,
                                href: KnownPages.Invoices,
                            },
                            { label: 'Kreiraj novu ponudu' },
                        ]}
                    />
                }
                heading="Kreiraj novu ponudu"
            />
            <InvoiceForm mode="create" />
        </Stack>
    );
}
