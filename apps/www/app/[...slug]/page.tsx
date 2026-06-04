import { clientPublic } from '@gredice/client';
import { SectionsView } from '@gredice/ui/cms';
import type { Metadata } from 'next';
import { draftMode, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { sectionsComponentRegistry } from '../../components/shared/sectionsComponentRegistry';
import {
    hasReservedFirstSegment,
    normalizeCmsRouteSlug,
    parseCmsPageRenderMaxWidth,
    parseCmsPageRenderMode,
    parseCmsSectionData,
} from './cmsPageRouteUtils';
import { getSourceCmsPageBySlug } from './sourceCmsPages';

const localCmsPagePreviewSecret = 'local-preview-secret';

type CmsRoutePage = {
    slug: string;
    title: string;
    content: unknown;
    renderMode?: unknown;
    renderMaxWidth?: unknown;
    metaTitle?: string | null;
    metaDescription?: string | null;
    metaImageUrl?: string | null;
    canonicalPath?: string | null;
    noIndex?: boolean;
};

function isLocalPreviewHost(hostname: string) {
    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.gredice.test')
    );
}

async function cmsPagePreviewSecret() {
    const configuredSecret = process.env.CMS_PAGES_PREVIEW_SECRET?.trim();
    if (configuredSecret) {
        return configuredSecret;
    }

    const requestHost = (await headers()).get('host') ?? '';
    const hostname = requestHost
        ? new URL(`http://${requestHost}`).hostname
        : '';
    return isLocalPreviewHost(hostname) ? localCmsPagePreviewSecret : null;
}

async function fetchCmsDirectoryPage({
    normalizedSlug,
    previewSecret,
    suppressFetchError,
}: {
    normalizedSlug: string;
    previewSecret?: string | null;
    suppressFetchError?: boolean;
}) {
    try {
        return await clientPublic().api.directories.pages[':slug{.+}'].$get({
            param: { slug: normalizedSlug },
            query: previewSecret ? { draft: '1' } : {},
            ...(previewSecret
                ? {
                      header: {
                          'x-preview-secret': previewSecret,
                      },
                  }
                : {}),
        });
    } catch (error) {
        if (!suppressFetchError) {
            console.error('Failed to fetch CMS page from directories API', {
                slug: normalizedSlug,
                error,
            });
        }
        return null;
    }
}

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
