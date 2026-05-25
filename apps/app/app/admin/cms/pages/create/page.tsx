import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Stack } from '@gredice/ui/Stack';
import { AdminBreadcrumbLevelSelector } from '../../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { auth } from '../../../../../lib/auth/auth';
import { KnownPages } from '../../../../../src/KnownPages';
import { createCmsPageAction } from '../actions';
import { CmsPageForm } from '../CmsPageForm';

export const dynamic = 'force-dynamic';

export default async function CreateCmsPagePage() {
    await auth(['admin']);

    return (
        <Stack spacing={8}>
            <CmsPageForm
                action={createCmsPageAction}
                formId="cms-page-create-form"
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
        </Stack>
    );
}
