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
        const profileMetricsReporter = readFileSync(
            resolve(
                structuresRoot,
                'GardenStructureKitV1ProfileMetricsReporter.tsx',
            ),
            'utf8',
        );
        const verticalSlice = readFileSync(
            resolve(structuresRoot, 'GardenStructureVerticalSlice.tsx'),
            'utf8',
        );
        const verticalSliceHud = readFileSync(
            resolve(structuresRoot, 'GardenStructureVerticalSliceHud.tsx'),
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
        assert.match(
            gameScene,
            /const startedAt = gardenStructureProfileTelemetryEnabled\s*\? performance\.now\(\)\s*: 0;/u,
        );
        assert.match(
            gameScene,
            /durationMs: gardenStructureProfileTelemetryEnabled\s*\? performance\.now\(\) - startedAt\s*: 0/u,
        );
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
            assetRenderer,
            /measureGardenStructureKitV1ProfileMetrics/u,
        );
        assert.doesNotMatch(assetRenderer, /useGameState/u);
        assert.match(
            assetRenderer,
            /lazy\(\(\)\s*=>\s*import\(['"]\.\/GardenStructureKitV1ProfileMetricsReporter['"]\)/u,
        );
        assert.match(
            profileMetricsReporter,
            /requestAnimationFrame\(\(\)\s*=>\s*\{\s*const measuredProfile = measureGardenStructureKitV1ProfileMetrics/u,
        );
        assert.doesNotMatch(
            profileMetricsReporter,
            /const measuredProfile = useMemo/u,
        );
        assert.doesNotMatch(
            verticalSlice,
            /recordGardenStructurePointerResolution/u,
        );
        assert.match(verticalSlice, /if \(!profileMetricsEnabled\) \{/u);

        const setSessionSource = verticalSliceHud.slice(
            verticalSliceHud.indexOf('const setSession = useCallback'),
            verticalSliceHud.indexOf('const gameStateStore'),
        );
        assert.ok(
            setSessionSource.indexOf('if (!profileMetricsEnabled)') <
                setSessionSource.indexOf(
                    'profileStartedAt ?? performance.now()',
                ),
        );
        assert.match(
            setSessionSource,
            /profileStartedAt\?: number[\s\S]*const startedAt = profileStartedAt \?\? performance\.now\(\)[\s\S]*scheduleGardenStructureEditorProfileFrame\([\s\S]*startedAt/u,
        );

        const updatePlacementSource = verticalSliceHud.slice(
            verticalSliceHud.indexOf('function updatePlacement'),
            verticalSliceHud.indexOf('function confirmPlacement'),
        );
        assert.match(
            updatePlacementSource,
            /function updatePlacement\([\s\S]*profileStartedAt\?: number[\s\S]*applyEditorResult\([\s\S]*profileStartedAt/u,
        );
        for (const actionName of ['nudgePlacement', 'rotatePlacement']) {
            const actionStart = updatePlacementSource.indexOf(
                `function ${actionName}`,
            );
            assert.notEqual(actionStart, -1);
            const nextActionStart = updatePlacementSource.indexOf(
                'function ',
                actionStart + 1,
            );
            const actionSource = updatePlacementSource.slice(
                actionStart,
                nextActionStart === -1
                    ? updatePlacementSource.length
                    : nextActionStart,
            );
            assert.ok(
                actionSource.indexOf('const profileStartedAt') <
                    actionSource.indexOf('if (editor)'),
            );
            assert.match(
                actionSource,
                /updatePlacement\([\s\S]*profileStartedAt/u,
            );
        }
    });

    test('grounds named fixtures and avatar spawn through their guarded profile paths', () => {
        const gameScene = readFileSync(
            resolve(structuresRoot, '..', 'GameScene.tsx'),
            'utf8',
        );
        const profilePage = readFileSync(
            resolve(
                structuresRoot,
                '../../../../apps/garden/app/debug/profile/game/page.tsx',
            ),
            'utf8',
        );

        assert.match(
            gameScene,
            /: gardenStructureProfileFixture\s*\? createGardenStructureSceneFixtureBuildPreviewCompileInput\(\{\s*blockData,\s*document,\s*placement: gardenStructureProfileFixture\.placement,\s*revision: gardenStructureProfileFixture\.revision,\s*stacks: garden\?\.stacks,/u,
        );
        assert.match(
            profilePage,
            /gardenAvatarInitialSpawnPoint=\{\s*gardenAvatar && gardenBuilding\s*\?/u,
        );
    });
});
