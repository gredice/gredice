const allowedImpersonationOrigins = new Set([
    'app.gredice.com',
    'app.gredice.test',
    'www.gredice.com',
    'www.gredice.test',
    'vrt.gredice.com',
    'vrt.gredice.test',
    'farma.gredice.com',
    'farma.gredice.test',
    'dostava.gredice.com',
    'dostava.gredice.test',
]);

export function isAllowedImpersonationOrigin(origin: string | null) {
    if (!origin) {
        return false;
    }

    try {
        const url = new URL(origin);
        return (
            url.protocol === 'https:' &&
            allowedImpersonationOrigins.has(url.hostname)
        );
    } catch {
        return false;
    }
}
