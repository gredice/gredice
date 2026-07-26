import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import type { SpriteAtlasManifest } from '../../sprites/types';
import { groundDecorationAtlasBasePath } from './groundDecorationConfig';

const appNames = ['garden', 'www'];
const legacyFileNames = [
    'ground-cover.atlas.json',
    'ground-cover.atlas.png',
    'ground-cover.atlas.webp',
    'ground-cover.atlas.1.png',
    'ground-cover.atlas.1.webp',
];
const versionedFileNames = [
    'ground-cover-v2.atlas.json',
    'ground-cover-v2.atlas.png',
    'ground-cover-v2.atlas.webp',
];

function resolveAssetUrl(appName: string, fileName: string) {
    return new URL(
        `../../../../../apps/${appName}/public/assets/sprites/decorations/${fileName}`,
        import.meta.url,
    );
}

async function readManifest(appName: string, baseName: string) {
    const contents = await readFile(
        resolveAssetUrl(appName, `${baseName}.json`),
        'utf8',
    );
    const manifest: SpriteAtlasManifest = JSON.parse(contents);

    return manifest;
}

test('keeps legacy atlas files while loading the optimized atlas from a versioned URL', async () => {
    assert.match(groundDecorationAtlasBasePath, /ground-cover-v\d+\.atlas$/u);

    await Promise.all(
        appNames.flatMap((appName) =>
            [...legacyFileNames, ...versionedFileNames].map((fileName) =>
                access(resolveAssetUrl(appName, fileName)),
            ),
        ),
    );
});

test('ships byte-identical one-page optimized atlases in Garden and WWW', async () => {
    const [gardenManifest, wwwManifest] = await Promise.all(
        appNames.map((appName) =>
            readManifest(appName, 'ground-cover-v2.atlas'),
        ),
    );
    const legacyManifest = await readManifest('garden', 'ground-cover.atlas');

    assert.deepEqual(wwwManifest, gardenManifest);
    assert.equal(gardenManifest.pages?.length, 1);
    assert.equal(gardenManifest.atlas?.width, 1024);
    assert.equal(gardenManifest.atlas?.height, 1024);
    assert.deepEqual(
        Object.keys(gardenManifest.sprites).sort(),
        Object.keys(legacyManifest.sprites).sort(),
    );

    const page = gardenManifest.pages?.[0];
    assert.ok(page);
    for (const sprite of Object.values(gardenManifest.sprites)) {
        assert.equal(sprite.page ?? 0, page.index);
        assert.ok(sprite.frame.x >= 0);
        assert.ok(sprite.frame.y >= 0);
        assert.ok(sprite.frame.x + sprite.frame.width <= page.atlas.width);
        assert.ok(sprite.frame.y + sprite.frame.height <= page.atlas.height);
    }

    for (const fileName of versionedFileNames) {
        const [gardenFile, wwwFile] = await Promise.all(
            appNames.map((appName) =>
                readFile(resolveAssetUrl(appName, fileName)),
            ),
        );
        assert.deepEqual(wwwFile, gardenFile);
    }
});
