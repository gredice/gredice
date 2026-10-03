import { writeFile } from 'node:fs/promises';
import { kestenijadaItems } from '@gredice/js/kestenijada';
import { expect as baseExpect, test } from '@playwright/experimental-ct-react';
import { getLocalSandboxBlockData } from '../../../packages/game/src/localSandboxBlockData';
import { KestenijadaFixture } from '../../../packages/game/tests/KestenijadaFixture';

const expect = baseExpect.configure({ timeout: 60000 });
const offers = getLocalSandboxBlockData()
    .filter((row) =>
        kestenijadaItems.some((item) => item.name === row.information.name),
    )
    .map((row, i) => ({ ...row, id: 900 + i, prices: { sunflowers: 10 } }));
test.beforeEach(async ({ page }) => {
    page.on('pageerror', (error) => console.error(error.message));
    await page.route('**/api/directories/entities/block**', (route) =>
        route.fulfill({ json: offers }),
    );
    await page.route('**/assets/**', (route) => {
        const url = new URL(route.request().url());
        return ['localhost', '127.0.0.1'].includes(url.hostname)
            ? route.continue()
            : route.abort();
    });
});
for (const phase of ['Dan', 'Sumrak', 'Noć'])
    test(`authored ${phase} view shows all five decorations, exact geometry and scenery without private requests`, async ({
        mount,
        page,
    }, info) => {
        const requests: string[] = [];
        page.on('request', (r) => requests.push(r.url()));
        const fixture = await mount(<KestenijadaFixture />);
        await expect(fixture).toHaveAttribute('data-ready', /.+/);
        if (phase !== 'Dan') {
            await page
                .getByRole('button', { name: phase, exact: true })
                .click();
            await expect(
                page.getByRole('button', { name: phase, exact: true }),
            ).toHaveAttribute('aria-pressed', 'true');
            await page.waitForTimeout(1500);
        }
        const data = JSON.parse(
            (await fixture.getAttribute('data-ready')) || '{}',
        );
        expect(data.geometry).toHaveLength(5);
        for (const item of data.geometry) {
            expect(item.meshes).toBeGreaterThan(0);
            expect(item.screen.minX).toBeGreaterThan(0);
            expect(item.screen.minY).toBeGreaterThan(0);
            expect(item.screen.maxX).toBeLessThan(data.width);
            expect(item.screen.maxY).toBeLessThan(data.height);
        }
        await expect(
            page.getByRole('heading', { name: 'Kolekcija Kestenijada' }),
        ).toBeVisible();
        await expect(
            page.getByRole('link', { name: /Pogledaj ponudu:/ }),
        ).toHaveCount(5);
        expect(
            requests.filter((url) =>
                /auth\/|accounts\/|gardens\/|presence/.test(url),
            ),
        ).toEqual([]);
        await info.attach(`kestenijada-${phase}.png`, {
            body: await page.locator('[data-kestenijada-scene]').screenshot({
                path: info.outputPath(`kestenijada-${phase}.png`),
            }),
            contentType: 'image/png',
        });
        await writeFile(
            info.outputPath(`kestenijada-${phase}.json`),
            JSON.stringify(data, null, 2),
        );
        await info.attach(`kestenijada-${phase}.json`, {
            body: JSON.stringify(data, null, 2),
            contentType: 'application/json',
        });
    });
test('mobile low/reduced-motion/weather-disabled view remains complete and directory retry does not invent offers', async ({
    mount,
    page,
}, info) => {
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let failed = true;
    await page.route('**/api/directories/entities/block**', (route) =>
        failed
            ? route.fulfill({ status: 503, json: { error: 'unavailable' } })
            : route.fulfill({ json: offers }),
    );
    const fixture = await mount(<KestenijadaFixture />);
    await expect(fixture).toHaveAttribute('data-ready', /.+/);
    await expect(page.getByRole('alert')).toContainText('Ponudu trenutačno');
    await expect(
        page.getByRole('link', { name: /Pogledaj ponudu:/ }),
    ).toHaveCount(0);
    failed = false;
    await page.getByRole('button', { name: 'Pokušaj ponovno' }).click();
    await expect(
        page.getByRole('link', { name: /Pogledaj ponudu:/ }),
    ).toHaveCount(5);
    const data = JSON.parse((await fixture.getAttribute('data-ready')) || '{}');
    expect(data.width).toBeLessThan(390);
    for (const item of data.geometry) {
        expect(item.screen.minX).toBeGreaterThan(0);
        expect(item.screen.minY).toBeGreaterThan(0);
        expect(item.screen.maxX).toBeLessThan(data.width);
        expect(item.screen.maxY).toBeLessThan(data.height);
    }
    await writeFile(
        info.outputPath('kestenijada-mobile-low.json'),
        JSON.stringify(data, null, 2),
    );
    await info.attach('kestenijada-mobile-low.png', {
        body: await page.locator('[data-kestenijada-scene]').screenshot({
            path: info.outputPath('kestenijada-mobile-low.png'),
        }),
        contentType: 'image/png',
    });
});
test('active local PNG can cancel, retry, close and share only static canonical permalink', async ({
    mount,
    page,
}) => {
    const writes: string[] = [];
    page.on('request', (r) => {
        if (r.method() !== 'GET' && r.method() !== 'HEAD') writes.push(r.url());
    });
    await page
        .context()
        .grantPermissions(['clipboard-read', 'clipboard-write']);
    const fixture = await mount(<KestenijadaFixture active />);
    await expect(fixture).toHaveAttribute('data-ready', /.+/);
    const photo = page.getByRole('button', {
        name: 'Trenutak uz kestene',
        exact: true,
    });
    await expect(photo).toBeVisible();
    await photo.click();
    await page.getByRole('button', { name: 'Odustani', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Preuzmi PNG' })).toHaveCount(
        0,
    );
    await photo.focus();
    await page.keyboard.press('Enter');
    await expect(
        page.getByRole('link', { name: 'Preuzmi PNG' }),
    ).toHaveAttribute('href', /^blob:/);
    await expect(
        page.getByRole('img', { name: 'Kestenijada, primjer uređenja' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Zatvori fotografiju' }).click();
    await expect(page.getByRole('link', { name: 'Preuzmi PNG' })).toHaveCount(
        0,
    );
    await page.getByRole('button', { name: 'Podijeli primjer' }).click();
    await expect(page.getByRole('status')).toContainText(
        'Poveznica je kopirana',
    );
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        'https://vrt.gredice.com/kestenijada',
    );
    expect(writes).toEqual([]);
});

test('photo encoder error persists and delayed cancelled work cannot replace the fresh local preview', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<KestenijadaFixture active />);
    await expect(fixture).toHaveAttribute('data-ready', /.+/);
    await page.evaluate(() => {
        const original = HTMLCanvasElement.prototype.toBlob;
        let attempt = 0;
        HTMLCanvasElement.prototype.toBlob = function (callback, type) {
            attempt++;
            document.documentElement.dataset.kestenijadaEncodeAttempt =
                String(attempt);
            if (attempt === 1) callback(null);
            else if (attempt === 2)
                document.addEventListener(
                    'release-cancelled-kestenijada',
                    () => callback(null),
                    { once: true },
                );
            else original.call(this, callback, type);
        };
    });
    const photo = page.getByRole('button', {
        name: 'Trenutak uz kestene',
        exact: true,
    });
    await photo.click();
    await expect(page.getByRole('alert')).toContainText(
        'Fotografiju nije moguće',
    );
    await expect(page.getByRole('link', { name: 'Preuzmi PNG' })).toHaveCount(
        0,
    );
    await photo.click();
    await expect
        .poll(() =>
            page.evaluate(
                () => document.documentElement.dataset.kestenijadaEncodeAttempt,
            ),
        )
        .toBe('2');
    await page.getByRole('button', { name: 'Odustani', exact: true }).click();
    await photo.click();
    await expect(
        page.getByRole('link', { name: 'Preuzmi PNG' }),
    ).toHaveAttribute('href', /^blob:/);
    const fresh = await page
        .getByRole('link', { name: 'Preuzmi PNG' })
        .getAttribute('href');
    await page.evaluate(() =>
        document.dispatchEvent(new Event('release-cancelled-kestenijada')),
    );
    await page.waitForTimeout(300);
    await expect(
        page.getByRole('link', { name: 'Preuzmi PNG' }),
    ).toHaveAttribute('href', fresh ?? '');
    await expect(page.getByRole('alert')).toHaveCount(0);
});
