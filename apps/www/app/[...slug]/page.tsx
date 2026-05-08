import { clientPublic } from '@gredice/client';
import { SectionsView } from '@signalco/cms-core/SectionsView';
import { draftMode } from 'next/headers';
import type { Metadata } from 'next';
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

    const { isEnabled } = await draftMode();
    const previewSecret = process.env.CMS_PAGES_PREVIEW_SECRET;

    const response = await clientPublic().api.directories.pages[
        ':slug{.+}'
    ].$get({
        param: { slug: normalizedSlug },
        query: isEnabled ? { draft: '1' } : {},
        ...(isEnabled && previewSecret
            ? {
                  header: {
                      'x-preview-secret': previewSecret,
                  },
              }
            : {}),
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

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const normalizedSlug = normalizeCmsRouteSlug(slug);
    if (!normalizedSlug || hasReservedFirstSegment(normalizedSlug)) {
        return {};
    }

    const response = await clientPublic().api.directories.pages[':slug{.+}'].$get({
        param: { slug: normalizedSlug },
        query: {},
    });

    if (response.status !== 200) {
        return {};
    }

    const page = await response.json();
    const canonicalPath = page.canonicalPath || `/${page.slug}`;
    return {
        title: page.metaTitle || page.title,
        description: page.metaDescription || undefined,
        alternates: {
            canonical: canonicalPath,
        },
        robots: {
            index: !page.noIndex,
        },
        openGraph: {
            title: page.metaTitle || page.title,
            description: page.metaDescription || undefined,
            images: page.metaImageUrl ? [page.metaImageUrl] : undefined,
        },
    };
}
