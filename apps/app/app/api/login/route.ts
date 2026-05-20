import { getServerGrediceApiOrigin } from '@gredice/client';
import { setCookie } from '../../../lib/auth/auth';
import { setRefreshCookie } from '../../../lib/auth/refreshCookies';

const API_BASE_URL = getServerGrediceApiOrigin();

function isLoginResponse(
    data: unknown,
): data is { token: string; refreshToken?: string } {
    return (
        typeof data === 'object' &&
        data !== null &&
        'token' in data &&
        typeof data.token === 'string'
    );
}

export async function POST(request: Request) {
    const body = await request.json();
    const { email, password } = body;
    if (!email || !password) {
        return new Response('User name and password are required', {
            status: 400,
        });
    }

    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });
    } catch {
        return Response.json({ error: 'api_unavailable' }, { status: 502 });
    }

    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        return Response.json(data ?? { error: 'login_failed' }, {
            status: response.status,
        });
    }

    if (!isLoginResponse(data)) {
        return Response.json(
            { error: 'invalid_login_response' },
            { status: 502 },
        );
    }

    if (data?.refreshToken) {
        await setRefreshCookie(data.refreshToken);
    }
    await setCookie(data.token);

    return Response.json({ success: true });
}
