import { createRefreshToken } from '@gredice/storage';
import { createJwt, setCookie, withAuth } from '../../../../../lib/auth/auth';
import { setRefreshCookie } from '../../../../../lib/auth/refreshCookies';

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ userId: string }> },
) {
    const { userId } = await params;
    if (!userId) {
        return new Response(null, { status: 400 });
    }

    return await withAuth(['admin'], async () => {
        const [accessToken, refreshToken] = await Promise.all([
            createJwt(userId),
            createRefreshToken(userId),
        ]);
        await setCookie(accessToken);
        setRefreshCookie(refreshToken);
        return new Response(null, { status: 201 });
    });
}
