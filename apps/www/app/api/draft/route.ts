import { draftMode } from 'next/headers';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const slug = searchParams.get('slug') ?? '/';

    if (!secret || secret !== process.env.CMS_PAGES_PREVIEW_SECRET) {
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
