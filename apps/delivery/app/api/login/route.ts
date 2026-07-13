import { getServerGrediceApiOrigin } from '@gredice/client';
import { setCookie } from '../../../lib/auth/auth';
import { setRefreshCookie } from '../../../lib/auth/refreshCookies';

function isLoginResponse(
    value: unknown,
): value is { token: string; refreshToken?: string } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'token' in value &&
        typeof value.token === 'string'
    );
}

export async function POST(request: Request) {
    const body: unknown = await request.json().catch(() => null);
    if (
        typeof body !== 'object' ||
        body === null ||
        !('email' in body) ||
        !('password' in body) ||
        typeof body.email !== 'string' ||
        typeof body.password !== 'string'
    ) {
        return Response.json({ error: 'invalid_credentials' }, { status: 400 });
    }

    let response: Response;
    try {
        response = await fetch(
            `${getServerGrediceApiOrigin()}/api/auth/login`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: body.email,
                    password: body.password,
                }),
            },
        );
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

    if (data.refreshToken) await setRefreshCookie(data.refreshToken);
    await setCookie(data.token);
    return Response.json({ success: true });
}
