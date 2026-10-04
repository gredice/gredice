import {
    CmsOgImage,
    cmsOgImageContentType,
    cmsOgImageSize,
} from '@gredice/ui/cms';
import { ImageResponse } from 'next/og';
import { newsArchiveSeo } from '../lib/newsArchiveMetadata';

export const alt = newsArchiveSeo.imageAlt;
export const size = cmsOgImageSize;
export const contentType = cmsOgImageContentType;

export default function NewsArchiveOpenGraphImage() {
    return new ImageResponse(
        <CmsOgImage
            kind="blog"
            tags={['Blog', 'Što je novo']}
            title={newsArchiveSeo.title}
        />,
        {
            ...size,
        },
    );
}
