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
    const pathname = imageUrl.split(/[?#]/u, 1)[0]?.toLowerCase();

    switch (pathname?.match(/\.([^./]+)$/u)?.[1]) {
        case 'avif':
            return 'image/avif';
        case 'gif':
            return 'image/gif';
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'png':
            return 'image/png';
        case 'webp':
            return 'image/webp';
        default:
            return undefined;
    }
}

export function createCmsPageMetadata(page: CmsPageMetadataInput): Metadata {
    const title = page.metaTitle || page.title;
    const description = page.metaDescription || undefined;
    const canonicalPath = page.canonicalPath || `/${page.slug}`;
    const imageUrl = page.seoImageUrl || `/api/og/cms/${page.slug}`;
    const imageAlt = `${title} – Gredice`;
    const imageType = imageContentType(imageUrl);

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
                    ...(imageType ? { type: imageType } : {}),
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
