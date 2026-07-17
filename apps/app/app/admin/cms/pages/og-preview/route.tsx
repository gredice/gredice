import {
    CmsOgImage,
    type CmsOgImageKind,
    cmsOgImageContentType,
    cmsOgImageSize,
} from '@gredice/ui/cms';
import { ImageResponse } from 'next/og';
import { withAuth } from '../../../../../lib/auth/auth';

function parseOgImageKind(value: string | null): CmsOgImageKind {
    if (value === 'blog' || value === 'changelog') {
        return value;
    }

    return 'page';
}

function parseTags(searchParams: URLSearchParams) {
    const tags = [
        ...searchParams.getAll('tag'),
        ...(searchParams.get('tags') ?? '').split(','),
    ];

    return tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 8);
}

function parsePointOfInterest(value: string | null) {
    const coordinate = Number(value);
    return Number.isInteger(coordinate) && coordinate >= 0 && coordinate <= 100
        ? coordinate
        : null;
}

export async function GET(request: Request) {
    return await withAuth(['admin'], async () => {
        const { searchParams } = new URL(request.url);
        const title = searchParams.get('title')?.trim() || 'Gredice';
        const imageUrl = searchParams.get('imageUrl')?.trim() || null;

        return new ImageResponse(
            <CmsOgImage
                imageUrl={imageUrl}
                kind={parseOgImageKind(searchParams.get('contentKind'))}
                pointOfInterestX={parsePointOfInterest(
                    searchParams.get('pointOfInterestX'),
                )}
                pointOfInterestY={parsePointOfInterest(
                    searchParams.get('pointOfInterestY'),
                )}
                tags={parseTags(searchParams)}
                title={title}
            />,
            {
                ...cmsOgImageSize,
                headers: {
                    'cache-control': 'private, no-store',
                    'content-type': cmsOgImageContentType,
                },
            },
        );
    });
}
