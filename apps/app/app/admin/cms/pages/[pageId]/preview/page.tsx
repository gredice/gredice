import { getCmsPage } from '@gredice/storage';
import { parseSectionDataJson, SectionsView } from '@gredice/ui/cms';
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

    return (
        <main>
            <SectionsView
                sectionsData={parseSectionDataJson(page.content)}
                componentsRegistry={sectionsComponentRegistry}
            />
        </main>
    );
}
