import { SeverityNumber } from '@opentelemetry/api-logs';
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
    const response =
        (await baseProxyHandler(request, event)) ?? NextResponse.next();

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
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|assets|api/gredice).*)',
    ],
};
