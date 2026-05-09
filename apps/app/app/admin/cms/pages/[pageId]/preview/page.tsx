import { getCmsPage } from '@gredice/storage';
import { SectionsView } from '@signalco/cms-core/SectionsView';
import { notFound } from 'next/navigation';
import { sectionsComponentRegistry } from '../../../../../../components/shared/sectionsComponentRegistry';
import { auth } from '../../../../../../lib/auth/auth';

function parseCmsSectionData(value: string | null) {
    if (!value) {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

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
                sectionsData={parseCmsSectionData(page.content)}
                componentsRegistry={sectionsComponentRegistry}
            />
        </main>
    );
}
