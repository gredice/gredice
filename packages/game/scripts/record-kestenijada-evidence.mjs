import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const paths = [
    'packages/js/src/kestenijada/index.ts',
    'packages/js/src/chestnutRoastingCart/index.ts',
    'packages/js/src/autumnBlanketBench/index.ts',
    'packages/js/src/gardenTeaTable/index.ts',
    'packages/js/src/harvestCrates/index.ts',
    'packages/game/src/kestenijada/KestenijadaViewer.tsx',
    'packages/game/src/kestenijada/kestenijadaScene.ts',
    'packages/game/src/kestenijada/kestenijadaCollection.ts',
    'packages/game/src/localSandboxBlockData.ts',
    'packages/game/src/data/gameAssetModels.generated.ts',
    'packages/game/tests/KestenijadaFixture.tsx',
    'apps/garden/tests/kestenijada.spec.tsx',
    'apps/garden/tests/kestenijada-route.spec.ts',
    'apps/garden/tests/fixtures/kestenijada-server.mjs',
    'apps/garden/playwright.kestenijada-route.config.ts',
    'apps/garden/playwright.config.ts',
    '.github/workflows/ci.yml',
    'packages/game/scripts/record-kestenijada-evidence.mjs',
    'packages/game/src/viewers/PublicGardenViewer.tsx',
    'packages/game/src/viewers/PublicGardenCaptureProbe.tsx',
    'packages/game/src/controls/GameCameraRig.tsx',
    'packages/game/src/controls/orthographicCameraFit.ts',
    'packages/game/src/entities/helpers/EntityPreviewContext.ts',
    'packages/game/src/utils/useGameGLTF.ts',
    'packages/game/src/utils/configureGameGLTFMaterials.ts',
    'packages/game/src/utils/stackHeightCore.ts',
    'packages/game/src/utils/timeOfDay.ts',
    'packages/game/src/entities/EntityFactory.tsx',
    'packages/game/src/entities/EntityInstances.tsx',
    'packages/game/src/entities/RetainedEntityChunks.tsx',
    'packages/game/src/entities/entityNameMap.ts',
    'packages/game/src/entities/helpers/useAnimatedEntityRotation.ts',
    'packages/game/src/entities/helpers/WeatheredEntityPart.tsx',
    'packages/game/src/entities/helpers/groundPatchMaterial.ts',
    'packages/game/src/scene/Environment.tsx',
    'packages/game/src/scene/gameQuality.ts',
    'packages/game/src/scene/Scene.tsx',
    'packages/game/src/useGameState.ts',
    'packages/game/src/entities/helpers/GardenNightLight.tsx',
    'packages/game/src/entities/helpers/nightGardenLight.ts',
    'packages/game/src/entities/helpers/PumpkinLightOverrideContext.ts',
    'packages/game/src/scene/GardenLightProvider.tsx',
    'apps/garden/app/kestenijada/page.tsx',
    'apps/garden/app/kestenijada/KestenijadaDiscoveryEntry.tsx',
    'apps/garden/components/providers/ClientAppProvider.tsx',
    'apps/garden/app/layout.tsx',
];
const models = [
    'ChestnutRoastingCart',
    'GardenTeaTable',
    'AutumnBlanketBench',
    'HarvestCrateOrchard',
    'WoodenHandLantern',
    'BlockGrass',
    'StoneWalkway',
];
for (const model of models) {
    paths.push(
        `packages/game/src/entities/${model === 'HarvestCrateOrchard' ? 'HarvestCrate' : model}.tsx`,
        `apps/garden/public/assets/models/${model}.glb`,
    );
}
for (const view of ['day', 'dusk', 'night', 'mobile-low'])
    paths.push(
        `docs/kestenijada-2026/${view}.png`,
        `docs/kestenijada-2026/${view}.json`,
    );
const files = [];
for (const file of [...new Set(paths)].sort()) {
    const bytes = await readFile(path.join(root, file));
    files.push({
        path: file,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
    });
}
const previousEvidencePath =
    'docs/kestenijada-2026/pre-activity-stack/evidence.json';
const previousEvidenceBytes = await readFile(
    path.join(root, previousEvidencePath),
);
const previousEvidence = JSON.parse(previousEvidenceBytes);
const captureSources = [];
const captureParity = [];
for (const view of ['day', 'dusk', 'night', 'mobile-low']) {
    const current = path.join(root, `docs/kestenijada-2026/${view}`);
    const original = path.join(
        root,
        `docs/kestenijada-2026/original-d0fee5e13/${view}`,
    );
    const currentPng = await readFile(`${current}.png`);
    const originalPng = await readFile(`${original}.png`);
    const currentGeometry = JSON.parse(
        await readFile(`${current}.json`, 'utf8'),
    );
    const originalGeometry = JSON.parse(
        await readFile(`${original}.json`, 'utf8'),
    );
    if (
        !currentGeometry.source?.commit ||
        !currentGeometry.source?.tree ||
        currentGeometry.source.status !== ''
    )
        throw new Error(`Missing clean source identity for ${view}`);
    captureSources.push(currentGeometry.source);
    const previousPng = await readFile(
        path.join(root, `docs/kestenijada-2026/pre-activity-stack/${view}.png`),
    );
    captureParity.push({
        view,
        pngByteIdentical: currentPng.equals(originalPng),
        previousCapturePngByteIdentical: currentPng.equals(previousPng),
        worldAndScreenBoundsIdentical:
            JSON.stringify(currentGeometry.geometry) ===
            JSON.stringify(originalGeometry.geometry),
        viewportIdentical:
            currentGeometry.width === originalGeometry.width &&
            currentGeometry.height === originalGeometry.height,
    });
}
if (
    captureSources.some(
        (source) =>
            JSON.stringify(source) !== JSON.stringify(captureSources[0]),
    )
)
    throw new Error(
        'Kestenijada captures must share one clean source commit and tree',
    );
const evidence = {
    schemaVersion: 3,
    originalImplementationCommit: previousEvidence.originalImplementationCommit,
    originalEvidencePath: previousEvidence.originalEvidencePath,
    originalEvidenceSha256: previousEvidence.originalEvidenceSha256,
    previousEvidence: {
        path: previousEvidencePath,
        sha256: createHash('sha256')
            .update(previousEvidenceBytes)
            .digest('hex'),
        captureParentCommit: previousEvidence.captureParentCommit,
        captureImplementationCommit:
            previousEvidence.captureImplementationCommit,
        integrationParentCommit: previousEvidence.integrationParentCommit,
        rebasedImplementationCommit:
            previousEvidence.rebasedImplementationCommit,
    },
    activityStackCapture: {
        source: captureSources[0],
        command:
            'pnpm --filter garden exec playwright test --config playwright.kestenijada.config.ts --workers=1',
        captureTests: 4,
        sceneCaptures: 4,
        suiteTests: 6,
        scope: 'Fresh captures from the activity and trail stack, including public-scene private-request exclusion and local-photo lifecycle coverage. Route verification is recorded separately in the activity-stack report.',
    },
    sourceIdentity:
        'Exact current-source SHA256 records; verification needs no historic Git objects or network.',
    scope: 'Bounded selected runtime identity evidence, not a complete renderer dependency graph or reproducible full-engine/performance proof.',
    models,
    captureParity,
    visualReview:
        'Original authored scene approval and earlier integration evidence are retained in the archived records. Current image parity and any additional visual review are recorded in activity-stack-recapture.json.',
    rendererCounters:
        'Incidental diagnostic samples, not cost or performance evidence.',
    files,
};
await writeFile(
    path.join(root, 'docs/kestenijada-2026/evidence.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
);
