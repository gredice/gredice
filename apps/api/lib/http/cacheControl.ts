import type { Context } from 'hono';

export type CacheControlOptions = {
    maxAgeSeconds: number;
    sharedMaxAgeSeconds?: number;
    staleWhileRevalidateSeconds?: number;
    staleIfErrorSeconds?: number;
    visibility?: 'public' | 'private';
    immutable?: boolean;
    mustRevalidate?: boolean;
    noTransform?: boolean;
};

export const cacheControlPresets = {
    directories: {
        visibility: 'public',
        maxAgeSeconds: 60 * 60,
        sharedMaxAgeSeconds: 60 * 60,
        staleWhileRevalidateSeconds: 24 * 60 * 60,
        staleIfErrorSeconds: 24 * 60 * 60,
    } satisfies CacheControlOptions,
    weatherShortTerm: {
        visibility: 'public',
        maxAgeSeconds: 5 * 60,
        sharedMaxAgeSeconds: 5 * 60,
        staleWhileRevalidateSeconds: 60,
    } satisfies CacheControlOptions,
};

export function buildCacheControlValue(options: CacheControlOptions): string {
    const directives: string[] = [
        options.visibility ?? 'public',
        `max-age=${options.maxAgeSeconds}`,
    ];

    if (typeof options.sharedMaxAgeSeconds === 'number') {
        directives.push(`s-maxage=${options.sharedMaxAgeSeconds}`);
    }

    if (typeof options.staleWhileRevalidateSeconds === 'number') {
        directives.push(
            `stale-while-revalidate=${options.staleWhileRevalidateSeconds}`,
        );
    }

    if (typeof options.staleIfErrorSeconds === 'number') {
        directives.push(`stale-if-error=${options.staleIfErrorSeconds}`);
    }

    if (options.mustRevalidate) {
        directives.push('must-revalidate');
    }

    if (options.noTransform) {
        directives.push('no-transform');
    }

    if (options.immutable) {
        directives.push('immutable');
    }

    return directives.join(', ');
}

export function setCacheControl(
    context: Context,
    options: CacheControlOptions,
): void {
    context.header('Cache-Control', buildCacheControlValue(options));
}
