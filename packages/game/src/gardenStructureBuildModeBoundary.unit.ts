import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceRoot = dirname(fileURLToPath(import.meta.url));
const gameSceneSource = readFileSync(join(sourceRoot, 'GameScene.tsx'), 'utf8');
const buildHudSource = readFileSync(
    join(sourceRoot, 'structures/GardenStructureVerticalSliceHud.tsx'),
    'utf8',
);
const historyGuardSource = readFileSync(
    join(sourceRoot, 'structures/useGardenStructureBuildModeHistoryGuard.ts'),
    'utf8',
);
function sourceBetween(source: string, start: string, end: string) {
    const startIndex = source.indexOf(start);
    const endIndex = source.indexOf(end, startIndex + start.length);
    assert.notEqual(startIndex, -1, `missing source boundary: ${start}`);
    assert.notEqual(endIndex, -1, `missing source boundary: ${end}`);
    return source.slice(startIndex, endIndex);
}

test('uses only the managed building flag for build-mode discovery while saved structures keep rendering', () => {
    const entryGate = sourceBetween(
        gameSceneSource,
        'const gardenStructureVerticalSliceEnabled',
        'const structureBuildActive',
    );

    assert.match(entryGate, /flags\?\.enableGardenBuildingSystemFlag/);
    assert.doesNotMatch(
        entryGate,
        /gardenStructureDebugFixture|isLocalSandbox/,
    );
    assert.match(
        gameSceneSource,
        /const savedStructureScene = useGardenStructureSceneSnapshot\(\{[\s\S]*?records: blockData \? browseStructureRecords : undefined/,
    );
    assert.match(
        gameSceneSource,
        /const editedStructureId =\s*structureBuildActive && structureBuildSession/,
    );
    assert.match(
        gameSceneSource,
        /<GardenStructureSceneLayerDynamic[\s\S]*?snapshot=\{savedStructureScene\}/,
    );
});

test('suspends world interactions while retaining build-mode camera gestures', () => {
    assert.match(
        gameSceneSource,
        /const structureBuildActive = Boolean\(\s*gardenStructureVerticalSliceEnabled && structureBuildSession,?\s*\)/,
    );
    assert.match(
        gameSceneSource,
        /controlsEnabled=\{\s*!noControls &&\s*!gardenAvatarActive &&\s*!structureBuildActive\s*\}/,
    );
    const overviewCamera = sourceBetween(
        gameSceneSource,
        '<GameCameraRig',
        '</BlockInteractionRegistryProvider>',
    );
    assert.match(
        overviewCamera,
        /controlsEnabled=\{\s*!noControls && !gardenAvatarActive\s*\}/,
    );
    assert.doesNotMatch(
        overviewCamera,
        /controlsEnabled=\{[^}]*structureBuildActive/,
    );
    assert.match(
        gameSceneSource,
        /interactionDisabled=\{\s*structureBuildActive\s*\}/,
    );
    assert.match(
        gameSceneSource,
        /noControls=\{\s*noControls \|\|\s*structureBuildActive\s*\}/,
    );
    assert.match(
        gameSceneSource,
        /<SunflowerDropReward[\s\S]*?enabled=\{\s*!isLocalSandbox &&\s*!isMock &&\s*!structureBuildActive\s*\}/,
    );
    assert.match(
        gameSceneSource,
        /<GardenPreviewCaptureController[\s\S]*?enabled=\{\s*!isLocalSandbox && !isMock && !structureBuildActive\s*\}/,
    );
});

test('keeps new drafts local until the explicit Done action', () => {
    const startFlow = sourceBetween(
        buildHudSource,
        'function startTemplate',
        'function enterBuildMode',
    );

    assert.doesNotMatch(startFlow, /mutations\.save\.(?:mutate|mutateAsync)/);
    assert.match(buildHudSource, /onClick=\{saveAndExit\}/);
});

test('keeps the editor background inert while a confirmation is open', () => {
    assert.match(
        buildHudSource,
        /aria-hidden=\{confirmationOpen \|\| undefined\}[\s\S]*?inert=\{confirmationOpen \? true : undefined\}/,
    );
});

test('bounds camera handoff retries and creates history markers only when arming the guard', () => {
    assert.match(
        gameSceneSource,
        /const gardenStructureCameraFocusAttemptLimit = \d+;/,
    );
    assert.match(
        gameSceneSource,
        /focusAttemptCount < gardenStructureCameraFocusAttemptLimit[\s\S]*?requestAnimationFrame/,
    );
    assert.match(historyGuardSource, /useRef<string \| null>\(null\)/);
    const armGuard = sourceBetween(
        historyGuardSource,
        'const armGuard',
        'const releaseGuard',
    );
    assert.match(armGuard, /markerRef\.current \?\? createHistoryMarker\(\)/);
});
