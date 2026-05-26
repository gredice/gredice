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

const localCmsPagePreviewSecret = 'local-preview-secret';

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

    const response = await clientPublic().api.directories.pages[
        ':slug{.+}'
    ].$get({
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
