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
const evidence = {
    schemaVersion: 1,
    sourceIdentity:
        'Exact current-source SHA256 records; verification needs no historic Git objects or network.',
    scope: 'Bounded selected runtime identity evidence, not a complete renderer dependency graph or reproducible full-engine/performance proof.',
    models,
    visualReview:
        'Astra xhigh approved day/dusk/night/mobile scene; measured final geometry is fully in frame.',
    rendererCounters:
        'Incidental diagnostic samples, not cost or performance evidence.',
    files,
};
await writeFile(
    path.join(root, 'docs/kestenijada-2026/evidence.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
);
