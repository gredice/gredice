import { readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/experimental-ct-react';
import sharp from 'sharp';
import { GardenStructureCatalogThumbnail as StaticCatalogThumbnail } from '../../../packages/game/src/structures/catalog/GardenStructureCatalogThumbnail';
import {
    gardenStructureCatalogTotalMaxBytes,
    gardenStructureKitV1CatalogEntries,
} from '../../../packages/game/src/structures/catalog/gardenStructureKitV1Catalog';
import { GardenStructureCatalogPickerStory } from './GardenStructureCatalogPickerStory';

const publicRoot = resolve('./public');
const catalogRoot = resolve(
    publicRoot,
    'assets/structures/gredice-buildings/v1/catalog',
);

function publicPath(src: string) {
    return resolve(publicRoot, src.slice(1));
}

async function listWebpFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const paths = await Promise.all(
        entries.map(async (entry) => {
            const path = resolve(directory, entry.name);
            return entry.isDirectory()
                ? listWebpFiles(path)
                : entry.name.endsWith('.webp')
                  ? [path]
                  : [];
        }),
    );
    return paths.flat();
}

test.use({ hasTouch: true, viewport: { height: 844, width: 390 } });

test('generated catalogue files stay synchronized and within media budgets', async () => {
    const expectedPaths = gardenStructureKitV1CatalogEntries
        .map(({ image }) => publicPath(image.src))
        .toSorted((left, right) => left.localeCompare(right));
    const actualPaths = (await listWebpFiles(catalogRoot)).toSorted(
        (left, right) => left.localeCompare(right),
    );
    expect(actualPaths).toEqual(expectedPaths);

    let totalBytes = 0;
    for (const entry of gardenStructureKitV1CatalogEntries) {
        const path = publicPath(entry.image.src);
        const [metadata, file] = await Promise.all([
            sharp(path).metadata(),
            stat(path),
        ]);
        expect(metadata.format, entry.key).toBe('webp');
        expect(metadata.width, entry.key).toBe(entry.image.width);
        expect(metadata.height, entry.key).toBe(entry.image.height);
        expect(file.size, entry.key).toBeLessThanOrEqual(entry.image.maxBytes);
        totalBytes += file.size;
    }
    expect(totalBytes).toBeLessThanOrEqual(gardenStructureCatalogTotalMaxBytes);
});

test('mobile chooser cards use static images without loading a GLB or canvas', async ({
    mount,
    page,
}) => {
    const modelRequests: string[] = [];
    page.on('request', (request) => {
        if (request.url().includes('/assets/models/')) {
            modelRequests.push(request.url());
        }
    });
    await page.route('**/assets/structures/**', (route) => {
        const pathname = new URL(route.request().url()).pathname;
        return route.fulfill({
            contentType: 'image/webp',
            path: publicPath(pathname),
        });
    });

    const component = await mount(
        <fieldset
            style={{
                display: 'grid',
                gap: 8,
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                width: 358,
            }}
        >
            <legend>Dijelovi građevine</legend>
            {gardenStructureKitV1CatalogEntries.map((entry) => (
                <button
                    key={entry.key}
                    style={{ minHeight: 88, minWidth: 0 }}
                    type="button"
                >
                    <StaticCatalogThumbnail
                        alt=""
                        entry={entry}
                        loading="eager"
                        style={{
                            height: 64,
                            objectFit: 'contain',
                            width: '100%',
                        }}
                    />
                    <span>{entry.label}</span>
                </button>
            ))}
        </fieldset>,
    );

    const images = component.locator('img');
    await expect(images).toHaveCount(gardenStructureKitV1CatalogEntries.length);
    await expect
        .poll(() =>
            images.evaluateAll((elements) =>
                elements.every(
                    (element) =>
                        element instanceof HTMLImageElement &&
                        element.complete &&
                        element.naturalWidth > 0,
                ),
            ),
        )
        .toBe(true);
    await expect(component.locator('canvas')).toHaveCount(0);
    expect(modelRequests).toEqual([]);

    await page.keyboard.press('Tab');
    await expect(
        component.getByRole('button', { name: 'Staja' }),
    ).toBeFocused();
});

test('catalogue picker supports radio keyboard and touch selection', async ({
    mount,
    page,
}) => {
    const modelRequests: string[] = [];
    page.on('request', (request) => {
        if (request.url().includes('/assets/models/')) {
            modelRequests.push(request.url());
        }
    });
    await page.route('**/assets/structures/**', (route) => {
        const pathname = new URL(route.request().url()).pathname;
        return route.fulfill({
            contentType: 'image/webp',
            path: publicPath(pathname),
        });
    });

    const component = await mount(<GardenStructureCatalogPickerStory />);
    const group = page.getByRole('group', {
        name: 'Predložak građevine',
    });
    const barn = group.getByRole('radio', { name: 'Staja' });
    const house = group.getByRole('radio', { name: 'Kuća' });
    const greenhouse = group.getByRole('radio', { name: 'Staklenik' });

    await expect(group.getByRole('radio')).toHaveCount(4);
    await expect(barn).toBeChecked();
    await barn.focus();
    await page.keyboard.press('ArrowRight');
    await expect(house).toBeChecked();
    await group.locator('label:has(input[value="greenhouse"])').tap();
    await expect(greenhouse).toBeChecked();
    await expect(group.locator('img').first()).toHaveAttribute(
        'src',
        /\/assets\/structures\/gredice-buildings\/v1\/catalog\/templates\//,
    );
    await expect(component.locator('canvas')).toHaveCount(0);
    expect(modelRequests).toEqual([]);
    expect(
        await group
            .locator('label:has(input[value="greenhouse"]) > span')
            .evaluate((element) => element.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(44);
});
