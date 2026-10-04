import { headers } from 'next/headers';

function isLoopbackHost(hostname: string) {
    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname === '[::1]'
    );
}

type RequestCookieContext = {
    forwardedProto?: string;
    host: string;
    origin?: string;
};

type AuthCookieSettings = {
    domain: string | undefined;
    secure: boolean;
};

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
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
        return false;
    }

    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
        return true;
    }

    throw new Error(`Invalid GREDICE_SECURE_AUTH_COOKIES value: ${override}`);
}

async function requestCookieContext(): Promise<RequestCookieContext> {
    const requestHeaders = await headers();
    return {
        forwardedProto: requestHeaders
            .get('x-forwarded-proto')
            ?.split(',')[0]
            ?.trim()
            .toLowerCase(),
        host: hostnameFromHostHeader(
            requestHeaders.get('x-forwarded-host') ??
                requestHeaders.get('host') ??
                '',
        ),
        origin:
            requestHeaders.get('origin') ??
            requestHeaders.get('referer') ??
            undefined,
    };
}

function shouldUseSecureCookiesForContext(context: RequestCookieContext) {
    const override = secureCookieOverride();
    if (override !== null) {
        return override;
    }

    if (context.forwardedProto) {
        return context.forwardedProto === 'https';
    }

    if (context.origin) {
        try {
            const originUrl = new URL(context.origin);
            return !(
                originUrl.protocol === 'http:' &&
                isLoopbackHost(originUrl.hostname)
            );
        } catch {
            // Fall through to host-based development detection.
        }
    }

    return !(
        process.env.NODE_ENV === 'development' && isLoopbackHost(context.host)
    );
}

function configuredCookieDomain() {
    const domain = process.env.COOKIE_DOMAIN?.trim();
    return domain || undefined;
}

function inferredGrediceCookieDomain(hostname: string) {
    if (hostname === 'gredice.com' || hostname.endsWith('.gredice.com')) {
        return 'gredice.com';
    }

    if (hostname === 'gredice.test' || hostname.endsWith('.gredice.test')) {
        return 'gredice.test';
    }

    return undefined;
}

function cookieDomainForContext(context: RequestCookieContext) {
    if (isLoopbackHost(context.host)) {
        return undefined;
    }

    return (
        configuredCookieDomain() ?? inferredGrediceCookieDomain(context.host)
    );
}

export function resolveAuthCookieSettingsForContext(
    context: RequestCookieContext,
): AuthCookieSettings {
    return {
        domain: cookieDomainForContext(context),
        secure: shouldUseSecureCookiesForContext(context),
    };
}

export async function authCookieSettings() {
    const context = await requestCookieContext();
    return resolveAuthCookieSettingsForContext(context);
}
