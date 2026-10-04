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

export const newsArchiveSeo = {
    canonicalUrl: 'https://www.gredice.com/novosti',
    description:
        'Blog objave i tjedni pregled novih mogućnosti, poboljšanja i promjena u Gredicama.',
    documentTitle: 'Novosti | Gredice',
    imageAlt: 'Novosti iz Gredica – blog objave i nove mogućnosti',
    imageUrl: 'https://www.gredice.com/novosti/opengraph-image',
    title: 'Novosti iz Gredica',
} satisfies NewsArchiveSeo;

export const changelogArchiveSeo = {
    canonicalUrl: 'https://www.gredice.com/novosti/sto-je-novo',
    description:
        'Tjedni sažeci nadogradnji, poboljšanja i novih značajki u Gredicama, s poveznicama na svaku promjenu.',
    documentTitle: 'Što je novo | Gredice',
    imageAlt: 'Što je novo u Gredicama – tjedni sažeci promjena',
    imageUrl: 'https://www.gredice.com/novosti/sto-je-novo/opengraph-image',
    title: 'Što je novo u Gredicama',
} satisfies NewsArchiveSeo;

export const newsArchiveMetadata = createNewsArchiveMetadata(newsArchiveSeo);

export const changelogArchiveMetadata =
    createNewsArchiveMetadata(changelogArchiveSeo);
