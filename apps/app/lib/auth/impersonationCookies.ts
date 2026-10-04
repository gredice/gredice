import type { cookies } from 'next/headers';
import { authCookieSettings } from './cookieSecurity';
import {
    cookieDomain,
    impersonationFlagCookieName,
    impersonationRefreshCookieName,
} from './sessionConfig';

function clearImpersonationCookie(
    cookieStore: Awaited<ReturnType<typeof cookies>>,
    name: string,
    {
        domain,
        httpOnly,
        secure,
    }: {
        domain: string | undefined;
        httpOnly: boolean;
        secure: boolean;
    },
) {
    cookieStore.set(name, '', {
        httpOnly,
        secure,
        sameSite: 'lax',
        domain,
        maxAge: 0,
    });
}

export async function clearImpersonationCookies(
    cookieStore: Awaited<ReturnType<typeof cookies>>,
) {
    const cookieSettings = await authCookieSettings();

    clearImpersonationCookie(cookieStore, impersonationRefreshCookieName, {
        domain: cookieDomain,
        httpOnly: true,
        secure: cookieSettings.secure,
    });

    clearImpersonationCookie(cookieStore, impersonationFlagCookieName, {
        domain: cookieSettings.domain,
        httpOnly: false,
        secure: cookieSettings.secure,
    });

    if (cookieSettings.domain !== cookieDomain) {
        clearImpersonationCookie(cookieStore, impersonationFlagCookieName, {
            domain: cookieDomain,
            httpOnly: false,
            secure: cookieSettings.secure,
        });
    }
}
