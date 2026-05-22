import { getCmsPage } from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { notFound } from 'next/navigation';
import { AdminPageHeader } from '../../../../../../components/admin/navigation';
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
                            {
                                label: page.title,
                                href: KnownPages.CmsPage(id),
                            },
                            { label: 'Uredi' },
                        ]}
                    />
                }
                heading="Uredi stranicu"
            />
            <Typography level="h2" className="text-2xl" semiBold>
                Uredi stranicu
            </Typography>
            <CmsPageForm
                page={page}
                action={updateAction}
                submitLabel="Spremi promjene"
                autosaveAction={autosaveAction}
            />
        </Stack>
    );
}
