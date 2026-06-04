import {
    CmsOgImage,
    cmsOgImageSize,
} from '@gredice/ui/cms';
import { ImageResponse } from 'next/og';
import {
    type CmsRoutePage,
    fetchCmsDirectoryPage,
} from '../../../../[...slug]/cmsPageData';
import {
    hasReservedFirstSegment,
    normalizeCmsRouteSlug,
} from '../../../../[...slug]/cmsPageRouteUtils';
import { getSourceCmsPageBySlug } from '../../../../[...slug]/sourceCmsPages';

export const dynamic = 'force-dynamic';

function pageOgKind(contentKind: string | null | undefined) {
    if (contentKind === 'blog' || contentKind === 'changelog') {
        return contentKind;
    }

    return 'page';
}

async function resolveCmsOgPage(normalizedSlug: string) {
    const sourcePage = getSourceCmsPageBySlug(normalizedSlug);
    const response = await fetchCmsDirectoryPage({
        normalizedSlug,
        suppressFetchError: Boolean(sourcePage),
    });

    if (response?.status === 200) {
        const page: CmsRoutePage = await response.json();
        return page;
    }

    return sourcePage;
}

export async function GET(
    _request: Request,
    {
        params,
    }: {
        params: Promise<{ slug: string[] }>;
    },
) {
    const { slug } = await params;
    const normalizedSlug = normalizeCmsRouteSlug(slug);
    const page =
        normalizedSlug && !hasReservedFirstSegment(normalizedSlug)
            ? await resolveCmsOgPage(normalizedSlug)
            : null;

    return new ImageResponse(
        <CmsOgImage
            imageUrl={page?.metaImageUrl}
            kind={pageOgKind(page?.contentKind)}
            tags={page?.tags ?? []}
            title={page?.title ?? 'Gredice'}
        />,
        {
            ...cmsOgImageSize,
        },
    );
}
