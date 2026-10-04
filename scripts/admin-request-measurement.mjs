import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const adminMeasurementPaths = [
    '/admin',
    '/admin/approvals',
    '/admin/schedule',
    '/admin/delivery/requests',
];

const productionOrigin = 'https://app.gredice.com';
const readMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const sessionCookieNames = new Set([
    'gredice_session',
    'gredice_refresh',
    'gredice_account',
]);

export function parseAdminMeasurementOptions(args) {
    const options = {
        origin: productionOrigin,
        storageState: undefined,
        idleMs: 15000,
        settleMs: 3000,
        timeoutMs: 90000,
    };
    const seen = new Set();
    for (let index = 0; index < args.length; index += 2) {
        const flag = args[index];
        const value = args[index + 1];
        if (!value || seen.has(flag)) throw new Error('Invalid options');
        seen.add(flag);
        switch (flag) {
            case '--origin':
                options.origin = validateAdminMeasurementOrigin(value);
                break;
            case '--storage-state':
                if (/^[a-z][a-z\d+.-]*:/i.test(value)) {
                    throw new Error('Storage state must be a local file');
                }
                options.storageState = path.resolve(value);
                break;
            case '--idle-ms':
                options.idleMs = boundedInteger(value, 1000, 60000);
                break;
            case '--settle-ms':
                options.settleMs = boundedInteger(value, 1000, 10000);
                break;
            case '--timeout-ms':
                options.timeoutMs = boundedInteger(value, 30000, 120000);
                break;
            default:
                throw new Error('Unknown option');
        }
    }
    if (!options.storageState) {
        throw new Error('A local authenticated storage state is required');
    }
    if (
        options.idleMs + options.settleMs * adminMeasurementPaths.length >=
        options.timeoutMs
    ) {
        throw new Error('The measurement window exceeds the runtime bound');
    }
    return options;
}

function boundedInteger(value, minimum, maximum) {
    if (!/^\d+$/.test(value)) throw new Error('Invalid duration');
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
        throw new Error('Duration outside allowed bounds');
    }
    return number;
}

export function validateAdminMeasurementOrigin(value) {
    let url;
    try {
        url = new URL(value);
    } catch {
        throw new Error('Invalid origin');
    }
    if (
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
    ) {
        throw new Error('Only an origin is allowed');
    }
    if (url.origin === productionOrigin) return url.origin;
    if (
        url.protocol === 'http:' &&
        (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
    ) {
        return url.origin;
    }
    throw new Error(
        'Only production Admin or a loopback test server is allowed',
    );
}

/** Keep only Admin session cookies; never load unrelated local storage. */
export function adminMeasurementStorageState(state, origin) {
    const hostname = new URL(validateAdminMeasurementOrigin(origin)).hostname;
    const allowedDomains = new Set([hostname]);
    if (origin === productionOrigin) allowedDomains.add('gredice.com');
    if (!state || !Array.isArray(state.cookies)) {
        throw new Error('Invalid local storage state');
    }
    const cookies = state.cookies.filter((cookie) => {
        if (
            !cookie ||
            !sessionCookieNames.has(cookie.name) ||
            typeof cookie.value !== 'string' ||
            typeof cookie.domain !== 'string'
        ) {
            return false;
        }
        const domain = cookie.domain.replace(/^\./, '');
        return allowedDomains.has(domain);
    });
    if (!cookies.some((cookie) => cookie.name === 'gredice_session')) {
        throw new Error('The local state has no Admin access cookie');
    }
    return { cookies, origins: [] };
}

/** Return only fixed buckets and boolean header classifications. */
export function sanitizeAdminNetworkRequest({ url, method, headers }, origin) {
    let requestUrl;
    try {
        requestUrl = new URL(url);
    } catch {
        return null;
    }
    if (requestUrl.origin !== origin) return null;
    const requestPath = requestUrl.pathname;
    const route = adminMeasurementPaths.includes(requestPath)
        ? requestPath
        : requestPath.startsWith('/admin/')
          ? '/admin/other'
          : requestPath.startsWith('/api/')
            ? '/api/other'
            : '/other';
    const normalizedHeaders = new Headers(headers);
    return {
        route,
        method: readMethods.has(method) ? method : 'other',
        rsc: normalizedHeaders.get('rsc') === '1',
        routerPrefetch: normalizedHeaders.get('next-router-prefetch') === '1',
        segmentPrefetch:
            normalizedHeaders.get('next-router-segment-prefetch') !== null,
        browserPrefetch:
            normalizedHeaders.get('purpose') === 'prefetch' ||
            normalizedHeaders.get('sec-purpose')?.includes('prefetch') === true,
    };
}

export function sanitizeAdminResponseHeaders(headers) {
    const normalized = new Headers(headers);
    const vercelCache = normalized.get('x-vercel-cache')?.toUpperCase();
    const server = normalized.get('server');
    const cacheControl = normalized.get('cache-control');
    const directives = cacheControl
        ?.split(',')
        .map((directive) => directive.trim().toLowerCase().split('=')[0]);
    return {
        vercelCache: !vercelCache
            ? 'missing'
            : [
                    'HIT',
                    'MISS',
                    'STALE',
                    'BYPASS',
                    'PRERENDER',
                    'REVALIDATED',
                ].includes(vercelCache)
              ? vercelCache
              : 'other',
        server: !server
            ? 'missing'
            : /vercel/i.test(server)
              ? 'vercel'
              : 'other',
        cacheControl: !cacheControl
            ? 'missing'
            : directives.includes('no-store')
              ? 'no-store'
              : directives.includes('private')
                ? 'private'
                : directives.includes('public')
                  ? 'public'
                  : 'other',
    };
}

export function summarizeAdminNetworkRequests(requests) {
    const groups = new Map();
    for (const request of requests) {
        const category =
            request.routerPrefetch ||
            request.segmentPrefetch ||
            request.browserPrefetch
                ? 'indicated-prefetch'
                : request.rsc
                  ? 'ordinary-rsc'
                  : 'other';
        const key = JSON.stringify([
            request.phase,
            request.route,
            request.method,
            category,
            request.vercelCache ?? 'missing',
            request.server ?? 'missing',
            request.cacheControl ?? 'missing',
        ]);
        const group = groups.get(key) ?? {
            phase: request.phase,
            route: request.route,
            method: request.method,
            category,
            vercelCache: request.vercelCache ?? 'missing',
            server: request.server ?? 'missing',
            cacheControl: request.cacheControl ?? 'missing',
            requests: 0,
            failed: 0,
            cancelled: 0,
            blocked: 0,
            httpErrors: 0,
        };
        group.requests += 1;
        group.failed += Number(request.failed === true);
        group.cancelled += Number(request.cancelled === true);
        group.blocked += Number(request.blocked === true);
        group.httpErrors += Number(request.status >= 400);
        groups.set(key, group);
    }
    return [...groups.values()];
}

/** Browser-only request counts are not function, SQL, or billed CPU counts. */
export async function measureAdminRequests(chromium, options, storageState) {
    const started = performance.now();
    const requests = new Map();
    const navigations = [];
    let phase = 'navigation';
    let browser;
    let closing;
    let cancelled = false;
    let pageErrors = 0;
    let outcome = 'complete';
    let deadline;
    const runtime = new Promise((_, reject) => {
        deadline = setTimeout(() => {
            cancelled = true;
            reject(new Error('Runtime bound reached'));
        }, options.timeoutMs);
    });
    const checkCancelled = () => {
        if (cancelled) throw new Error('Measurement cancelled');
    };
    const closeBrowser = () => {
        if (!browser) return Promise.resolve();
        closing ??= browser.close();
        return closing;
    };

    const collect = (request) => {
        const record = sanitizeAdminNetworkRequest(
            {
                url: request.url(),
                method: request.method(),
                headers: request.headers(),
            },
            options.origin,
        );
        if (record) requests.set(request, { ...record, phase });
    };

    const worker = (async () => {
        browser = await chromium.launch({ timeout: 15000 });
        checkCancelled();
        const context = await browser.newContext({
            storageState,
            serviceWorkers: 'block',
        });
        checkCancelled();
        // No actions, refresh-token writes, analytics uploads, or mutations.
        await context.route('**/*', async (route) => {
            const request = route.request();
            if (readMethods.has(request.method())) {
                await route.continue();
                return;
            }
            const record = requests.get(request);
            if (record) record.blocked = true;
            await route.abort();
        });
        context.on('request', collect);
        context.on('response', (response) => {
            const record = requests.get(response.request());
            if (record) {
                record.status = response.status();
                Object.assign(
                    record,
                    sanitizeAdminResponseHeaders(response.headers()),
                );
            }
        });
        context.on('requestfailed', (request) => {
            const record = requests.get(request);
            if (record) {
                record.cancelled =
                    request.failure()?.errorText === 'net::ERR_ABORTED';
                record.failed = !record.cancelled;
            }
        });
        const page = await context.newPage();
        checkCancelled();
        page.on('pageerror', () => {
            pageErrors += 1;
        });
        for (const route of adminMeasurementPaths) {
            checkCancelled();
            phase = 'navigation';
            const navigationStart = performance.now();
            const navigation = { route, accepted: false };
            navigations.push(navigation);
            const response = await page.goto(`${options.origin}${route}`, {
                timeout: 15000,
                waitUntil: 'domcontentloaded',
            });
            navigation.status = response?.status() ?? null;
            await page
                .locator('[data-gredice-admin-shell]')
                .waitFor({ state: 'visible', timeout: 10000 });
            navigation.accepted =
                navigation.status !== null &&
                navigation.status < 400 &&
                new URL(page.url()).pathname === route;
            navigation.elapsedMs = Math.round(
                performance.now() - navigationStart,
            );
            if (!navigation.accepted) {
                throw new Error('Admin navigation failed');
            }
            phase = 'settle';
            await page.waitForTimeout(options.settleMs);
        }
        phase = 'idle';
        await page.waitForTimeout(options.idleMs);
    })();
    try {
        await Promise.race([runtime, worker]);
    } catch {
        // Never print browser errors: they can contain URLs or private page text.
        outcome = navigations.some((navigation) => !navigation.accepted)
            ? 'navigation-not-accepted'
            : 'incomplete';
    } finally {
        cancelled = true;
        clearTimeout(deadline);
        await closeBrowser().catch(() => {});
        // Join the cancelled worker before reporting, including delayed startup.
        await worker.catch(() => {});
        await closeBrowser().catch(() => {});
    }
    return {
        schemaVersion: 1,
        startedAt: new Date(
            Date.now() - (performance.now() - started),
        ).toISOString(),
        elapsedMs: Math.round(performance.now() - started),
        outcome,
        idleMs: options.idleMs,
        settleMs: options.settleMs,
        timeoutMs: options.timeoutMs,
        actualDocumentNavigations: navigations.length,
        navigations,
        pageErrors,
        groups: summarizeAdminNetworkRequests([...requests.values()]),
        limitations: [
            'Browser requests can overlap function/middleware records.',
            'Fixed routes used document navigation; client navigation was not accepted.',
            'Unflagged requests do not prove user activity.',
            'Non-read HTTP methods were blocked; mutation freshness was not tested.',
            'Active automation sessions were not exercised.',
            'SQL, Redis payloads, billed CPU, and production net savings are not measured.',
        ],
    };
}

async function main() {
    try {
        const options = parseAdminMeasurementOptions(process.argv.slice(2));
        const state = adminMeasurementStorageState(
            JSON.parse(await readFile(options.storageState, 'utf8')),
            options.origin,
        );
        const require = createRequire(
            new URL('../apps/app/package.json', import.meta.url),
        );
        const { chromium } = require('@playwright/test');
        const result = await measureAdminRequests(chromium, options, state);
        console.info(JSON.stringify(result, null, 2));
        if (result.outcome !== 'complete') process.exitCode = 1;
    } catch {
        console.error(
            'Admin measurement could not start. Check local storage state, allowed origin, duration bounds, and Playwright installation. No credentials or raw error details are printed.',
        );
        process.exitCode = 1;
    }
}

if (
    process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    await main();
}
