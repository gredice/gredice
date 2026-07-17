import {
    CmsOgImage,
    cmsOgImageContentType,
    cmsOgImageSize,
} from '@gredice/ui/cms';
import { ImageResponse } from 'next/og';
import { getChangelogEntry } from '../../../lib/news';

export const alt = 'Gredice što je novo';
export const size = cmsOgImageSize;
export const contentType = cmsOgImageContentType;
export const dynamic = 'force-dynamic';

export default async function ChangelogOpenGraphImage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const entry = await getChangelogEntry(slug);

    return new ImageResponse(
        <CmsOgImage
            imageUrl={entry?.metaImageUrl}
            kind="changelog"
            pointOfInterestX={entry?.metaImagePoiX}
            pointOfInterestY={entry?.metaImagePoiY}
            tags={entry?.tags ?? []}
            title={entry?.title ?? 'Što je novo'}
        />,
        {
            ...size,
        },
    );
}
