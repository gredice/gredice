import type { Metadata } from 'next';

type NewsArchiveSeo = {
    canonicalUrl: string;
    description: string;
    documentTitle: string;
    imageAlt: string;
    imageUrl: string;
    title: string;
};

const openGraphImageSize = {
    height: 630,
    width: 1200,
};

function createNewsArchiveMetadata(seo: NewsArchiveSeo): Metadata {
    return {
        title: {
            absolute: seo.documentTitle,
        },
        description: seo.description,
        alternates: {
            canonical: seo.canonicalUrl,
        },
        openGraph: {
            title: seo.title,
            description: seo.description,
            images: [
                {
                    ...openGraphImageSize,
                    alt: seo.imageAlt,
                    type: 'image/png',
                    url: seo.imageUrl,
                },
            ],
            locale: 'hr_HR',
            siteName: 'Gredice',
            type: 'website',
            url: seo.canonicalUrl,
        },
        twitter: {
            card: 'summary_large_image',
            title: seo.title,
            description: seo.description,
            images: [
                {
                    alt: seo.imageAlt,
                    url: seo.imageUrl,
                },
            ],
        },
    };
}

export const blogArchiveSeo = {
    canonicalUrl: 'https://www.gredice.com/novosti',
    description:
        'Blog objave iz Gredica koje pomažu pratiti što se događa u vrtu i oko njega.',
    documentTitle: 'Novosti | Gredice',
    imageAlt: 'Novosti iz Gredica – blog objave iz vrta',
    imageUrl: 'https://www.gredice.com/novosti/opengraph-image',
    title: 'Novosti iz Gredica',
} satisfies NewsArchiveSeo;

export const changelogArchiveSeo = {
    canonicalUrl: 'https://www.gredice.com/novosti/sto-je-novo',
    description:
        'Kronološki pregled nadogradnji, poboljšanja i novih značajki u Gredicama.',
    documentTitle: 'Što je novo | Gredice',
    imageAlt: 'Što je novo u Gredicama – promjene i nove mogućnosti',
    imageUrl: 'https://www.gredice.com/novosti/sto-je-novo/opengraph-image',
    title: 'Što je novo u Gredicama',
} satisfies NewsArchiveSeo;

export const blogArchiveMetadata = createNewsArchiveMetadata(blogArchiveSeo);

export const changelogArchiveMetadata =
    createNewsArchiveMetadata(changelogArchiveSeo);
