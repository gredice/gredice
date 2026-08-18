import type { Metadata } from 'next';
import { PUBLIC_OG_IMAGE_SIZE } from './publicMetadata.ts';

export type CmsPageMetadataInput = {
    slug: string;
    title: string;
    metaTitle?: string | null;
    metaDescription?: string | null;
    seoImageUrl?: string | null;
    canonicalPath?: string | null;
    noIndex?: boolean;
};

function imageContentType(imageUrl: string) {
    if (/\.jpe?g(?:\?|$)/iu.test(imageUrl)) {
        return 'image/jpeg';
    }
    if (/\.webp(?:\?|$)/iu.test(imageUrl)) {
        return 'image/webp';
    }
    return 'image/png';
}

export function createCmsPageMetadata(page: CmsPageMetadataInput): Metadata {
    const title = page.metaTitle || page.title;
    const description = page.metaDescription || undefined;
    const canonicalPath = page.canonicalPath || `/${page.slug}`;
    const imageUrl = page.seoImageUrl || `/api/og/cms/${page.slug}`;
    const imageAlt = `${title} – Gredice`;

    return {
        title,
        description,
        alternates: {
            canonical: canonicalPath,
        },
        robots: {
            index: !page.noIndex,
            follow: !page.noIndex,
        },
        openGraph: {
            type: 'website',
            locale: 'hr_HR',
            siteName: 'Gredice',
            title,
            description,
            url: canonicalPath,
            images: [
                {
                    url: imageUrl,
                    width: PUBLIC_OG_IMAGE_SIZE.width,
                    height: PUBLIC_OG_IMAGE_SIZE.height,
                    alt: imageAlt,
                    type: imageContentType(imageUrl),
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [
                {
                    url: imageUrl,
                    alt: imageAlt,
                },
            ],
        },
    };
}
