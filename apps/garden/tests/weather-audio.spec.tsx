import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/experimental-ct-react';
import { WeatherAudioFixture } from '../../../packages/game/tests/WeatherAudioFixture';

test('weather refreshes and rapid retargets preserve decoded loops and fade gains', async ({
    mount,
    page,
}) => {
    // Deterministic local audio keeps this mixer/React integration test offline.
    const wav = await readFile(
        new URL(
            '../public/assets/sounds/autumn-leaf-rustle-v1.wav',
            import.meta.url,
        ),
    );
    const requests: string[] = [];
    await page.route(
        'https://cdn.gredice.com/sounds/ambient/**',
        async (route) => {
            requests.push(route.request().url());
            await route.fulfill({ contentType: 'audio/wav', body: wav });
        },
    );
    await page.evaluate(() => {
        const sources: AudioBufferSourceNode[] = [];
        const gains: GainNode[] = [];
        const metrics = { sources, gains, ended: 0 };
        Reflect.set(window, '__weatherAudio', metrics);
        const createSource = AudioContext.prototype.createBufferSource;
        const createGain = AudioContext.prototype.createGain;
        AudioContext.prototype.createBufferSource = function () {
            const source = createSource.call(this);
            sources.push(source);
            source.addEventListener('ended', () => metrics.ended++);
            return source;
        };
        AudioContext.prototype.createGain = function () {
            const gain = createGain.call(this);
            gains.push(gain);
            return gain;
        };
    });
    const fixture = await mount(<WeatherAudioFixture />);
    await page.getByRole('button', { name: 'Enable audio' }).click();
    const counts = () =>
        page.evaluate(() => {
            const metrics = Reflect.get(window, '__weatherAudio');
            return { created: metrics.sources.length, ended: metrics.ended };
        });
    await expect.poll(counts).toEqual({ created: 3, ended: 0 });
    for (const rainy of [0.5, 0.55, 0.48, 0.52, 0.5]) {
        await fixture.update(<WeatherAudioFixture weather={{ rainy }} />);
        expect(await counts()).toEqual({ created: 3, ended: 0 });
    }
    expect(requests.length).toBe(3);
    // Clear weather adds birds but fades the old rain sources before disposal.
    await fixture.update(<WeatherAudioFixture weather={{ rainy: 0 }} />);
    await expect.poll(counts).toEqual({ created: 4, ended: 0 });
    await expect.poll(counts).toEqual({ created: 4, ended: 3 });
    await expect
        .poll(() =>
            page.evaluate(() => {
                const metrics = Reflect.get(window, '__weatherAudio');
                return metrics.gains.at(-1).gain.value;
            }),
        )
        .toBeGreaterThan(0.6);
    await fixture.update(<WeatherAudioFixture enabled={false} />);
    await expect.poll(counts).toEqual({ created: 4, ended: 4 });
    await fixture.update(<WeatherAudioFixture />);
    await expect.poll(counts).toEqual({ created: 7, ended: 4 });
    expect(requests.length).toBe(4);
});

test('failed ambience is silent and is not fetched again on refresh', async ({
    mount,
    page,
}) => {
    let requests = 0;
    await page.route(
        'https://cdn.gredice.com/sounds/ambient/**',
        async (route) => {
            requests++;
            await route.fulfill({ status: 404 });
        },
    );
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'warning') errors.push(message.text());
    });
    const fixture = await mount(<WeatherAudioFixture />);
    await page.getByRole('button', { name: 'Enable audio' }).click();
    await expect.poll(() => requests).toBe(3);
    for (const rainy of [0.52, 0.48, 0.5]) {
        await fixture.update(<WeatherAudioFixture weather={{ rainy }} />);
    }
    expect(requests).toBe(3);
    expect(errors).toEqual([]);
});
