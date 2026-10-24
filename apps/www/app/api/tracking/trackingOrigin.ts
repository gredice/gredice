function isLocalhost(hostname: string) {
    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '[::1]'
    );
}

function isSameOriginOrLocalhost(sourceUrl: URL, requestUrl: URL) {
    return (
        sourceUrl.origin === requestUrl.origin ||
        (isLocalhost(sourceUrl.hostname) &&
            isLocalhost(requestUrl.hostname) &&
            sourceUrl.port === requestUrl.port &&
            sourceUrl.protocol === requestUrl.protocol)
    );
}

export function isAllowedTrackingOrigin(originUrl: URL, requestUrl: URL) {
    return (
        isSameOriginOrLocalhost(originUrl, requestUrl) ||
        // Vercel redirects the apex tracking endpoint to the canonical WWW host.
        (originUrl.origin === 'https://gredice.com' &&
            requestUrl.origin === 'https://www.gredice.com')
    );
}

export function isAllowedTrackingEventSourceUrl(
    eventSourceUrl: URL,
    requestUrl: URL,
    validatedOriginUrl?: URL,
) {
    return (
        isSameOriginOrLocalhost(eventSourceUrl, requestUrl) ||
        (validatedOriginUrl !== undefined &&
            isAllowedTrackingOrigin(validatedOriginUrl, requestUrl) &&
            eventSourceUrl.origin === validatedOriginUrl.origin)
    );
}
