import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/experimental-ct-react';
import { WeatherAudioFixture } from '../../../packages/game/tests/WeatherAudioFixture';

test('wind, rain and leaf rustle coexist through snow and weather refreshes', async ({
    mount,
    page,
}) => {
    const wav = await readFile(
        new URL(
            '../public/assets/sounds/autumn-leaf-rustle-v1.wav',
            import.meta.url,
        ),
    );
    await page.route('https://cdn.gredice.com/sounds/ambient/**', (route) =>
        route.fulfill({ contentType: 'audio/wav', body: wav }),
    );
    await page.evaluate(() => {
        const metrics = { created: 0, ended: 0 };
        Reflect.set(window, '__combinedAudio', metrics);
        const createSource = AudioContext.prototype.createBufferSource;
        AudioContext.prototype.createBufferSource = function () {
            metrics.created++;
            const source = createSource.call(this);
            source.addEventListener('ended', () => metrics.ended++);
            return source;
        };
    });
    const fixture = await mount(
        <WeatherAudioFixture
            withLeaves
            weather={{ rainy: 0.5, windSpeed: 1.5 }}
        />,
    );
    await page.getByRole('button', { name: 'Enable audio' }).click();
    const counts = () =>
        page.evaluate(() => Reflect.get(window, '__combinedAudio'));
    await expect.poll(counts).toEqual({ created: 6, ended: 0 });
    await fixture.update(
        <WeatherAudioFixture
            withLeaves
            weather={{
                rainy: 0.52,
                windSpeed: 1.6,
                snowy: 0.8,
                snowAccumulation: 20,
            }}
        />,
    );
    expect(await counts()).toEqual({ created: 6, ended: 0 });
    await fixture.update(<WeatherAudioFixture withLeaves enabled={false} />);
    await expect.poll(counts).toEqual({ created: 6, ended: 6 });
});

test('wind decodes all shipped textures, crossfades without duplicates and respects mixer controls', async ({
    mount,
    page,
}) => {
    // Isolate real local wind recordings from unrelated CDN availability.
    await page.route('https://cdn.gredice.com/sounds/ambient/**', (route) =>
        route.fulfill({ status: 404 }),
    );
    const requests: string[] = [];
    page.on('request', (request) => {
        if (request.url().includes('/sounds/wind-'))
            requests.push(request.url());
    });
    await page.evaluate(() => {
        const gains: GainNode[] = [];
        const metrics = { created: 0, ended: 0, gains };
        Reflect.set(window, '__windAudio', metrics);
        const createSource = AudioContext.prototype.createBufferSource;
        const createGain = AudioContext.prototype.createGain;
        AudioContext.prototype.createBufferSource = function () {
            metrics.created++;
            const source = createSource.call(this);
            source.addEventListener('ended', () => metrics.ended++);
            return source;
        };
        AudioContext.prototype.createGain = function () {
            const gain = createGain.call(this);
            metrics.gains.push(gain);
            return gain;
        };
    });
    const fixture = await mount(
        <WeatherAudioFixture weather={{ windSpeed: 0 }} />,
    );
    await page.getByRole('button', { name: 'Enable audio' }).click();
    const counts = () =>
        page.evaluate(() => {
            const metrics = Reflect.get(window, '__windAudio');
            return { created: metrics.created, ended: metrics.ended };
        });
    expect(await counts()).toEqual({ created: 0, ended: 0 });
    expect(requests).toHaveLength(0);
    await fixture.update(<WeatherAudioFixture weather={{ windSpeed: 1.5 }} />);
    await expect.poll(counts).toEqual({ created: 2, ended: 0 });
    for (const windSpeed of [1.7, 1.4, 1.8, 1.5]) {
        await fixture.update(<WeatherAudioFixture weather={{ windSpeed }} />);
        expect(await counts()).toEqual({ created: 2, ended: 0 });
    }
    await fixture.update(
        <WeatherAudioFixture
            weather={{
                windSpeed: 2.5,
                rainy: 1,
                snowy: 1,
                snowAccumulation: 30,
            }}
        />,
    );
    await expect.poll(counts).toEqual({ created: 3, ended: 0 });
    await expect.poll(counts).toEqual({ created: 3, ended: 1 });
    expect(requests).toHaveLength(3);
    for (const { button, channel } of [
        { button: 'Toggle master', channel: 0 },
        { button: 'Toggle ambient', channel: 1 },
    ]) {
        await page.getByRole('button', { name: button }).click();
        expect(
            await page.evaluate(
                (index) =>
                    Reflect.get(window, '__windAudio').gains[index].gain.value,
                channel,
            ),
        ).toBe(0);
        await page.getByRole('button', { name: button }).click();
    }
    await page.getByRole('button', { name: 'Quiet volumes' }).click();
    const volumes = await page.evaluate(() =>
        Reflect.get(window, '__windAudio')
            .gains.slice(0, 2)
            .map((gain: GainNode) => gain.gain.value),
    );
    expect(volumes[0]).toBeCloseTo(0.2);
    expect(volumes[1]).toBeCloseTo(0.3);
    expect(await counts()).toEqual({ created: 3, ended: 1 });
    await fixture.update(<WeatherAudioFixture weather={{ windSpeed: 0 }} />);
    await expect.poll(counts).toEqual({ created: 3, ended: 3 });
    await fixture.update(<WeatherAudioFixture weather={{ windSpeed: 3 }} />);
    await expect.poll(counts).toEqual({ created: 4, ended: 3 });
    expect(requests).toHaveLength(3);
    await fixture.update(
        <WeatherAudioFixture weather={{ windSpeed: 3 }} enabled={false} />,
    );
    await expect.poll(counts).toEqual({ created: 4, ended: 4 });
});

test('a failed wind recording stays silent across debug updates', async ({
    mount,
    page,
}) => {
    await page.route('https://cdn.gredice.com/sounds/ambient/**', (route) =>
        route.fulfill({ status: 404 }),
    );
    let requests = 0;
    await page.route('**/sounds/wind-*.wav', (route) => {
        requests++;
        return route.fulfill({ status: 404 });
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await mount(
        <WeatherAudioFixture weather={{ windSpeed: 1 }} />,
    );
    await page.getByRole('button', { name: 'Enable audio' }).click();
    await expect.poll(() => requests).toBe(1);
    for (const windSpeed of [0.5, 0.8, 1, 0, 1]) {
        await fixture.update(<WeatherAudioFixture weather={{ windSpeed }} />);
    }
    expect(requests).toBe(1);
    expect(errors).toEqual([]);
});
