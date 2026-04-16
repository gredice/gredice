import { SeverityNumber } from '@opentelemetry/api-logs';
import { decodeRouteParam } from '@gredice/js/uri';
import { postHogMiddleware } from '@posthog/next';
import {
    type NextFetchEvent,
    type NextProxy,
    type NextRequest,
    NextResponse,
} from 'next/server';
import {
    flushPostHogLogs,
    getPostHogLogger,
    isPostHogLoggingEnabled,
    POSTHOG_SERVICE_NAME,
} from './lib/posthog-server';
import { toPageAlias } from './src/pageAliases';

const postHogApiKey =
    process.env.NEXT_PUBLIC_POSTHOG_KEY ??
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const postHogProxyHost =
    process.env.POSTHOG_PROXY_HOST ??
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.replace(
        '://app.posthog.com',
        '://us.i.posthog.com',
    )
        .replace('://us.posthog.com', '://us.i.posthog.com')
        .replace('://eu.posthog.com', '://eu.i.posthog.com');

const requestLogger = getPostHogLogger(`${POSTHOG_SERVICE_NAME}.request`);

function normalizeSlugSegment(segment: string): string {
    return toPageAlias(decodeRouteParam(segment));
}

function getCanonicalPathname(pathname: string): string | null {
    const segments = pathname.split('/').filter(Boolean);

    if (segments.length === 2 && segments[0] === 'biljke') {
        return `/biljke/${normalizeSlugSegment(segments[1])}`;
    }

    if (
        segments.length === 4 &&
        segments[0] === 'biljke' &&
        segments[2] === 'sorte'
    ) {
        return [
            '',
            'biljke',
            normalizeSlugSegment(segments[1]),
            'sorte',
            normalizeSlugSegment(segments[3]),
        ].join('/');
    }

    if (segments.length === 2 && segments[0] === 'radnje') {
        return `/radnje/${normalizeSlugSegment(segments[1])}`;
    }

    if (
        segments.length === 2 &&
        segments[0] === 'blokovi' &&
        segments[1] !== 'biljke'
    ) {
        return `/blokovi/${normalizeSlugSegment(segments[1])}`;
    }

    if (
        segments.length === 3 &&
        segments[0] === 'blokovi' &&
        segments[1] === 'biljke' &&
        segments[2] !== 'generator'
    ) {
        return `/blokovi/biljke/${normalizeSlugSegment(segments[2])}`;
    }

    return null;
}

function getProxyAttributes(response: Response) {
    const rewriteTarget = response.headers.get('x-middleware-rewrite');
    const redirectTarget = response.headers.get('location');

    if (redirectTarget) {
        return {
            'http.response.header.location': redirectTarget,
            'next.proxy_result': 'redirect',
        };
    }

    if (rewriteTarget) {
        return {
            'next.proxy_result': 'rewrite',
            'next.rewrite_target': rewriteTarget,
        };
    }

    return {
        'next.proxy_result': 'next',
    };
}

const baseProxyHandler: NextProxy = postHogApiKey
    ? postHogMiddleware({
          apiKey: postHogApiKey,
          proxy: postHogProxyHost ? { host: postHogProxyHost } : true,
      })
    : function proxy(_request: NextRequest) {
          return NextResponse.next();
      };

const proxyHandler: NextProxy = async (
    request: NextRequest,
    event: NextFetchEvent,
) => {
    const canonicalPathname = getCanonicalPathname(request.nextUrl.pathname);
    let response: Response;
    if (canonicalPathname && canonicalPathname !== request.nextUrl.pathname) {
        const url = request.nextUrl.clone();
        // Next derives implicit cache tags from the pathname.
        // Redirect slug-backed routes before rendering so headers stay ASCII-safe.
        url.pathname = canonicalPathname;
        response = NextResponse.redirect(url, 308);
    } else {
        response =
            (await baseProxyHandler(request, event)) ?? NextResponse.next();
    }

    if (isPostHogLoggingEnabled()) {
        requestLogger.emit({
            attributes: {
                'http.method': request.method,
                'posthog.log_type': 'request',
                'server.address': request.nextUrl.hostname,
                'url.path': request.nextUrl.pathname,
                ...getProxyAttributes(response),
                ...(request.headers.get('referer')
                    ? {
                          'http.request.header.referer':
                              request.headers.get('referer'),
                      }
                    : {}),
                ...(request.headers.get('user-agent')
                    ? {
                          'user_agent.original':
                              request.headers.get('user-agent'),
                      }
                    : {}),
            },
            body: `${request.method} ${request.nextUrl.pathname}`,
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
        });

        event.waitUntil(flushPostHogLogs());
    }

    return response;
};

export default proxyHandler;

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
