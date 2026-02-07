import { setCookie } from '../../../lib/auth/auth';
import { setRefreshCookie } from '../../../lib/auth/refreshCookies';

export async function POST(request: Request) {
    const body = await request.json();
    const { token, refreshToken } = body;
    if (!token) {
        return new Response('Token is required', { status: 400 });
    }

    if (refreshToken) {
        await setRefreshCookie(refreshToken);
    }
    await setCookie(token);

    return Response.json({ success: true });
}
