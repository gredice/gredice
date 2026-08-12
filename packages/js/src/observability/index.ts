const postHogIngestPath = '/ingest';
const publicMcpPath = '/api/mcp';

function matchesPathSegment(pathname: string, path: string) {
    return pathname === path || pathname.startsWith(`${path}/`);
}

export function shouldInjectVercelAnalytics(vercelRuntime: string | undefined) {
    return vercelRuntime === '1';
}

export function shouldForwardPostHogConsoleMethod(method: string) {
    return method === 'warn' || method === 'error';
}

export function shouldLogPostHogProxyRequest({
    pathname,
    proxyResult,
}: {
    pathname: string;
    proxyResult: string;
}) {
    if (matchesPathSegment(pathname, postHogIngestPath)) {
        return false;
    }

    if (matchesPathSegment(pathname, publicMcpPath)) {
        return true;
    }

    return proxyResult === 'redirect' || proxyResult === 'rewrite';
}
