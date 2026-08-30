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
        /<GardenStructureSceneLayer[\s\S]*?snapshot=\{savedStructureScene\}/,
    );
});

test('suspends normal block and avatar interactions only for an active build session', () => {
    assert.match(
        gameSceneSource,
        /const structureBuildActive = Boolean\(\s*gardenStructureVerticalSliceEnabled && structureBuildSession,?\s*\)/,
    );
    assert.match(
        gameSceneSource,
        /controlsEnabled=\{\s*!noControls &&\s*!gardenAvatarActive &&\s*!structureBuildActive\s*\}/,
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

test('keeps new drafts local until Done and acknowledges the response before closing', () => {
    const startFlow = sourceBetween(
        buildHudSource,
        'function startTemplate',
        'async function saveAndExit',
    );
    const saveFlow = sourceBetween(
        buildHudSource,
        'async function saveAndExit',
        'async function demolishStructure',
    );

    assert.doesNotMatch(startFlow, /mutations\.save\.(?:mutate|mutateAsync)/);
    assert.match(buildHudSource, /onClick=\{saveAndExit\}/);
    assert.equal(
        buildHudSource.match(/mutations\.save\.mutateAsync/g)?.length,
        1,
    );

    const mutationIndex = saveFlow.indexOf('mutations.save.mutateAsync');
    const acknowledgeIndex = saveFlow.indexOf(
        'acknowledgeGardenStructureEditorSave',
    );
    const installIndex = saveFlow.indexOf(
        'setSession({ ...session, editor: acknowledged.value })',
    );
    const dirtyAcknowledgementIndex = saveFlow.indexOf(
        "acknowledged.value.save.status === 'dirty'",
    );
    const closeIndex = saveFlow.indexOf('setSession(null)');
    assert.notEqual(mutationIndex, -1);
    assert.ok(acknowledgeIndex > mutationIndex);
    assert.ok(installIndex > acknowledgeIndex);
    assert.ok(dirtyAcknowledgementIndex > installIndex);
    assert.ok(closeIndex > dirtyAcknowledgementIndex);
});

test('retains operation IDs for ambiguous save and demolition outcomes', () => {
    const saveFlow = sourceBetween(
        buildHudSource,
        'async function saveAndExit',
        'async function demolishStructure',
    );
    const demolishFlow = sourceBetween(
        buildHudSource,
        'async function demolishStructure',
        'useEffect(() =>',
    );

    assert.match(
        saveFlow,
        /editor\.save\.status === 'offline'[\s\S]*?editor\.save\.operationId[\s\S]*?\? editor\.save\.operationId/,
    );
    assert.match(
        saveFlow,
        /clientError\.outcome === 'unknown'[\s\S]*?markGardenStructureEditorOffline\(/,
    );
    assert.match(
        demolishFlow,
        /demolishOperationId \?\? createIdentifier\('demolish'\)/,
    );
    assert.match(
        demolishFlow,
        /error\.outcome === 'rejected'[\s\S]*?setDemolishOperationId\(null\)/,
    );
});

test('uses modal alert dialogs with focus containment and an inert editor background', () => {
    assert.match(
        buildHudSource,
        /aria-hidden=\{confirmationOpen \|\| undefined\}[\s\S]*?inert=\{confirmationOpen \? true : undefined\}/,
    );
    assert.equal(buildHudSource.match(/role="alertdialog"/g)?.length, 1);
    assert.equal(buildHudSource.match(/aria-modal="true"/g)?.length, 1);
    assert.match(buildHudSource, /cancelButtonRef\.current\?\.focus/);
    assert.match(buildHudSource, /testId="garden-structure-exit-dialog"/);
    assert.match(buildHudSource, /testId="garden-structure-demolish-dialog"/);
    assert.match(
        buildHudSource,
        /returnTarget\.focus\(\{ preventScroll: true \}\)/,
    );
    assert.match(buildHudSource, /entryButtonRef\.current\?\.focus/);
    assert.match(buildHudSource, /function trapFocus/);
});
