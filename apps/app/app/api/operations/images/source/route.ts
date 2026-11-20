import { getOperationById } from '@gredice/storage';
import { withAuth } from '../../../../../lib/auth/auth';
import { isGrediceWebsiteImage } from '../../../../../lib/operationPhotoUpload';

// Older website/CDN attachments can be displayed cross-origin but lack CORS
// headers. Serve their original bytes only for images attached to this operation.
export async function GET(request: Request) {
    return withAuth(['admin'], async () => {
        const { searchParams } = new URL(request.url);
        const operationId = Number(searchParams.get('operationId'));
        const src = searchParams.get('src');
        if (
            !Number.isSafeInteger(operationId) ||
            operationId < 1 ||
            !src ||
            !isGrediceWebsiteImage(src)
        ) {
            return new Response(null, { status: 400 });
        }
        const operation = await getOperationById(operationId);
        if (!operation?.imageUrls?.includes(src))
            return new Response(null, { status: 404 });
        let response: Response;
        try {
            response = await fetch(src, {
                redirect: 'error',
                cache: 'no-store',
                signal: request.signal,
            });
        } catch {
            return new Response(null, { status: 502 });
        }
        const type = response.headers.get('content-type');
        if (!response.ok || !type?.startsWith('image/')) {
            await response.body?.cancel();
            return new Response(null, { status: 502 });
        }
        return new Response(response.body, {
            headers: {
                'Content-Type': type,
                'Content-Disposition': 'attachment',
                'Content-Security-Policy': "default-src 'none'; sandbox",
                'Cache-Control': 'private, no-store',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    });
}
