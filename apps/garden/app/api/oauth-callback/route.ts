import { cookies } from 'next/headers';

const accessTokenExpiryMs = 15 * 60 * 1000;
const refreshTokenExpiryMs = 30 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
    const body = await request.json();
    const { token, refreshToken } = body;
    if (!token) {
        return new Response('Token is required', { status: 400 });
    }

    const cookieStore = await cookies();

    cookieStore.set('gredice_session', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        expires: new Date(Date.now() + accessTokenExpiryMs),
    });

    if (refreshToken) {
        cookieStore.set('gredice_refresh', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            expires: new Date(Date.now() + refreshTokenExpiryMs),
        });
    }

    return Response.json({ success: true });
}
