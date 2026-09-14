import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import {
    gardenStructureKitV1SemanticGeometryIds,
    getGardenStructureKitV1BatchGeometryId,
    resolveGardenStructureKitV1Asset,
} from './gardenStructureKitV1AssetResolver';
import { gardenStructureKitV1AssetManifest } from './gardenStructureKitV1Manifest';

const manifest = gardenStructureKitV1AssetManifest;
const manifestParts = [
    ...Object.entries(manifest.floorParts),
    ...Object.entries(manifest.edgeParts),
    ...Object.entries(manifest.roofStyles),
    ...Object.entries(manifest.propParts),
];

function createManifestScene() {
    const root = new Group();
    root.name = 'GardenStructureKitV1Fixture';
    const geometry = new BoxGeometry(1, 1, 1);
    const materials = new Map<string, MeshStandardMaterial>();
    const getMaterial = (name: string) => {
        const existing = materials.get(name);
        if (existing) {
            return existing;
        }
        const material = new MeshStandardMaterial();
        material.name = name;
        materials.set(name, material);
        return material;
    };

    for (const [, part] of manifestParts) {
        for (const binding of part.nodes) {
            const node = new Group();
            node.name = binding.nodeName;
            for (const [
                index,
                materialName,
            ] of binding.nodeMaterialNames.entries()) {
                const mesh = new Mesh(geometry, getMaterial(materialName));
                mesh.name = `${binding.nodeName}_Mesh${index === 0 ? '' : `_${index.toString()}`}`;
                node.add(mesh);
            }
            root.add(node);
        }
    }

    return root;
}

describe('GardenStructureKitV1 asset resolution', () => {
    test('resolves every semantic geometry to all named GLB material primitives', () => {
        const resolution = resolveGardenStructureKitV1Asset(
            createManifestScene(),
        );

        assert.deepEqual(resolution.issues, []);
        assert.deepEqual(
            [...resolution.geometries.keys()],
            gardenStructureKitV1SemanticGeometryIds,
        );
        assert.equal(resolution.geometries.size, 19);
        assert.equal(
            [...resolution.geometries.values()].reduce(
                (total, geometry) => total + geometry.primitives.length,
                0,
            ),
            56,
        );
        assert.ok(
            [...resolution.geometries.values()].every(
                ({ status }) => status === 'resolved',
            ),
        );

        const greenhouseWall = resolution.geometries.get(
            'wall.greenhouse-panel',
        );
        assert.ok(greenhouseWall);
        assert.deepEqual(
            greenhouseWall.primitives.map(({ transparency }) => transparency),
            ['opaque', 'transparent'],
        );
        assert.deepEqual(
            greenhouseWall.primitives.map(
                ({ sourceNodeName }) => sourceNodeName,
            ),
            [
                'GardenStructureKitV1_WallGreenhouseFrame',
                'GardenStructureKitV1_WallGreenhouseGlass',
            ],
        );
        assert.equal(
            resolution.geometries.get('wall.timber')?.primitives.length,
            4,
        );
        assert.equal(
            resolution.geometries.get('floor.timber')?.primitives.length,
            2,
        );
    });

    test('keeps source-node local transforms without mutating source geometry', () => {
        const scene = createManifestScene();
        const tableNode = scene.getObjectByName(
            'GardenStructureKitV1_PropTable',
        );
        assert.ok(tableNode);
        const firstMesh = tableNode.children[0];
        assert.ok(firstMesh instanceof Mesh);
        firstMesh.position.set(0.1, 0.2, 0.3);
        const sourcePosition = firstMesh.position.clone();

        const resolution = resolveGardenStructureKitV1Asset(scene);
        const table = resolution.geometries.get('prop.table');
        assert.ok(table);
        const resolvedPosition = new Vector3().setFromMatrixPosition(
            table.primitives[0]?.sourceMatrix ?? new Group().matrix,
        );

        assert.deepEqual(resolvedPosition.toArray(), [0.1, 0.2, 0.3]);
        assert.deepEqual(
            firstMesh.position.toArray(),
            sourcePosition.toArray(),
        );
        assert.equal(table.primitives[0]?.geometry, firstMesh.geometry);
        assert.equal(table.primitives[0]?.material, firstMesh.material);
    });

    test('fails one semantic geometry closed when a named node is missing', () => {
        const scene = createManifestScene();
        scene
            .getObjectByName('GardenStructureKitV1_WallGreenhouseGlass')
            ?.removeFromParent();

        const resolution = resolveGardenStructureKitV1Asset(scene);
        const greenhouseWall = resolution.geometries.get(
            'wall.greenhouse-panel',
        );

        assert.equal(greenhouseWall?.status, 'missing');
        assert.deepEqual(greenhouseWall?.primitives, []);
        assert.deepEqual(greenhouseWall?.issues, [
            {
                code: 'missing-node',
                geometryId: 'wall.greenhouse-panel',
                message:
                    'Missing GLB node GardenStructureKitV1_WallGreenhouseGlass.',
                nodeName: 'GardenStructureKitV1_WallGreenhouseGlass',
            },
        ]);
        assert.equal(
            resolution.geometries.get('wall.plaster')?.status,
            'resolved',
        );
    });

    test('maps floor batches by material while other batches use geometry IDs', () => {
        assert.equal(
            getGardenStructureKitV1BatchGeometryId({
                geometryId: 'floor-cell',
                geometryKind: 'floor-cell',
                materialId: 'floor.timber',
            }),
            'floor.timber',
        );
        assert.equal(
            getGardenStructureKitV1BatchGeometryId({
                geometryId: 'prop.crate',
                geometryKind: 'prop',
                materialId: 'prop.crate',
            }),
            'prop.crate',
        );
    });
});
