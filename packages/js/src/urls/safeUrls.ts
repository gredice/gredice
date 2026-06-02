/** Vercel Blob Storage hostnames that are allowed as image sources. */
const allowedImageHosts = new Set([
    'myegtvromcktt2y7.public.blob.vercel-storage.com',
    '7ql7fvz1vzzo6adz.public.blob.vercel-storage.com',
]);

const allowedLocalLinkHosts = new Set([
    'localhost',
    '127.0.0.1',
    'app.gredice.test',
    'vrt.gredice.test',
    'farma.gredice.test',
]);

export function validateHostedImageUrl(imageUrl: string): string | null {
    let parsed: URL;
    try {
        parsed = new URL(imageUrl);
    } catch {
        return 'Invalid image URL';
    }

    if (parsed.protocol !== 'https:') {
        return 'Image URL must use HTTPS';
    }

    if (!allowedImageHosts.has(parsed.hostname)) {
        return 'Image URL must be hosted on allowed storage';
    }

    return null;
}

export function sanitizeGrediceLinkUrl(linkUrl: string): string | undefined {
    if (linkUrl.startsWith('/')) {
        return linkUrl.startsWith('//') ? undefined : linkUrl;
    }

    let parsed: URL;
    try {
        parsed = new URL(linkUrl);
    } catch {
        return undefined;
    }

    const hostname = parsed.hostname.toLowerCase();
    const isSecureProtocol =
        parsed.protocol === 'https:' ||
        (parsed.protocol === 'http:' && allowedLocalLinkHosts.has(hostname));
    if (!isSecureProtocol) {
        return undefined;
    }

    const isAllowedHost =
        hostname === 'gredice.com' ||
        hostname.endsWith('.gredice.com') ||
        allowedLocalLinkHosts.has(hostname);
    if (!isAllowedHost) {
        return undefined;
    }

    return parsed.toString();
}
