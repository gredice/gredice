import type { Metadata } from 'next';
import {
    addPublicOgSignature,
    PUBLIC_OG_SIGNATURE_PARAMETER,
    type PublicOgSigningConfig,
    resolvePublicOgSigningConfig,
} from './publicOgSignature.ts';

export const PUBLIC_SITE_ORIGIN = 'https://www.gredice.com';
export const MAXIMUM_PUBLIC_OG_QUERY_LENGTH = 4096;
export const PUBLIC_OG_IMAGE_SIZE = {
    width: 1200,
    height: 630,
} as const;

const PUBLIC_OG_ENDPOINT = '/api/og/public';
const textLimits = {
    title: 96,
    description: 190,
    eyebrow: 48,
    imageAlt: 120,
} as const;
const maximumImageUrlLength = 2048;
// Keep aligned with the public image tenants in packages/js/src/urls/safeUrls.ts.
const publicVercelBlobHosts = new Set([
    'myegtvromcktt2y7.public.blob.vercel-storage.com',
    '7ql7fvz1vzzo6adz.public.blob.vercel-storage.com',
]);

export type PublicOgCardData = {
    title: string;
    description: string;
    eyebrow?: string;
    imageUrl?: string;
};

export type PublicMetadataOptions = {
    title: string;
    description: string;
    path?: string | null;
    eyebrow?: string;
    category?: string;
    imageUrl?: string | null;
    imageAlt?: string;
    keywords?: Metadata['keywords'];
    robots?: Metadata['robots'];
};

function truncateText(value: string, maximumLength: number) {
    const characters = Array.from(value);

    if (characters.length <= maximumLength) {
        return value;
    }

    return `${characters
        .slice(0, maximumLength - 1)
        .join('')
        .trimEnd()}…`;
}

function stripUnsafeOgCharacters(value: string) {
    return Array.from(value, (character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        const isControlCharacter =
            codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
        const isBidirectionalOverride =
            (codePoint >= 0x202a && codePoint <= 0x202e) ||
            (codePoint >= 0x2066 && codePoint <= 0x2069);

        return isControlCharacter || isBidirectionalOverride ? ' ' : character;
    }).join('');
}

export function sanitizePublicOgText(
    value: string | null | undefined,
    maximumLength: number,
) {
    if (!value) {
        return '';
    }

    const normalized = stripUnsafeOgCharacters(value)
        .replace(/\s+/g, ' ')
        .trim();

    return truncateText(normalized, maximumLength);
}

export function sanitizePublicOgImageUrl(value: string | null | undefined) {
    if (!value || value.length > maximumImageUrlLength) {
        return undefined;
    }

    try {
        const url = new URL(value);
        if (url.href.length > maximumImageUrlLength) {
            return undefined;
        }
        const hostname = url.hostname.toLowerCase();
        const isGrediceCdn = hostname === 'cdn.gredice.com';
        const isPublicWwwAsset =
            hostname === 'www.gredice.com' &&
            (url.pathname.startsWith('/assets/') ||
                url.pathname === '/seo-fallback.png');
        const isGardenAsset =
            hostname === 'vrt.gredice.com' &&
            url.pathname.startsWith('/assets/');
        const isPublicVercelBlob = publicVercelBlobHosts.has(hostname);

        if (
            url.protocol !== 'https:' ||
            url.port !== '' ||
            url.username !== '' ||
            url.password !== '' ||
            !(
                isGrediceCdn ||
                isPublicWwwAsset ||
                isGardenAsset ||
                isPublicVercelBlob
            )
        ) {
            return undefined;
        }

        return url.href;
    } catch {
        return undefined;
    }
}

function normalizePublicPath(path: string | null | undefined) {
    if (path === null || path === undefined) {
        return undefined;
    }

    const normalized = path.trim();
    if (!normalized.startsWith('/') || normalized.startsWith('//')) {
        throw new Error('Public metadata paths must be root-relative.');
    }

    const url = new URL(normalized, PUBLIC_SITE_ORIGIN);
    if (url.origin !== PUBLIC_SITE_ORIGIN || url.hash) {
        throw new Error(
            'Public metadata paths must use the public site origin.',
        );
    }

    return `${url.pathname}${url.search}`;
}

function requiredCardText(value: string, field: 'title' | 'description') {
    const sanitized = sanitizePublicOgText(value, textLimits[field]);
    if (!sanitized) {
        throw new Error(`Public metadata ${field} must not be empty.`);
    }

    return sanitized;
}

export function buildPublicOgCanonicalSearchParams({
    title,
    description,
    eyebrow,
    imageUrl,
}: PublicOgCardData) {
    const searchParams = new URLSearchParams({
        title: requiredCardText(title, 'title'),
        description: requiredCardText(description, 'description'),
    });
    const sanitizedEyebrow = sanitizePublicOgText(eyebrow, textLimits.eyebrow);
    const sanitizedImageUrl = sanitizePublicOgImageUrl(imageUrl);

    if (sanitizedEyebrow) {
        searchParams.set('eyebrow', sanitizedEyebrow);
    }
    if (sanitizedImageUrl) {
        searchParams.set('image', sanitizedImageUrl);
    }

    return searchParams;
}

export function buildPublicOgImagePath(
    card: PublicOgCardData,
    signingConfig: PublicOgSigningConfig = resolvePublicOgSigningConfig(),
) {
    const canonicalSearchParams = buildPublicOgCanonicalSearchParams(card);
    let signedSearchParams = addPublicOgSignature(
        canonicalSearchParams,
        signingConfig,
    );

    if (
        signedSearchParams.toString().length + 1 >
            MAXIMUM_PUBLIC_OG_QUERY_LENGTH &&
        canonicalSearchParams.has('image')
    ) {
        canonicalSearchParams.delete('image');
        signedSearchParams = addPublicOgSignature(
            canonicalSearchParams,
            signingConfig,
        );
    }

    if (
        signedSearchParams.toString().length + 1 >
        MAXIMUM_PUBLIC_OG_QUERY_LENGTH
    ) {
        throw new Error('Public Open Graph card query exceeds the size limit.');
    }

    return `${PUBLIC_OG_ENDPOINT}?${signedSearchParams.toString()}`;
}

export function parsePublicOgCardSearchParams(
    searchParams: URLSearchParams,
): PublicOgCardData | null {
    const title = sanitizePublicOgText(
        searchParams.get('title'),
        textLimits.title,
    );
    const description = sanitizePublicOgText(
        searchParams.get('description'),
        textLimits.description,
    );

    if (!title || !description) {
        return null;
    }

    const eyebrow = sanitizePublicOgText(
        searchParams.get('eyebrow') ?? searchParams.get('category'),
        textLimits.eyebrow,
    );
    const imageUrl = sanitizePublicOgImageUrl(searchParams.get('image'));

    return {
        title,
        description,
        ...(eyebrow ? { eyebrow } : {}),
        ...(imageUrl ? { imageUrl } : {}),
    };
}

export function isValidPublicOgSearchParams(searchParams: URLSearchParams) {
    const allowedKeys = new Set([
        'title',
        'description',
        'eyebrow',
        'category',
        'image',
        PUBLIC_OG_SIGNATURE_PARAMETER,
    ]);

    for (const key of searchParams.keys()) {
        if (!allowedKeys.has(key) || searchParams.getAll(key).length !== 1) {
            return false;
        }
    }

    if (searchParams.has('eyebrow') && searchParams.has('category')) {
        return false;
    }

    const card = parsePublicOgCardSearchParams(searchParams);
    if (
        !card ||
        searchParams.get('title') !== card.title ||
        searchParams.get('description') !== card.description
    ) {
        return false;
    }

    const eyebrowKey = searchParams.has('eyebrow') ? 'eyebrow' : 'category';
    if (
        searchParams.has(eyebrowKey) &&
        searchParams.get(eyebrowKey) !== card.eyebrow
    ) {
        return false;
    }

    const requestedImage = searchParams.get('image');
    if (
        searchParams.has('image') &&
        requestedImage !== sanitizePublicOgImageUrl(requestedImage)
    ) {
        return false;
    }

    return true;
}

export function createPublicMetadata(
    {
        title,
        description,
        path,
        eyebrow,
        category,
        imageUrl,
        imageAlt,
        keywords,
        robots,
    }: PublicMetadataOptions,
    signingConfig: PublicOgSigningConfig = resolvePublicOgSigningConfig(),
): Metadata {
    const safeTitle = requiredCardText(title, 'title');
    const safeDescription = requiredCardText(description, 'description');
    const canonicalPath = normalizePublicPath(path);
    const imagePath = buildPublicOgImagePath(
        {
            title: safeTitle,
            description: safeDescription,
            eyebrow: eyebrow ?? category,
            imageUrl: imageUrl ?? undefined,
        },
        signingConfig,
    );
    const fallbackImageAlt = safeTitle
        .toLocaleLowerCase('hr-HR')
        .includes('gredice')
        ? safeTitle
        : `${safeTitle} – Gredice`;
    const safeImageAlt =
        sanitizePublicOgText(imageAlt, textLimits.imageAlt) || fallbackImageAlt;
    const openGraphImage = {
        url: imagePath,
        width: PUBLIC_OG_IMAGE_SIZE.width,
        height: PUBLIC_OG_IMAGE_SIZE.height,
        alt: safeImageAlt,
        type: 'image/png',
    };

    return {
        title: safeTitle,
        description: safeDescription,
        ...(canonicalPath
            ? {
                  alternates: {
                      canonical: canonicalPath,
                  },
              }
            : {}),
        ...(robots ? { robots } : {}),
        ...(keywords !== undefined ? { keywords } : {}),
        openGraph: {
            type: 'website',
            locale: 'hr_HR',
            siteName: 'Gredice',
            title: safeTitle,
            description: safeDescription,
            ...(canonicalPath ? { url: canonicalPath } : {}),
            images: [openGraphImage],
        },
        twitter: {
            card: 'summary_large_image',
            title: safeTitle,
            description: safeDescription,
            images: [
                {
                    url: imagePath,
                    alt: safeImageAlt,
                },
            ],
        },
    };
}
