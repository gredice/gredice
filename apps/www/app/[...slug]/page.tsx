import { directoriesClient } from '@gredice/client';
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

    const response = await directoriesClient().GET('/pages/{slug}', {
        params: {
            path: {
                slug: normalizedSlug,
            },
        },
    });

    if (response.error || !response.data) {
        notFound();
    }

    return (
        <main>
            <SectionsView
                sectionsData={parseCmsSectionData(response.data.content)}
                componentsRegistry={sectionsComponentRegistry}
            />
        </main>
    );
}
