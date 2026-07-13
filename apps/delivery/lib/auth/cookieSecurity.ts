import { headers } from 'next/headers';

function isLoopbackHost(hostname: string) {
    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname === '[::1]'
    );
}

function hostnameFromHostHeader(hostHeader: string) {
    try {
        return new URL(`http://${hostHeader}`).hostname;
    } catch {
        return hostHeader.split(':')[0] ?? '';
    }
}

function secureCookieOverride() {
    const override = process.env.GREDICE_SECURE_AUTH_COOKIES?.trim();
    if (!override) {
        return null;
    }
    const normalized = override.toLowerCase();
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    throw new Error(`Invalid GREDICE_SECURE_AUTH_COOKIES value: ${override}`);
}

export async function authCookieSettings() {
    const requestHeaders = await headers();
    const forwardedProto = requestHeaders
        .get('x-forwarded-proto')
        ?.split(',')[0]
        ?.trim()
        .toLowerCase();
    const host = hostnameFromHostHeader(
        requestHeaders.get('x-forwarded-host') ??
            requestHeaders.get('host') ??
            '',
    );
    const origin =
        requestHeaders.get('origin') ?? requestHeaders.get('referer');
    const override = secureCookieOverride();
    let secure = override;
    if (secure === null && forwardedProto) {
        secure = forwardedProto === 'https';
    }
    if (secure === null && origin) {
        try {
            const url = new URL(origin);
            secure = !(
                url.protocol === 'http:' && isLoopbackHost(url.hostname)
            );
        } catch {
            secure = null;
        }
    }
    if (secure === null) {
        secure = !(
            process.env.NODE_ENV === 'development' && isLoopbackHost(host)
        );
    }

    return {
        domain: isLoopbackHost(host)
            ? undefined
            : process.env.COOKIE_DOMAIN || undefined,
        secure,
    };
}
