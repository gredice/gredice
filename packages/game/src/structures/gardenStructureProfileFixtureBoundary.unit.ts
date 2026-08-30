import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { getGardenStructurePayloadByteLength } from '@gredice/js/gardenStructures';
import type { GardenStructureProfileFixtureKey } from './gardenStructureProfileFixtureDescriptor';
import { createGardenStructureProfileFixtureDescriptor } from './gardenStructureProfileFixtureFactory';

const structuresRoot = dirname(fileURLToPath(import.meta.url));

describe('garden structure profile fixture boundary', () => {
    test('constructs every bounded descriptor behind the server boundary', () => {
        const keys: readonly GardenStructureProfileFixtureKey[] = [
            'barn',
            'blank',
            'greenhouse',
            'house',
            'worst-case',
        ];
        for (const key of keys) {
            const descriptor =
                createGardenStructureProfileFixtureDescriptor(key);
            assert.equal(descriptor.key, key);
            assert.ok(descriptor.document.footprint.cells.length <= 100);
            assert.ok(
                (getGardenStructurePayloadByteLength(descriptor.document) ??
                    Number.POSITIVE_INFINITY) <=
                    192 * 1024,
            );
        }
    });

    test('keeps fixture constructors out of the production GameScene graph', () => {
        const gameScene = readFileSync(
            resolve(structuresRoot, '..', 'GameScene.tsx'),
            'utf8',
        );
        const gameHud = readFileSync(
            resolve(structuresRoot, '..', 'GameHud.tsx'),
            'utf8',
        );
        const savedStructureScene = readFileSync(
            resolve(structuresRoot, 'gardenStructureScene.tsx'),
            'utf8',
        );
        const assetRenderer = readFileSync(
            resolve(structuresRoot, 'GardenStructureKitV1AssetRenderer.tsx'),
            'utf8',
        );
        const verticalSlice = readFileSync(
            resolve(structuresRoot, 'GardenStructureVerticalSlice.tsx'),
            'utf8',
        );
        const profilePage = readFileSync(
            resolve(
                structuresRoot,
                '../../../../apps/garden/app/debug/profile/game/page.tsx',
            ),
            'utf8',
        );
        const productionBarrel = readFileSync(
            resolve(structuresRoot, 'index.ts'),
            'utf8',
        );
        const serverBoundary = readFileSync(
            resolve(structuresRoot, 'gardenStructureProfileFixture.server.ts'),
            'utf8',
        );
        assert.doesNotMatch(gameScene, /benchmarkStructureCompiler/);
        assert.doesNotMatch(
            gameScene,
            /createWorstCaseGardenStructureDocument/,
        );
        assert.doesNotMatch(gameScene, /createGardenStructureTemplateSeed/);
        assert.doesNotMatch(productionBarrel, /benchmarkStructureCompiler/);
        assert.match(serverBoundary, /import ['"]server-only['"]/u);
        assert.doesNotMatch(
            gameScene,
            /^import .*GardenStructureVerticalSlice['"];?$/mu,
        );
        assert.doesNotMatch(
            gameHud,
            /^import .*GardenStructureVerticalSliceHud['"];?$/mu,
        );
        assert.doesNotMatch(
            savedStructureScene,
            /^import .*GardenStructureCollectionRenderer['"];?$/mu,
        );
        assert.doesNotMatch(
            profilePage,
            /^import .*garden-building-profile-fixture['"];?$/mu,
        );
        assert.match(
            profilePage,
            /await import\(\s*['"]@gredice\/game\/garden-building-profile-fixture['"]\s*\)/u,
        );
        assert.match(gameScene, /onClickCapture=\{handleClickCapture\}/u);
        assert.match(gameScene, /onClick=\{handleClick\}/u);
        assert.doesNotMatch(
            assetRenderer,
            /recordGardenStructurePointerResolution/u,
        );
        assert.doesNotMatch(
            verticalSlice,
            /recordGardenStructurePointerResolution/u,
        );
    });
});
