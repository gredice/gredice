import { expect, test } from '@playwright/experimental-ct-react';
import { AutumnAudioFixture } from '../../../packages/game/tests/AutumnAudioFixture';

test('real mixer decodes one loop and changes gain without restart through seasonal and wind updates', async ({
    mount,
    page,
}) => {
    await page.evaluate(() => {
        const metrics = { created: 0, ended: 0 };
        Reflect.set(window, '__leafAudioMetrics', metrics);
        const original = AudioContext.prototype.createBufferSource;
        AudioContext.prototype.createBufferSource = function () {
            metrics.created++;
            const source = original.call(this);
            source.addEventListener('ended', () => {
                metrics.ended++;
            });
            return source;
        };
    });
    const fixture = await mount(<AutumnAudioFixture />);
    await page.getByRole('button', { name: 'Enable audio' }).click();
    const target = () =>
        page.evaluate(
            () => window.__grediceGameProfile?.autumnRustleTargetGain ?? 0,
        );
    const created = () =>
        page.evaluate(() => Reflect.get(window, '__leafAudioMetrics').created);
    await expect.poll(target).toBeGreaterThan(0);
    await expect.poll(created).toBe(1);
    for (const wind of [2.4, 0.4, 1.5, 0.35, 3]) {
        await fixture.update(<AutumnAudioFixture wind={wind} />);
        await expect.poll(target).toBeGreaterThan(0);
        expect(await created()).toBe(1);
    }
    await fixture.update(<AutumnAudioFixture stage="lateAutumn" wind={2.4} />);
    await expect.poll(target).toBeGreaterThan(0);
    expect(await created()).toBe(1);
    await fixture.update(<AutumnAudioFixture stage="summer" wind={2.4} />);
    await expect.poll(target).toBe(0);
    await expect
        .poll(() =>
            page.evaluate(
                () => Reflect.get(window, '__leafAudioMetrics').ended,
            ),
        )
        .toBe(1);
    await fixture.update(<AutumnAudioFixture wind={0} />);
    await expect.poll(target).toBe(0);
    await fixture.update(<AutumnAudioFixture wind={2.4} />);
    await expect.poll(created).toBe(2);
    for (const label of ['Toggle master', 'Toggle ambient']) {
        await page.getByRole('button', { name: label }).click();
        await expect.poll(target).toBe(0);
        await page.getByRole('button', { name: label }).click();
        await expect.poll(target).toBeGreaterThan(0);
    }
    await fixture.update(<AutumnAudioFixture enabled={false} />);
    await expect.poll(target).toBe(0);
    await fixture.update(<AutumnAudioFixture hasTree={false} />);
    await expect.poll(target).toBe(0);
});

test('a missing leaf recording stays silent and does not retry on wind changes', async ({
    mount,
    page,
}) => {
    let requests = 0;
    await page.route('**/autumn-leaf-rustle-v1.wav', async (route) => {
        requests++;
        await route.fulfill({ status: 404 });
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await mount(<AutumnAudioFixture />);
    await page.getByRole('button', { name: 'Enable audio' }).click();
    await expect.poll(() => requests).toBe(1);
    await fixture.update(<AutumnAudioFixture wind={2.4} />);
    await fixture.update(<AutumnAudioFixture wind={1} />);
    expect(requests).toBe(1);
    expect(errors).toEqual([]);
});
