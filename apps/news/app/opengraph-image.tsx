import {
    CmsOgImage,
    cmsOgImageContentType,
    cmsOgImageSize,
} from '@gredice/ui/cms';
import { ImageResponse } from 'next/og';
import { blogArchiveSeo } from '../lib/newsArchiveMetadata';

export const alt = blogArchiveSeo.imageAlt;
export const size = cmsOgImageSize;
export const contentType = cmsOgImageContentType;

export default function BlogArchiveOpenGraphImage() {
    return new ImageResponse(
        <CmsOgImage kind="blog" tags={['Blog']} title={blogArchiveSeo.title} />,
        {
            ...size,
        },
    );
}
