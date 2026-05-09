import type { cookies } from 'next/headers';
import {
    cookieDomain,
    impersonationFlagCookieName,
    impersonationRefreshCookieName,
} from './sessionConfig';

export function clearImpersonationCookies(
    cookieStore: Awaited<ReturnType<typeof cookies>>,
) {
    cookieStore.set(impersonationRefreshCookieName, '', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        domain: cookieDomain,
        maxAge: 0,
    });
    cookieStore.set(impersonationFlagCookieName, '', {
        httpOnly: false,
        secure: true,
        sameSite: 'lax',
        domain: cookieDomain,
        maxAge: 0,
    });
}
