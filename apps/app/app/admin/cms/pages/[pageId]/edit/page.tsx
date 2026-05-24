import { getCmsPage } from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Stack } from '@gredice/ui/Stack';
import { notFound } from 'next/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { auth } from '../../../../../../lib/auth/auth';
import { KnownPages } from '../../../../../../src/KnownPages';
import { autosaveCmsPageAction, updateCmsPageAction } from '../../actions';
import { CmsPageForm } from '../../CmsPageForm';

export const dynamic = 'force-dynamic';

export default async function EditCmsPagePage({
    params,
}: {
    params: Promise<{ pageId: string }>;
}) {
    await auth(['admin']);

    const { pageId } = await params;
    const id = Number.parseInt(pageId, 10);
    if (Number.isNaN(id)) {
        notFound();
    }

    const page = await getCmsPage(id);
    if (!page) {
        notFound();
    }

    const updateAction = updateCmsPageAction.bind(null, id);
    const autosaveAction = autosaveCmsPageAction.bind(null, id);

    return (
        <Stack spacing={8}>
            <CmsPageForm
                page={page}
                action={updateAction}
                formId={`cms-page-${id}-edit-form`}
                autosaveAction={autosaveAction}
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
                            { label: page.title },
                        ]}
                    />
                }
                heading="Uredi stranicu"
            />
        </Stack>
    );
}
