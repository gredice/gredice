import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { harvestPumpkins } from '@gredice/js/harvestPumpkins';
import { gameAssetModels } from '../src/data/gameAssetModels.generated';

const root = new URL('../../../', import.meta.url);
function sha256(path: string) {
    return createHash('sha256')
        .update(readFileSync(new URL(path, root)))
        .digest('hex');
}
const assets = [...new Set(harvestPumpkins.map(({ asset }) => asset))];
const models = assets.map((name) => {
    const path = `apps/garden/public/assets/models/${name}.glb`;
    const bytes = readFileSync(new URL(path, root));
    const document: {
        meshes: { primitives: { indices: number }[] }[];
        accessors: { count: number }[];
        materials: unknown[];
    } = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    const triangles = document.meshes.reduce(
        (sum, mesh) =>
            sum +
            mesh.primitives.reduce(
                (count, primitive) =>
                    count + document.accessors[primitive.indices].count / 3,
                0,
            ),
        0,
    );
    return {
        name,
        path,
        url: gameAssetModels[name].url,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        bytes: bytes.length,
        triangles,
        meshCount: document.meshes.length,
        materialCount: document.materials.length,
    };
});
const release = {
    issue: 4948,
    publicationIssue: 5000,
    state: 'unpublished',
    models,
    items: harvestPumpkins.map((item) => {
        const name = item.name;
        return {
            ...item,
            catalogueId: null,
            cover: `/assets/blocks/${name}.webp`,
            topDown: `/assets/blocks/top-down/${name}.webp`,
            images: ['', '_1', '_2', '_3', '_4'].flatMap((suffix) =>
                [
                    `apps/www/public/assets/blocks/${name}${suffix}.webp`,
                    `apps/garden/public/assets/blocks/top-down/${name}${suffix}.webp`,
                ].map((path) => ({ path, sha256: sha256(path) })),
            ),
        };
    }),
};
mkdirSync(new URL('docs/harvest-pumpkins-2026/', root), {
    recursive: true,
});
writeFileSync(
    new URL('docs/harvest-pumpkins-2026/release-manifest.json', root),
    `${JSON.stringify(release, null, 2)}\n`,
);
console.log(JSON.stringify(release.models));
