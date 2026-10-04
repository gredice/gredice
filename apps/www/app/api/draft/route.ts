import { draftMode } from 'next/headers';

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

    const hostname = new URL(request.url).hostname;
    return isLocalPreviewHost(hostname) ? localCmsPagePreviewSecret : null;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const slug = searchParams.get('slug') ?? '/';
    const expectedSecret = cmsPagePreviewSecret(request);

    if (!secret || secret !== expectedSecret) {
        return new Response('Invalid token', { status: 401 });
    }

    const redirectPath = slug.startsWith('/') ? slug : `/${slug}`;
    if (redirectPath.startsWith('//')) {
        return new Response('Invalid slug', { status: 400 });
    }

    const draft = await draftMode();
    draft.enable();

    return Response.redirect(new URL(redirectPath, request.url), 307);
}
