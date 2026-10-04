import { ImageResponse } from 'next/og';
import { createElement } from 'react';
import {
    buildPublicOgCanonicalSearchParams,
    isValidPublicOgSearchParams,
    MAXIMUM_PUBLIC_OG_QUERY_LENGTH,
    PUBLIC_OG_IMAGE_SIZE,
    parsePublicOgCardSearchParams,
} from '../../../../lib/seo/publicMetadata';
import {
    resolvePublicOgSigningConfig,
    verifyPublicOgSignature,
} from '../../../../lib/seo/publicOgSignature';
import { resolvePublicOgImageDataUrl } from '../../../../lib/seo/resolvePublicOgImage';
import { PublicOgCard } from './PublicOgCard';

export const runtime = 'nodejs';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const isValidRequest =
        requestUrl.search.length <= MAXIMUM_PUBLIC_OG_QUERY_LENGTH &&
        isValidPublicOgSearchParams(requestUrl.searchParams);
    const card = isValidRequest
        ? parsePublicOgCardSearchParams(requestUrl.searchParams)
        : null;

    if (!card) {
        return new Response('Invalid Open Graph card request.', {
            headers: { 'Cache-Control': 'no-store' },
            status: 400,
        });
    }

    const signingConfig = resolvePublicOgSigningConfig();
    const signatureVerification = verifyPublicOgSignature(
        requestUrl.search.slice(1),
        buildPublicOgCanonicalSearchParams(card),
        signingConfig,
    );
    if (signatureVerification === 'configuration-error') {
        return new Response('Open Graph signing is not configured.', {
            headers: { 'Cache-Control': 'no-store' },
            status: 503,
        });
    }
    if (
        signatureVerification !== 'valid' &&
        signatureVerification !== 'unsigned-local'
    ) {
        return new Response('Invalid Open Graph card signature.', {
            headers: { 'Cache-Control': 'no-store' },
            status: 401,
        });
    }

    const imageUrl = await resolvePublicOgImageDataUrl(card.imageUrl);
    const coverResolutionFailed = Boolean(card.imageUrl && !imageUrl);

    return new ImageResponse(
        createElement(PublicOgCard, {
            ...card,
            imageUrl,
        }),
        {
            ...PUBLIC_OG_IMAGE_SIZE,
            headers: {
                'Cache-Control': coverResolutionFailed
                    ? 'no-store'
                    : 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
            },
        },
    );
}
