import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator } from '@playwright/test';
import { SceneQueryDataFixture } from '../../../packages/game/tests/SceneQueryDataFixture';

test.setTimeout(45_000);

async function sample(root: Locator) {
    const value: {
        meshes: { name: string; uuid: string; position: number[] }[];
        leaves: {
            name: string;
            uuid: string;
            dataState: string;
            instanceHeights: number[];
        }[];
        renderedCalls: number;
        fallback: boolean;
    } = JSON.parse(
        (await root
            .getByTestId('scene-query-sample')
            .getAttribute('data-sample')) ??
            '{"meshes":[],"leaves":[],"renderedCalls":0,"fallback":false}',
    );
    return value;
}

async function cache(root: Locator) {
    const value: {
        key: string[];
        observers: number;
        status: string;
        fetchStatus: string;
        error: string | null;
    }[] = JSON.parse(await root.getByTestId('scene-query-cache').innerText());
    return value;
}

async function query(root: Locator, key = ['blocks', 'local']) {
    return (await cache(root)).find(
        (entry) => JSON.stringify(entry.key) === JSON.stringify(key),
    );
}

async function expectHeight(root: Locator, height: number, leafCount = 16) {
    await expect
        .poll(async () => (await sample(root)).meshes.length)
        .toBe(leafCount);
    await expect
        .poll(async () => (await sample(root)).leaves.length)
        .toBe(leafCount);
    await expect
        .poll(async () =>
            (await sample(root)).leaves.every(
                (leaf) => leaf.instanceHeights.length === 1,
            ),
        )
        .toBe(true);
    await expect
        .poll(async () =>
            (await sample(root)).meshes.every(
                (mesh) => mesh.position[1] === height,
            ),
        )
        .toBe(true);
    await expect
        .poll(async () =>
            (await sample(root)).leaves.every((leaf) =>
                leaf.instanceHeights.every((value) => value === height),
            ),
        )
        .toBe(true);
    await expect
        .poll(async () => (await sample(root)).renderedCalls)
        .toBeGreaterThan(0);
}

async function attach(root: Locator, label: string) {
    await test.info().attach(label, {
        body: JSON.stringify(
            { sample: await sample(root), cache: await cache(root) },
            null,
            2,
        ),
        contentType: 'application/json',
    });
}

test('connected scene shares one block observer across real instance-hook consumers and nested boundaries', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<SceneQueryDataFixture />);
    const root = fixture.getByTestId('scene-query-root-first');
    await expectHeight(root, 2);
    // Preserve the actual count before the assertion, including the original
    // EntityInstancesBlock causal-negative run using this unchanged fixture.
    await attach(root, 'connected-before-one-observer-assertion');
    await expect.poll(async () => (await query(root))?.observers).toBe(1);
    await page
        .locator('canvas')
        .screenshot({ path: test.info().outputPath('connected.png') });
    await root.getByRole('button', { name: 'Unmount scene' }).click();
    await expect.poll(async () => (await query(root))?.observers).toBe(0);
    await expect(page.locator('canvas')).toHaveCount(0);
    await attach(root, 'connected-after-unmount');
    await fixture.unmount();
});

test('unchanged public useBlockData still creates one real observer for each reference leaf', async ({
    mount,
}) => {
    const fixture = await mount(<SceneQueryDataFixture mode="raw-fanout" />);
    const root = fixture.getByTestId('scene-query-root-first');
    await expectHeight(root, 2);
    await expect.poll(async () => (await query(root))?.observers).toBe(16);
    await attach(root, 'public-hook-reference-fanout');
    await root.getByRole('button', { name: 'Unmount scene' }).click();
    await expect.poll(async () => (await query(root))?.observers).toBe(0);
    await fixture.unmount();
});

test('an existing query owner supplies exact block data through the normal Canvas context bridge', async ({
    mount,
}) => {
    const fixture = await mount(<SceneQueryDataFixture mode="owner" />);
    const root = fixture.getByTestId('scene-query-root-first');
    await expectHeight(root, 2);
    await expect.poll(async () => (await query(root))?.observers).toBe(1);
    const before = await sample(root);
    await root.getByRole('button', { name: 'Cache height 7' }).click();
    await expectHeight(root, 7);
    expect((await sample(root)).meshes.map((mesh) => mesh.uuid)).toEqual(
        before.meshes.map((mesh) => mesh.uuid),
    );
    await expect.poll(async () => (await query(root))?.observers).toBe(1);
    await attach(root, 'owner-data-update-through-canvas');
    await fixture.unmount();
});

test('supplied data updates Canvas instances independently from the query cache', async ({
    mount,
}) => {
    const fixture = await mount(<SceneQueryDataFixture mode="supplied" />);
    const root = fixture.getByTestId('scene-query-root-first');
    await expectHeight(root, 2);
    await root.getByRole('button', { name: 'Cache height 7' }).click();
    await expectHeight(root, 2);
    expect((await query(root))?.observers).toBe(0);
    await root.getByRole('button', { name: 'Supplied height 7' }).click();
    await expectHeight(root, 7);
    expect((await query(root))?.observers).toBe(0);
    await attach(root, 'supplied-data-independent-from-cache');
    await fixture.unmount();
});

const absentDataModes: ('supplied-undefined' | 'supplied-null')[] = [
    'supplied-undefined',
    'supplied-null',
];
for (const mode of absentDataModes) {
    test(`present ${mode} data suppresses fallback despite a populated cache`, async ({
        mount,
    }) => {
        const fixture = await mount(<SceneQueryDataFixture mode={mode} />);
        const root = fixture.getByTestId('scene-query-root-first');
        await expectHeight(root, 0);
        await expect.poll(async () => (await query(root))?.observers).toBe(0);
        expect((await query(root))?.status).toBe('success');
        expect(
            (await sample(root)).leaves.every(
                (leaf) => leaf.dataState === mode.slice(9),
            ),
        ).toBe(true);
        await root.getByRole('button', { name: 'Cache height 7' }).click();
        await expectHeight(root, 0);
        await attach(root, mode);
        await fixture.unmount();
    });
}

test('a successful null query remains present below its owner without another observer', async ({
    mount,
}) => {
    const fixture = await mount(
        <SceneQueryDataFixture mode="owner" cacheData="null" />,
    );
    const root = fixture.getByTestId('scene-query-root-first');
    await expectHeight(root, 0);
    await expect.poll(async () => (await query(root))?.observers).toBe(1);
    expect((await query(root))?.status).toBe('success');
    expect(
        (await sample(root)).leaves.every((leaf) => leaf.dataState === 'null'),
    ).toBe(true);
    await root.getByRole('button', { name: 'Cache height 7' }).click();
    await expectHeight(root, 7);
    await expect.poll(async () => (await query(root))?.observers).toBe(1);
    await attach(root, 'successful-null-to-data');
    await fixture.unmount();
});

test('cache updates and actual local query invalidation update instance heights without new observers', async ({
    mount,
}) => {
    const fixture = await mount(<SceneQueryDataFixture />);
    const root = fixture.getByTestId('scene-query-root-first');
    await expectHeight(root, 2);
    await root.getByRole('button', { name: 'Cache height 7' }).click();
    await expectHeight(root, 7);
    await attach(root, 'cache-height-seven');
    await root.getByRole('button', { name: 'Invalidate block query' }).click();
    // The real local query function restores the catalogue's ground height.
    await expectHeight(root, 0.4);
    await expect.poll(async () => (await query(root))?.observers).toBe(1);
    expect(await query(root)).toMatchObject({
        status: 'success',
        fetchStatus: 'idle',
    });
    await attach(root, 'actual-local-query-refetch');
    await fixture.unmount();
});

test('local and remote key transitions retain cache identity and remove old query observers', async ({
    mount,
}) => {
    const fixture = await mount(<SceneQueryDataFixture />);
    const root = fixture.getByTestId('scene-query-root-first');
    await expectHeight(root, 2);
    await root
        .getByRole('button', { name: 'Switch local or remote key' })
        .click();
    await expectHeight(root, 5);
    await expect
        .poll(async () => (await query(root, ['blocks']))?.observers)
        .toBe(1);
    expect((await query(root))?.observers).toBe(0);
    await attach(root, 'remote-key-active');
    await root
        .getByRole('button', { name: 'Switch local or remote key' })
        .click();
    await expectHeight(root, 2);
    await expect.poll(async () => (await query(root))?.observers).toBe(1);
    expect((await query(root, ['blocks']))?.observers).toBe(0);
    await attach(root, 'local-key-restored');
    await fixture.unmount();
});

test('actual remote loading, cached refetch error and successful null preserve block-query semantics', async ({
    mount,
    page,
}) => {
    const pattern = '**/api/directories/entities/block**';
    let finish: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
        finish = resolve;
    });
    let body = 'null';
    await page.route(pattern, async (route) => {
        await pending;
        await route.fulfill({
            body,
            contentType: 'application/json',
            headers: { 'access-control-allow-origin': '*' },
        });
    });
    const fixture = await mount(
        <SceneQueryDataFixture remote cacheData="empty" />,
    );
    const root = fixture.getByTestId('scene-query-root-first');
    await expect
        .poll(async () => (await query(root, ['blocks']))?.fetchStatus)
        .toBe('fetching');
    await expectHeight(root, 0);
    expect((await query(root, ['blocks']))?.status).toBe('pending');
    await attach(root, 'remote-loading');
    body =
        (await root.getByTestId('scene-query-remote-response').textContent()) ??
        'null';
    finish?.();
    await expectHeight(root, 3);
    await expect
        .poll(async () => (await query(root, ['blocks']))?.status)
        .toBe('success');
    await page.unroute(pattern);
    await page.route(pattern, (route) => route.abort('failed'));
    await root.getByRole('button', { name: 'Invalidate block query' }).click();
    await expect
        .poll(async () => (await query(root, ['blocks']))?.status)
        .toBe('error');
    await expectHeight(root, 3);
    expect(await query(root, ['blocks'])).toMatchObject({
        observers: 1,
        fetchStatus: 'idle',
        error: expect.any(String),
    });
    await attach(root, 'cached-data-after-real-fetch-error');
    await page.unroute(pattern);
    await page.route(pattern, (route) =>
        route.fulfill({
            body: 'null',
            contentType: 'application/json',
            headers: { 'access-control-allow-origin': '*' },
        }),
    );
    await root.getByRole('button', { name: 'Invalidate block query' }).click();
    await expect
        .poll(async () => (await query(root, ['blocks']))?.status)
        .toBe('success');
    await expectHeight(root, 0);
    expect(
        (await sample(root)).leaves.every((leaf) => leaf.dataState === 'null'),
    ).toBe(true);
    expect((await query(root, ['blocks']))?.observers).toBe(1);
    await attach(root, 'remote-null-success');
    await fixture.unmount();
});

test('two actual Canvas roots retain independent supplied query owners through update and sibling unmount', async ({
    mount,
    page,
}) => {
    const fixture = await mount(
        <SceneQueryDataFixture mode="owner" roots={2} />,
    );
    const first = fixture.getByTestId('scene-query-root-first');
    const second = fixture.getByTestId('scene-query-root-second');
    await expectHeight(first, 2);
    await expectHeight(second, 5);
    await expect(page.locator('canvas')).toHaveCount(2);
    const stableSecond = await sample(second);
    await first.getByRole('button', { name: 'Cache height 7' }).click();
    await expectHeight(first, 7);
    await expectHeight(second, 5);
    expect((await query(first))?.observers).toBe(1);
    expect((await query(second))?.observers).toBe(1);
    await first.getByRole('button', { name: 'Unmount scene' }).click();
    await expect.poll(async () => (await query(first))?.observers).toBe(0);
    await expectHeight(second, 5);
    expect((await query(second))?.observers).toBe(1);
    expect((await sample(second)).meshes.map((mesh) => mesh.uuid)).toEqual(
        stableSecond.meshes.map((mesh) => mesh.uuid),
    );
    await expect(page.locator('canvas')).toHaveCount(1);
    await attach(first, 'first-root-unmounted');
    await attach(second, 'second-root-retained');
    await second.getByRole('button', { name: 'Unmount scene' }).click();
    await expect.poll(async () => (await query(second))?.observers).toBe(0);
    await expect(page.locator('canvas')).toHaveCount(0);
    await fixture.unmount();
});

test('StrictMode and an initially aborted Suspense render do not retain query observers', async ({
    mount,
    page,
}) => {
    const fixture = await mount(
        <SceneQueryDataFixture strict initiallySuspended />,
    );
    const root = fixture.getByTestId('scene-query-root-first');
    await expect.poll(async () => (await sample(root)).fallback).toBe(true);
    await expect.poll(async () => (await query(root))?.observers).toBe(0);
    expect((await sample(root)).meshes).toHaveLength(0);
    await attach(root, 'aborted-before-commit');
    await root.getByRole('button', { name: 'Reveal children' }).click();
    await expectHeight(root, 2);
    await expect.poll(async () => (await query(root))?.observers).toBe(1);
    await root.getByRole('button', { name: 'Suspend children' }).click();
    await expect.poll(async () => (await sample(root)).fallback).toBe(true);
    expect((await query(root))?.observers).toBeLessThanOrEqual(1);
    await root.getByRole('button', { name: 'Reveal children' }).click();
    await expectHeight(root, 2);
    await expect.poll(async () => (await query(root))?.observers).toBe(1);
    await attach(root, 'strict-revealed-one-observer');
    await root.getByRole('button', { name: 'Unmount scene' }).click();
    await expect.poll(async () => (await query(root))?.observers).toBe(0);
    await expect(page.locator('canvas')).toHaveCount(0);
    await root.getByRole('button', { name: 'Mount scene' }).click();
    await expectHeight(root, 2);
    await expect.poll(async () => (await query(root))?.observers).toBe(1);
    await root.getByRole('button', { name: 'Unmount scene' }).click();
    await expect.poll(async () => (await query(root))?.observers).toBe(0);
    await attach(root, 'strict-remount-cleanup');
    await fixture.unmount();
});

test('a generic geometry-free Scene creates no block-data query observer', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<SceneQueryDataFixture mode="empty" />);
    const root = fixture.getByTestId('scene-query-root-first');
    await expect(root.getByTestId('scene-query-sample')).toHaveAttribute(
        'data-sample',
        /"leaves"/,
    );
    await expect.poll(async () => (await sample(root)).leaves).toEqual([]);
    await expect(page.locator('canvas')).toHaveCount(1);
    expect((await query(root))?.observers).toBe(0);
    expect((await query(root, ['blocks']))?.observers).toBe(0);
    await attach(root, 'generic-scene-no-new-query');
    await fixture.unmount();
});
