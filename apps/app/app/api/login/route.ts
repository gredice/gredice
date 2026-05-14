import { setCookie } from '../../../lib/auth/auth';
import { setRefreshCookie } from '../../../lib/auth/refreshCookies';

const API_BASE_URL =
    process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'
        ? 'https://api.gredice.com'
        : 'http://localhost:3005';

export async function POST(request: Request) {
    const body = await request.json();
    const { email, password } = body;
    if (!email || !password) {
        return new Response('User name and password are required', {
            status: 400,
        });
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });
    const data = await response.json();

    if (data?.refreshToken) {
        await setRefreshCookie(data.refreshToken);
    }
    await setCookie(data.token);

    return Response.json({ success: true });
}
