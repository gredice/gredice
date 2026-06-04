import { SectionsView } from '@gredice/ui/cms';
import type { Metadata } from 'next';
import { draftMode } from 'next/headers';
import { notFound } from 'next/navigation';
import { sectionsComponentRegistry } from '../../components/shared/sectionsComponentRegistry';
import {
    type CmsRoutePage,
    cmsPagePreviewSecret,
    fetchCmsDirectoryPage,
} from './cmsPageData';
import {
    hasReservedFirstSegment,
    normalizeCmsRouteSlug,
    parseCmsPageRenderMaxWidth,
    parseCmsPageRenderMode,
    parseCmsSectionData,
} from './cmsPageRouteUtils';
import { getSourceCmsPageBySlug } from './sourceCmsPages';

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
    const previewSecret = isEnabled ? await cmsPagePreviewSecret() : null;
    const sourcePage = getSourceCmsPageBySlug(normalizedSlug);

    const response = await fetchCmsDirectoryPage({
        normalizedSlug,
        previewSecret: isEnabled ? previewSecret : null,
        suppressFetchError: Boolean(sourcePage),
    });

    let page: CmsRoutePage;
    if (response?.status === 200) {
        page = await response.json();
    } else if (sourcePage) {
        page = sourcePage;
    } else {
        notFound();
    }

    return (
        <main>
            <SectionsView
                sectionsData={parseCmsSectionData(page.content)}
                componentsRegistry={sectionsComponentRegistry}
                renderMode={parseCmsPageRenderMode(page.renderMode)}
                renderMaxWidth={parseCmsPageRenderMaxWidth(page.renderMaxWidth)}
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

    const sourcePage = getSourceCmsPageBySlug(normalizedSlug);
    const response = await fetchCmsDirectoryPage({
        normalizedSlug,
        suppressFetchError: Boolean(sourcePage),
    });

    let page: CmsRoutePage;
    if (response?.status === 200) {
        page = await response.json();
    } else if (sourcePage) {
        page = sourcePage;
    } else {
        return {};
    }
    const canonicalPath = page.canonicalPath || `/${page.slug}`;
    const openGraphImage = page.seoImageUrl || `/${page.slug}/opengraph-image`;
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
            images: [openGraphImage],
        },
    };
}
