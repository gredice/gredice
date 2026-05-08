import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { AdminPageHeader } from '../../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { auth } from '../../../../../lib/auth/auth';
import { KnownPages } from '../../../../../src/KnownPages';
import { createCmsPageAction } from '../actions';
import { CmsPageForm } from '../CmsPageForm';

export const dynamic = 'force-dynamic';

export default async function CreateCmsPagePage() {
    await auth(['admin']);

    return (
        <Stack spacing={4}>
            <AdminPageHeader
                breadcrumbs={
                    <Breadcrumbs
                        items={[
                            {
                                label: <AdminBreadcrumbLevelSelector />,
                            },
                            {
                                label: 'Stranice',
                                href: KnownPages.CmsPages,
                            },
                            { label: 'Nova stranica' },
                        ]}
                    />
                }
                heading="Nova stranica"
            />
            <Typography level="h2" className="text-2xl" semiBold>
                Nova stranica
            </Typography>
            <CmsPageForm
                action={createCmsPageAction}
                submitLabel="Kreiraj stranicu"
            />
        </Stack>
    );
}
