/**
 * Route coverage for the sitemap.
 *
 * `app/sitemap.ts` publishes exactly what the source model returns; nothing
 * scans the build output any more. These tests walk the real route tree so a
 * public page cannot be added without either appearing in the sitemap or being
 * excluded on purpose.
 */

import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { isExcludedSitemapPath } from '../lib/sitemap/sitemapPolicy.ts';
import {
    dynamicRouteSitemapPolicy,
    sitemapHubPaths,
} from '../lib/sitemap/sitemapSourcePaths.ts';

const appDirectory = fileURLToPath(new URL('../app', import.meta.url));
const routeFileNames = new Set([
    'page.tsx',
    'page.ts',
    'route.ts',
    'route.tsx',
]);

function collectRoutes(directory: string, prefix = ''): string[] {
    const routes: string[] = [];

    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            // Route groups do not add a URL segment; `_private` folders are
            // never routable.
            if (entry.name.startsWith('_')) {
                continue;
            }
            const isRouteGroup =
                entry.name.startsWith('(') && entry.name.endsWith(')');
            routes.push(
                ...collectRoutes(
                    path.join(directory, entry.name),
                    isRouteGroup ? prefix : `${prefix}/${entry.name}`,
                ),
            );
            continue;
        }

        if (routeFileNames.has(entry.name)) {
            routes.push(prefix || '/');
        }
    }

    return routes;
}

const routes = collectRoutes(appDirectory);
const hubPaths = new Set<string>(sitemapHubPaths);

test('the route tree has routes to check', () => {
    assert.ok(routes.length > 40, `found ${routes.length.toString()} routes`);
    assert.ok(routes.includes('/'));
    assert.ok(routes.includes('/biljke'));
});

test('every static public page is either a sitemap hub or excluded on purpose', () => {
    const unclassified = routes
        .filter((route) => !route.includes('['))
        .filter((route) => !hubPaths.has(route))
        .filter((route) => !isExcludedSitemapPath(route));

    assert.deepEqual(
        unclassified,
        [],
        `Add these routes to sitemapHubPaths or to excludedSitemapRoutes: ${unclassified.join(', ')}`,
    );
});

test('every dynamic route family declares how it reaches the sitemap', () => {
    const dynamicRoutes = routes.filter((route) => route.includes('['));
    // A route already covered by an exclusion glob needs no separate entry.
    const undeclared = dynamicRoutes
        .filter((route) => !(route in dynamicRouteSitemapPolicy))
        .filter(
            (route) =>
                !isExcludedSitemapPath(
                    route.replace(/\[[^\]]+\]/gu, 'primjer'),
                ),
        );

    assert.deepEqual(
        undeclared,
        [],
        `Add these routes to dynamicRouteSitemapPolicy: ${undeclared.join(', ')}`,
    );

    for (const [route, policy] of Object.entries(dynamicRouteSitemapPolicy)) {
        assert.ok(
            dynamicRoutes.includes(route),
            `${route} is declared but no longer exists`,
        );
        assert.ok(policy.reason.length > 10, route);

        // A family declared excluded must really be excluded by the policy, and
        // a published family must not be.
        const samplePath = route.replace(/\[[^\]]+\]/gu, 'primjer');
        assert.equal(
            isExcludedSitemapPath(samplePath),
            policy.source === 'excluded',
            route,
        );
    }
});

test('no sitemap hub points at a route that does not exist', () => {
    const routeSet = new Set(routes);
    const missing = [...hubPaths].filter(
        (hubPath) =>
            !routeSet.has(hubPath) &&
            // `/novosti` is served by apps/news and the CMS catch-all renders
            // the source CMS pages, so neither has its own route folder here.
            !hubPath.startsWith('/novosti') &&
            !routeSet.has('/[...slug]'),
    );

    assert.deepEqual(missing, []);
});
