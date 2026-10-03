import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fallenLog } from '@gredice/js/fallenLog';
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
const name = fallenLog.name;
const path = `apps/garden/public/assets/models/${name}.glb`;
const bytes = readFileSync(new URL(path, root));
const document: {
    meshes: { name: string; primitives: { indices: number }[] }[];
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
const release = {
    state: 'unpublished',
    publicationIssue: 5000,
    snapshotDate: '2026-10-22T12:00:00+02:00',
    source: file(`assets/game-assets/${name}.blend`),
    models: [
        {
            name,
            ...file(path),
            url: `https://vrt.gredice.com${gameAssetModels.FallenLog.url}`,
            triangles,
            trianglesByMesh: Object.fromEntries(
                document.meshes.map((mesh) => [
                    mesh.name,
                    mesh.primitives.reduce(
                        (sum, primitive) =>
                            sum +
                            document.accessors[primitive.indices].count / 3,
                        0,
                    ),
                ]),
            ),
            meshCount: document.meshes.length,
            materialCount: document.materials.length,
        },
    ],
    items: [
        {
            ...fallenLog,
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
        },
    ],
};
mkdirSync(new URL('docs/fallen-log-2026/', root), { recursive: true });
writeFileSync(
    new URL('docs/fallen-log-2026/release-manifest.json', root),
    `${JSON.stringify(release, null, 2)}\n`,
);
console.log(JSON.stringify(release.models));
