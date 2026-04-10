import { postHogMiddleware } from '@posthog/next';
import { NextResponse, type NextRequest } from 'next/server';

const postHogApiKey =
    process.env.NEXT_PUBLIC_POSTHOG_KEY ??
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

const proxyHandler = postHogApiKey
    ? postHogMiddleware({
          apiKey: postHogApiKey,
          proxy: true,
      })
    : function proxy(_request: NextRequest) {
          return NextResponse.next();
      };

export default proxyHandler;

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};