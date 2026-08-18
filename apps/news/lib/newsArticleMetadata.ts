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
    if (/\.jpe?g(?:\?|$)/iu.test(imageUrl)) {
        return 'image/jpeg';
    }
    if (/\.webp(?:\?|$)/iu.test(imageUrl)) {
        return 'image/webp';
    }
    return 'image/png';
}

export function createNewsArticleMetadata(
    entry: NewsArticleMetadataInput,
): Metadata {
    const title = entry.metaTitle || entry.title;
    const description = entry.metaDescription || entry.excerpt || undefined;
    const canonicalPath = entry.canonicalPath || entry.path;
    const imageUrl = entry.seoImageUrl || `${entry.path}/opengraph-image`;
    const imageAlt = `${title} – Gredice`;

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
