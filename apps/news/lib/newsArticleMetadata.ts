import type { Metadata } from 'next';

type NewsArticleMetadataInput = {
    title: string;
    excerpt?: string | null;
    path: string;
    publishedAt: string;
    tags: string[];
    metaTitle?: string | null;
    metaDescription?: string | null;
    seoImageUrl?: string | null;
    canonicalPath?: string | null;
    noIndex?: boolean;
};

const openGraphImageSize = {
    width: 1200,
    height: 630,
} as const;

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

export function createNewsArticleMetadata(
    entry: NewsArticleMetadataInput,
): Metadata {
    const title = entry.metaTitle || entry.title;
    const description = entry.metaDescription || entry.excerpt || undefined;
    const canonicalPath = entry.canonicalPath || entry.path;
    const imageUrl = entry.seoImageUrl || `${entry.path}/opengraph-image`;
    const imageAlt = `${title} – Gredice`;
    const imageType = imageContentType(imageUrl);

    return {
        title,
        description,
        alternates: {
            canonical: canonicalPath,
        },
        robots: {
            index: !entry.noIndex,
            follow: !entry.noIndex,
        },
        openGraph: {
            type: 'article',
            locale: 'hr_HR',
            siteName: 'Gredice',
            title,
            description,
            url: canonicalPath,
            publishedTime: entry.publishedAt,
            tags: entry.tags,
            images: [
                {
                    url: imageUrl,
                    ...openGraphImageSize,
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
