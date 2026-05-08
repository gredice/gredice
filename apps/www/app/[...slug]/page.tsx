import { clientPublic } from '@gredice/client';
import { SectionsView } from '@signalco/cms-core/SectionsView';
import { notFound } from 'next/navigation';
import { sectionsComponentRegistry } from '../../components/shared/sectionsComponentRegistry';
import {
    hasReservedFirstSegment,
    normalizeCmsRouteSlug,
    parseCmsSectionData,
} from './cmsPageRouteUtils';

export default async function CmsPublishedPageRoute({
    params,
}: {
    params: Promise<{ slug: string[] }>;
}) {
    const { slug } = await params;
    const normalizedSlug = normalizeCmsRouteSlug(slug);

    if (!normalizedSlug || hasReservedFirstSegment(normalizedSlug)) {
        notFound();
    }

    const response = await clientPublic().api.directories.pages[':slug{.+}'].$get({
        param: { slug: normalizedSlug },
    });

    if (response.status !== 200) {
        notFound();
    }

    const page = await response.json();

    return (
        <main>
            <SectionsView
                sectionsData={parseCmsSectionData(page.content)}
                componentsRegistry={sectionsComponentRegistry}
            />
        </main>
    );
}
