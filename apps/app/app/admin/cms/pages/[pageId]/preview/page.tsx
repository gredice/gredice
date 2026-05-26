import { getCmsPage } from '@gredice/storage';
import { parseCmsPageContentJson, SectionsView } from '@gredice/ui/cms';
import { notFound } from 'next/navigation';
import { sectionsComponentRegistry } from '../../../../../../components/shared/sectionsComponentRegistry';
import { auth } from '../../../../../../lib/auth/auth';

export const dynamic = 'force-dynamic';

export default async function CmsPagePreviewPage({
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
    const content = parseCmsPageContentJson(page.content);

    return (
        <main>
            <SectionsView
                sectionsData={content.sectionsData}
                componentsRegistry={sectionsComponentRegistry}
                renderMode={content.renderMode}
                renderMaxWidth={content.renderMaxWidth}
            />
        </main>
    );
}
