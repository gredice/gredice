import {
    type BrowserContext,
    expect,
    type TestFixture,
} from '@playwright/test';
import {
    blobImageFixture,
    createBlobFixtureFetch,
    isBlobUrl,
} from '../../../scripts/blob-test-fixtures.mjs';

export async function installBlobImageFixtures(context: BrowserContext) {
    const blocked = new Set<string>();
    const isolated = process.env.GREDICE_CI_NETWORK_ISOLATION === '1';
    const localFetch = createBlobFixtureFetch(() => {
        throw new Error('An explicit local asset fixture is required.');
    });
    await context.route(
        (url) =>
            isBlobUrl(url.href) ||
            (isolated &&
                (url.hostname === 'cdn.gredice.com' ||
                    (['www.gredice.com', 'vrt.gredice.com'].includes(
                        url.hostname,
                    ) &&
                        url.pathname.startsWith('/assets/')))),
        async (route) => {
            try {
                if (!isBlobUrl(route.request().url())) {
                    const response = await localFetch(route.request().url(), {
                        method: route.request().method(),
                    });
                    await route.fulfill({
                        status: response.status,
                        headers: Object.fromEntries(response.headers.entries()),
                        body: Buffer.from(await response.arrayBuffer()),
                    });
                    return;
                }
                const fixture = blobImageFixture(
                    route.request().url(),
                    route.request().method(),
                );
                await route.fulfill({
                    ...fixture,
                    body: fixture.body ?? undefined,
                });
            } catch {
                blocked.add(
                    `${route.request().method()} ${new URL(route.request().url()).hostname}`,
                );
                await route.abort('blockedbyclient');
            }
        },
    );
    return async () => {
        await context.unrouteAll({ behavior: 'wait' });
        expect(
            [...blocked],
            'Use a local fixture for non-image Blob requests.',
        ).toEqual([]);
    };
}

export const blobNetworkGuard: [
    TestFixture<undefined, { context: BrowserContext }>,
    { auto: true },
] = [
    async ({ context }, use) => {
        const verify = await installBlobImageFixtures(context);
        await use(undefined);
        await verify();
    },
    { auto: true },
];
