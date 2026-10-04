import { getCmsPage } from '@gredice/storage';
import { auth } from '../../../../../../../lib/auth/auth';

export const dynamic = 'force-dynamic';

const localCmsPagePreviewSecret = 'local-preview-secret';

function isLocalPreviewHost(hostname: string) {
    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.gredice.test')
    );
}

function cmsPagePreviewSecret(request: Request) {
    const configuredSecret = process.env.CMS_PAGES_PREVIEW_SECRET?.trim();
    if (configuredSecret) {
        return configuredSecret;
    }

    const requestHost = new URL(request.url).hostname;
    const targetHost = new URL(publicWwwOrigin(request)).hostname;
    if (isLocalPreviewHost(requestHost) && isLocalPreviewHost(targetHost)) {
        return localCmsPagePreviewSecret;
    }

    return null;
}

function publicWwwOrigin(request: Request) {
    const requestUrl = new URL(request.url);
    if (requestUrl.hostname.endsWith('.gredice.test')) {
        requestUrl.protocol = 'https:';
        requestUrl.hostname = 'www.gredice.test';
        return requestUrl.origin;
    }

    const configuredOrigin = process.env.NEXT_PUBLIC_GREDICE_WWW_ORIGIN?.trim();
    if (configuredOrigin) {
        return configuredOrigin;
    }

    if (isLocalPreviewHost(requestUrl.hostname)) {
        return `http://${requestUrl.host}`;
    }

    return 'https://www.gredice.com';
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ pageId: string }> },
) {
    await auth(['admin']);

    const previewSecret = cmsPagePreviewSecret(request);
    if (!previewSecret) {
        return new Response('CMS page public preview is not configured.', {
            status: 500,
        });
    }

    const { pageId } = await params;
    const id = Number.parseInt(pageId, 10);
    if (Number.isNaN(id)) {
        return new Response('Page not found.', { status: 404 });
    }

    const page = await getCmsPage(id);
    if (!page) {
        return new Response('Page not found.', { status: 404 });
    }

    const previewUrl = new URL('/api/draft', publicWwwOrigin(request));
    previewUrl.searchParams.set('secret', previewSecret);
    previewUrl.searchParams.set('slug', `/${page.slug}`);

    return Response.redirect(previewUrl, 307);
}
