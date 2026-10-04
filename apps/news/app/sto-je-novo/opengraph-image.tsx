import {
    CmsOgImage,
    cmsOgImageContentType,
    cmsOgImageSize,
} from '@gredice/ui/cms';
import { ImageResponse } from 'next/og';
import { changelogArchiveSeo } from '../../lib/newsArchiveMetadata';

export const alt = changelogArchiveSeo.imageAlt;
export const size = cmsOgImageSize;
export const contentType = cmsOgImageContentType;

export default function ChangelogArchiveOpenGraphImage() {
    return new ImageResponse(
        <CmsOgImage
            kind="changelog"
            tags={['Nadogradnje', 'Poboljšanja']}
            title={changelogArchiveSeo.title}
        />,
        {
            ...size,
        },
    );
}
