import 'server-only';

import { clientPublic } from '@gredice/client';
import { headers } from 'next/headers';

const localCmsPagePreviewSecret = 'local-preview-secret';

export type CmsRoutePage = {
    slug: string;
    title: string;
    content: unknown;
    contentKind?: string | null;
    category?: string | null;
    tags?: string[] | null;
    renderMode?: unknown;
    renderMaxWidth?: unknown;
    metaTitle?: string | null;
    metaDescription?: string | null;
    metaImageUrl?: string | null;
    seoImageUrl?: string | null;
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

export async function cmsPagePreviewSecret() {
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

export async function fetchCmsDirectoryPage({
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
