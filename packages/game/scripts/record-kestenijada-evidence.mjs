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
    captureParity.push({
        view,
        pngByteIdentical: currentPng.equals(originalPng),
        worldAndScreenBoundsIdentical:
            JSON.stringify(currentGeometry.geometry) ===
            JSON.stringify(originalGeometry.geometry),
        viewportIdentical:
            currentGeometry.width === originalGeometry.width &&
            currentGeometry.height === originalGeometry.height,
    });
}
const evidence = {
    schemaVersion: 2,
    originalImplementationCommit: 'd0fee5e13a2230d160c723a4ea65e52d1c285d83',
    originalEvidencePath:
        'docs/kestenijada-2026/original-d0fee5e13/evidence.json',
    originalEvidenceSha256: createHash('sha256')
        .update(
            await readFile(
                path.join(
                    root,
                    'docs/kestenijada-2026/original-d0fee5e13/evidence.json',
                ),
            ),
        )
        .digest('hex'),
    captureParentCommit: 'f97ddf38b6009103819902f9494a0fd5e2f28286',
    captureImplementationCommit: '92291768bd704c731976c4decb3f276a9fa9868b',
    integrationParentCommit: '9b9df59b18d98c4d2e98642d77f5d84504bc04d4',
    rebasedImplementationCommit: '536eaedb29c975796a7716ad50311d6d03e7dd15',
    sourceIdentity:
        'Exact current-source SHA256 records; verification needs no historic Git objects or network.',
    scope: 'Bounded selected runtime identity evidence, not a complete renderer dependency graph or reproducible full-engine/performance proof.',
    models,
    captureParity,
    finalParentChange:
        'Compared with capture parent, final UI parent changed only two test files; production renderer bytes are unchanged.',
    visualReview:
        'Original authored scene approved by Astra xhigh; fresh integration captures retain measured in-frame geometry. Original reviewed capture provenance is archived separately.',
    rendererCounters:
        'Incidental diagnostic samples, not cost or performance evidence.',
    files,
};
await writeFile(
    path.join(root, 'docs/kestenijada-2026/evidence.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
);
