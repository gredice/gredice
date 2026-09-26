import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pumpkinLanterns } from '@gredice/js/pumpkinLanterns';
import { gameAssetModels } from '../src/data/gameAssetModels.generated';

const root = new URL('../../../', import.meta.url);
function file(path: string) {
    const bytes = readFileSync(new URL(path, root));
    return {
        path,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
    };
}
const models = pumpkinLanterns.map(({ name }) => {
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
        ...file(path),
        url: `https://vrt.gredice.com${gameAssetModels[name].url}`,
        triangles,
        meshCount: document.meshes.length,
        materialCount: document.materials.length,
    };
});
const release = {
    state: 'unpublished',
    snapshotDate: '2026-10-22T12:00:00+02:00',
    publicationIssue: 5000,
    sources: pumpkinLanterns.map(({ name }) =>
        file(`assets/game-assets/${name}.blend`),
    ),
    models,
    items: pumpkinLanterns.map((item) => {
        const name = item.name;
        return {
            ...item,
            catalogueId: null,
            cover: `https://www.gredice.com/assets/blocks/${name}.webp`,
            topDown: `https://vrt.gredice.com/assets/blocks/top-down/${name}.webp`,
            images: [
                'apps/www/public/assets/blocks',
                'apps/garden/public/assets/blocks/top-down',
            ].flatMap((directory) =>
                ['', '_1', '_2', '_3', '_4'].map((suffix) =>
                    file(`${directory}/${name}${suffix}.webp`),
                ),
            ),
        };
    }),
};
mkdirSync(new URL('docs/pumpkin-lanterns-2026/', root), {
    recursive: true,
});
writeFileSync(
    new URL('docs/pumpkin-lanterns-2026/release-manifest.json', root),
    `${JSON.stringify(release, null, 2)}\n`,
);
console.log(JSON.stringify(release.models));
