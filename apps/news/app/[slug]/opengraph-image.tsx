import {
    CmsOgImage,
    cmsOgImageContentType,
    cmsOgImageSize,
} from '@gredice/ui/cms';
import { ImageResponse } from 'next/og';
import { getBlogPost } from '../../lib/news';

export const alt = 'Gredice novosti';
export const size = cmsOgImageSize;
export const contentType = cmsOgImageContentType;
export const dynamic = 'force-dynamic';

export default async function BlogPostOpenGraphImage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const entry = await getBlogPost(slug);

    return new ImageResponse(
        <CmsOgImage
            imageUrl={entry?.metaImageUrl}
            kind="blog"
            pointOfInterestX={entry?.metaImagePoiX}
            pointOfInterestY={entry?.metaImagePoiY}
            tags={entry?.tags ?? []}
            title={entry?.title ?? 'Novosti'}
        />,
        {
            ...size,
        },
    );
}
