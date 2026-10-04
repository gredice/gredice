import { getEntityRaw } from '@gredice/storage';
import { transformEntityToSectionData } from '@gredice/storage/entityPageSections';
import { SectionsView } from '@gredice/ui/cms';
import { notFound } from 'next/navigation';
import { sectionsComponentRegistry } from '../../../../../../components/shared/sectionsComponentRegistry';
import { auth } from '../../../../../../lib/auth/auth';

export const dynamic = 'force-dynamic';

export default async function EntityPreviewPage({
    params,
}: {
    params: Promise<{ entityType: string; entityId: string }>;
}) {
    await auth(['admin']);

    const { entityType, entityId } = await params;
    const id = Number.parseInt(entityId, 10);
    if (Number.isNaN(id)) {
        notFound();
    }

    const entity = await getEntityRaw(id);
    if (!entity || entity.entityType.name !== entityType) {
        notFound();
    }

    const sectionsData = transformEntityToSectionData(entity);

    return (
        <main>
            <SectionsView
                sectionsData={sectionsData}
                componentsRegistry={sectionsComponentRegistry}
            />
        </main>
    );
}
