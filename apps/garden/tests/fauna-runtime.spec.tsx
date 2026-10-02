import { expect, test } from '@playwright/experimental-ct-react';
import { FaunaRuntimeFixture } from './FaunaRuntimeFixture';

test('initial, late and remounted mixers precede poses and same-frame grounding shadows', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<FaunaRuntimeFixture />);
    const a = fixture.getByTestId('fauna-a');
    const b = fixture.getByTestId('fauna-b');
    const check = async (root: typeof a) => {
        await expect
            .poll(
                async () =>
                    JSON.parse((await root.getAttribute('data-sample')) ?? '{}')
                        .frames,
            )
            .toBeGreaterThan(20);
        const sample = JSON.parse(
            (await root.getAttribute('data-sample')) ?? '{}',
        );
        expect(sample.mixerFailures).toBe(0);
        expect(sample.poseFailures).toBe(0);
        expect(sample.shadowFailures).toBe(0);
        expect(sample.gaitFailures).toBe(0);
        expect(sample.maxDelta).toBeLessThanOrEqual(1 / 30 + 1e-9);
    };
    await check(b);
    await fixture.getByRole('button', { name: 'Toggle animal' }).click();
    await check(a);
    await fixture.getByRole('button', { name: 'Switch garden' }).click();
    await check(a);
    await fixture.getByRole('button', { name: 'Toggle animal' }).click();
    await fixture.getByRole('button', { name: 'Toggle animal' }).click();
    await check(a);
    await b.evaluate((element) => {
        element.style.left = '-20000px';
    });
    await expect
        .poll(
            async () =>
                JSON.parse((await b.getAttribute('data-sample')) ?? '{}')
                    .visible,
        )
        .toBe(false);
    const suspended = await b.getAttribute('data-sample');
    await page.waitForTimeout(250);
    expect(await b.getAttribute('data-sample')).toBe(suspended);
    const before = JSON.parse(suspended ?? '{}');
    await b.evaluate((element) => {
        element.style.left = '300px';
    });
    await expect
        .poll(
            async () =>
                JSON.parse((await b.getAttribute('data-sample')) ?? '{}')
                    .visible,
        )
        .toBe(true);
    await expect
        .poll(
            async () =>
                JSON.parse((await b.getAttribute('data-sample')) ?? '{}')
                    .frames,
        )
        .toBeGreaterThan(before.frames);
    await check(b);
});
