const allowedProductionOrigins = new Set([
    'https://api.gredice.com',
    'https://app.gredice.com',
    'https://farma.gredice.com',
    'https://gredice.com',
    'https://status.gredice.com',
    'https://vrt.gredice.com',
    'https://www.gredice.com',
]);

const vercelPreviewProjectPrefixes = [
    'api',
    'app',
    'farm',
    'garden',
    'news',
    'status',
    'storybook',
    'www',
];

function isLoopbackHostname(hostname: string) {
    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '[::1]'
    );
}

function isLocalGrediceHostname(hostname: string) {
    return hostname === 'gredice.test' || hostname.endsWith('.gredice.test');
}

function isGrediceVercelPreviewHostname(hostname: string) {
    return vercelPreviewProjectPrefixes.some(
        (prefix) =>
            hostname === `${prefix}-gredice.vercel.app` ||
            (hostname.startsWith(`${prefix}-`) &&
                hostname.endsWith('-gredice.vercel.app')),
    );
}

export function isAllowedCorsOrigin(origin: string) {
    let parsed: URL;
    try {
        parsed = new URL(origin);
    } catch {
        return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        (isLoopbackHostname(hostname) || isLocalGrediceHostname(hostname))
    ) {
        return true;
    }

    if (parsed.protocol !== 'https:') {
        return false;
    }

    return (
        allowedProductionOrigins.has(parsed.origin) ||
        isGrediceVercelPreviewHostname(hostname)
    );
}

export function resolveCorsOrigin(origin: string) {
    return isAllowedCorsOrigin(origin) ? origin : undefined;
}
