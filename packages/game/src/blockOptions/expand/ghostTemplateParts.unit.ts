import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    Bone,
    BoxGeometry,
    BufferGeometry,
    Group,
    InstancedBufferAttribute,
    InstancedMesh,
    type Material,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    Points,
    PointsMaterial,
    Skeleton,
    SkinnedMesh,
    Sprite,
    SpriteMaterial,
    Vector3,
} from 'three';
import { createGroundPatchMaterial } from '../../entities/helpers/groundPatchMaterial';
import {
    collectGhostTemplateParts,
    countGhostTemplateInstances,
    createGhostMaterial,
    createGhostMaterials,
    disposeGhostMaterials,
    expandGhostDepthRenderOrder,
    expandGhostOpacity,
    expandGhostRenderOrder,
    expandGroundGhostOpacity,
    type GhostTemplatePart,
    getExpandGhostOpacity,
    getExpandGhostStyle,
    getGhostPartMaterial,
    getGhostTemplateSignature,
    isFinalGhostTemplateCollection,
    maxGhostTemplateInstancesPerMesh,
} from './ghostTemplateParts';

function createTemplateRoot() {
    // The template sits somewhere in the scene and is hidden; collection is
    // relative to it.
    const root = new Group();
    root.visible = false;
    root.position.set(5, 2, -3);
    root.rotation.y = Math.PI / 2;
    const scene = new Group();
    scene.add(root);
    return root;
}

function getParts(root: Group): GhostTemplatePart[] {
    const result = collectGhostTemplateParts(root);
    assert.equal(result.kind, 'parts');
    return result.kind === 'parts' ? result.parts : [];
}

function assertMatrixPosition(
    matrix: Matrix4 | undefined,
    expected: [number, number, number],
) {
    assert.ok(matrix);
    const position = new Vector3().setFromMatrixPosition(matrix);
    assert.ok(
        position.distanceTo(new Vector3(...expected)) < 1e-9,
        `expected ${expected.join(',')}, got ${position.toArray().join(',')}`,
    );
}

function trackDispose(material: Material) {
    let disposed = false;
    material.addEventListener('dispose', () => {
        disposed = true;
    });
    return () => disposed;
}

describe('collectGhostTemplateParts', () => {
    it('records each mesh relative to the template root', () => {
        const root = createTemplateRoot();
        const geometry = new BoxGeometry();
        const material = new MeshStandardMaterial();
        const lifted = new Group();
        lifted.position.set(0, 0.2, 0);
        lifted.rotation.y = Math.PI / 2;
        const mesh = new Mesh(geometry, material);
        mesh.position.set(1, 0, 0);
        lifted.add(mesh);
        root.add(lifted);

        const [part, ...rest] = getParts(root);
        assert.equal(rest.length, 0);
        assert.ok(part);
        assert.equal(part.geometry, geometry);
        assert.equal(part.material, material);
        assert.equal(part.localMatrices.length, 1);
        // The group turns the mesh's +x offset onto −z; the root's own
        // position and turn are not part of the local matrix.
        assertMatrixPosition(part.localMatrices[0], [0, 0.2, -1]);
    });

    it('merges meshes that share a geometry and material into one part', () => {
        const root = createTemplateRoot();
        const geometry = new BoxGeometry();
        const material = new MeshStandardMaterial();
        const other = new MeshStandardMaterial();
        const left = new Mesh(geometry, material);
        left.position.set(-0.25, 0, 0);
        const right = new Mesh(geometry, material);
        right.position.set(0.25, 0, 0);
        root.add(left, right, new Mesh(geometry, other));

        const parts = getParts(root);
        assert.equal(parts.length, 2);
        const shared = parts.find((part) => part.material === material);
        assert.equal(shared?.localMatrices.length, 2);
        assertMatrixPosition(shared?.localMatrices[0], [-0.25, 0, 0]);
        assertMatrixPosition(shared?.localMatrices[1], [0.25, 0, 0]);
    });

    it('copies the instances of a small instanced mesh (terrain rim pieces)', () => {
        const root = createTemplateRoot();
        const rim = new InstancedMesh(
            new BoxGeometry(),
            new MeshStandardMaterial(),
            8,
        );
        rim.count = 3;
        rim.position.set(0, 0.4, 0);
        for (let index = 0; index < 3; index++) {
            rim.setMatrixAt(
                index,
                new Matrix4().makeTranslation(index * 0.5, 0, 0),
            );
        }
        root.add(rim);

        const [part] = getParts(root);
        assert.equal(part?.localMatrices.length, 3);
        assertMatrixPosition(part?.localMatrices[0], [0, 0.4, 0]);
        assertMatrixPosition(part?.localMatrices[2], [1, 0.4, 0]);
    });

    it('skips instanced batches too large to belong to one block', () => {
        const root = createTemplateRoot();
        const field = new InstancedMesh(
            new BoxGeometry(),
            new MeshStandardMaterial(),
            maxGhostTemplateInstancesPerMesh + 1,
        );
        const body = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
        root.add(field, body);

        const parts = getParts(root);
        assert.equal(parts.length, 1);
        assert.equal(parts[0]?.geometry, body.geometry);
    });

    it('lifts the instance cap for a template drawn once (the Expand rim)', () => {
        const root = createTemplateRoot();
        const count = maxGhostTemplateInstancesPerMesh + 36;
        const rim = new InstancedMesh(
            new BoxGeometry(),
            new MeshStandardMaterial(),
            count,
        );
        root.add(rim);

        const result = collectGhostTemplateParts(root, {
            maxInstancesPerMesh: Number.POSITIVE_INFINITY,
        });
        assert.equal(result.kind, 'parts');
        assert.equal(countGhostTemplateInstances(result), count);
        assert.equal(countGhostTemplateInstances(null), 0);
        assert.equal(
            countGhostTemplateInstances({
                kind: 'fallback',
                reason: 'no-mesh',
            }),
            0,
        );
    });

    it('skips geometries that carry per-instance attributes', () => {
        const root = createTemplateRoot();
        const tinted = new BoxGeometry();
        tinted.setAttribute(
            'instanceTint',
            new InstancedBufferAttribute(new Float32Array(3), 3),
        );
        const body = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
        root.add(new Mesh(tinted, new MeshStandardMaterial()), body);

        const parts = getParts(root);
        assert.equal(parts.length, 1);
        assert.equal(parts[0]?.geometry, body.geometry);
    });

    it('skips sprites, points, overlays, billboards and shadows without falling back', () => {
        const root = createTemplateRoot();
        const body = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
        const snow = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
        snow.name = 'SnowOverlay';
        const billboard = new Group();
        billboard.name =
            'SpriteAtlasBillboard:/assets/sprites/ground:flower-1:billboard';
        billboard.add(new Mesh(new BufferGeometry(), new MeshBasicMaterial()));
        const decoration = new Mesh(
            new BufferGeometry(),
            new MeshBasicMaterial(),
        );
        decoration.name = 'Grass:decoration:billboard';
        const shadow = new Mesh(new BufferGeometry(), new MeshBasicMaterial());
        shadow.name = 'StaticContactShadows';
        const debug = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
        debug.name = 'Debug:EntityRenderMode:component:Bush:1';
        root.add(
            body,
            snow,
            billboard,
            decoration,
            shadow,
            debug,
            new Sprite(new SpriteMaterial()),
            new Points(new BufferGeometry(), new PointsMaterial()),
        );

        const parts = getParts(root);
        assert.equal(parts.length, 1);
        assert.equal(parts[0]?.geometry, body.geometry);
    });

    it('skips hidden objects and invisible materials', () => {
        const root = createTemplateRoot();
        const hiddenGroup = new Group();
        hiddenGroup.visible = false;
        hiddenGroup.add(
            new Mesh(new BoxGeometry(), new MeshStandardMaterial()),
        );
        const invisible = new MeshBasicMaterial();
        invisible.visible = false;
        const body = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
        root.add(hiddenGroup, new Mesh(new BoxGeometry(), invisible), body);

        const parts = getParts(root);
        assert.equal(parts.length, 1);
        assert.equal(parts[0]?.geometry, body.geometry);
    });

    it('falls back for a skinned template', () => {
        const root = createTemplateRoot();
        const bone = new Bone();
        const skinned = new SkinnedMesh(
            new BoxGeometry(),
            new MeshStandardMaterial(),
        );
        skinned.add(bone);
        skinned.bind(new Skeleton([bone]));
        root.add(
            new Mesh(new BoxGeometry(), new MeshStandardMaterial()),
            skinned,
        );

        assert.deepEqual(collectGhostTemplateParts(root), {
            kind: 'fallback',
            reason: 'skinned-mesh',
        });
    });

    it('falls back when nothing drawable is left', () => {
        const empty = createTemplateRoot();
        assert.deepEqual(collectGhostTemplateParts(empty), {
            kind: 'fallback',
            reason: 'no-mesh',
        });

        const decorationsOnly = createTemplateRoot();
        const snow = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
        snow.name = 'SnowOverlay';
        decorationsOnly.add(snow, new Sprite(new SpriteMaterial()));
        assert.deepEqual(collectGhostTemplateParts(decorationsOnly), {
            kind: 'fallback',
            reason: 'no-mesh',
        });
    });
});

describe('isFinalGhostTemplateCollection', () => {
    it('freezes drawn parts and a skinned rig, never an empty template', () => {
        const drawn = createTemplateRoot();
        drawn.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
        assert.equal(
            isFinalGhostTemplateCollection(collectGhostTemplateParts(drawn)),
            true,
        );
        assert.equal(
            isFinalGhostTemplateCollection({
                kind: 'fallback',
                reason: 'skinned-mesh',
            }),
            true,
        );
        // Nothing drawn yet: an inner boundary may still be loading.
        assert.equal(
            isFinalGhostTemplateCollection(
                collectGhostTemplateParts(createTemplateRoot()),
            ),
            false,
        );
        assert.equal(isFinalGhostTemplateCollection(null), false);
    });
});

describe('getExpandGhostStyle', () => {
    it('draws ground, paving and water as one solid, everything else see-through', () => {
        for (const name of [
            'Block_Grass',
            'Block_Sand',
            'Block_Stone_Stairs',
            'Block_Water',
        ]) {
            assert.equal(getExpandGhostStyle(name), 'ground', name);
        }
        for (const name of ['Bush', 'Tulip', 'BeachBall', 'Tree']) {
            assert.equal(getExpandGhostStyle(name), 'prop', name);
        }
        // Props keep the pack layout preview's opacity; a ground ghost
        // shades one layer, so it is stronger.
        assert.equal(getExpandGhostOpacity('prop'), expandGhostOpacity);
        assert.equal(expandGhostOpacity, 0.35);
        assert.ok(getExpandGhostOpacity('ground') > expandGhostOpacity);
    });
});

describe('ghost materials', () => {
    it('makes a see-through clone and leaves the source alone', () => {
        const source = new MeshStandardMaterial({ color: '#4ade80' });
        const ghost = createGhostMaterial(source);

        assert.notEqual(ghost, source);
        assert.equal(ghost.transparent, true);
        assert.equal(ghost.opacity, expandGhostOpacity);
        assert.equal(ghost.depthWrite, false);
        assert.equal(ghost.colorWrite, true);
        assert.equal(source.transparent, false);
        assert.equal(source.opacity, 1);
        assert.equal(source.depthWrite, true);
    });

    it('makes a depth-only twin for the first pass of a ground ghost', () => {
        const source = new MeshStandardMaterial({ color: '#4ade80' });
        const options = {
            opacity: getExpandGhostOpacity('ground'),
            pass: 'depth',
        } as const;
        const depth = createGhostMaterial(source, options);
        const color = createGhostMaterial(source, {
            opacity: getExpandGhostOpacity('ground'),
        });

        assert.equal(depth.colorWrite, false);
        assert.equal(depth.depthWrite, true);
        assert.equal(color.colorWrite, true);
        assert.equal(color.depthWrite, false);
        // Same opacity as the colour pass: both discard the same fragments.
        assert.equal(depth.transparent, true);
        assert.equal(depth.opacity, expandGroundGhostOpacity);
        assert.equal(color.opacity, expandGroundGhostOpacity);
        // It runs before the colour pass, after the garden's own see-through
        // surfaces and before the cell plates.
        assert.ok(expandGhostDepthRenderOrder > 0);
        assert.ok(expandGhostDepthRenderOrder < expandGhostRenderOrder);
        assert.ok(expandGhostRenderOrder < 1);

        const parts: GhostTemplatePart[] = [
            {
                geometry: new BoxGeometry(),
                material: source,
                localMatrices: [new Matrix4()],
            },
        ];
        const depthSet = createGhostMaterials(parts, undefined, options);
        assert.equal(depthSet.get(source.uuid)?.colorWrite, false);
        assert.equal(
            createGhostMaterials(parts).get(source.uuid)?.colorWrite,
            true,
        );
    });

    it('keeps the registered ground patch shader and drops unregistered hooks', () => {
        const patched = createGroundPatchMaterial(
            new MeshStandardMaterial(),
            'grass',
            {},
        );
        assert.notEqual(
            patched.onBeforeCompile,
            MeshStandardMaterial.prototype.onBeforeCompile,
        );
        const patchedGhost = createGhostMaterial(patched);
        assert.equal(patchedGhost.onBeforeCompile, patched.onBeforeCompile);
        // The depth pass compiles the same program as the colour pass.
        const patchedDepth = createGhostMaterial(patched, { pass: 'depth' });
        assert.equal(patchedDepth.onBeforeCompile, patched.onBeforeCompile);
        assert.equal(
            patchedDepth.customProgramCacheKey(),
            patchedGhost.customProgramCacheKey(),
        );
        assert.equal(
            patchedGhost.customProgramCacheKey(),
            patched.customProgramCacheKey(),
        );

        const wobble = new MeshStandardMaterial();
        wobble.onBeforeCompile = () => {};
        const wobbleGhost = createGhostMaterial(wobble);
        assert.equal(
            wobbleGhost.onBeforeCompile,
            MeshStandardMaterial.prototype.onBeforeCompile,
        );
    });

    it('clones each source material once and resolves material arrays', () => {
        const shared = new MeshStandardMaterial();
        const second = new MeshStandardMaterial();
        const geometry = new BoxGeometry();
        const parts: GhostTemplatePart[] = [
            { geometry, material: shared, localMatrices: [new Matrix4()] },
            {
                geometry: new BoxGeometry(),
                material: shared,
                localMatrices: [new Matrix4()],
            },
            {
                geometry,
                material: [shared, second],
                localMatrices: [new Matrix4()],
            },
        ];

        const materials = createGhostMaterials(parts);
        assert.equal(materials.size, 2);
        const [first, , multi] = parts;
        assert.ok(first && multi);
        const ghost = getGhostPartMaterial(first, materials);
        assert.equal(ghost, materials.get(shared.uuid));
        assert.deepEqual(getGhostPartMaterial(multi, materials), [
            materials.get(shared.uuid),
            materials.get(second.uuid),
        ]);
        assert.equal(getGhostPartMaterial(first, new Map()), null);
    });

    it('reuses clones across collections and disposes only clones', () => {
        const kept = new MeshStandardMaterial();
        const dropped = new MeshStandardMaterial();
        const geometry = new BoxGeometry();
        const keptSourceDisposed = trackDispose(kept);
        const droppedSourceDisposed = trackDispose(dropped);
        const before = createGhostMaterials([
            { geometry, material: kept, localMatrices: [new Matrix4()] },
            { geometry, material: dropped, localMatrices: [new Matrix4()] },
        ]);
        const keptGhost = before.get(kept.uuid);
        const droppedGhost = before.get(dropped.uuid);
        assert.ok(keptGhost && droppedGhost);
        const keptGhostDisposed = trackDispose(keptGhost);
        const droppedGhostDisposed = trackDispose(droppedGhost);

        // A new collection without `dropped` keeps the clone of `kept`.
        const after = createGhostMaterials(
            [{ geometry, material: kept, localMatrices: [new Matrix4()] }],
            before,
        );
        assert.equal(after.get(kept.uuid), keptGhost);
        disposeGhostMaterials(before, after);
        assert.equal(droppedGhostDisposed(), true);
        assert.equal(keptGhostDisposed(), false);

        disposeGhostMaterials(after);
        assert.equal(keptGhostDisposed(), true);
        assert.equal(keptSourceDisposed(), false);
        assert.equal(droppedSourceDisposed(), false);
    });
});

describe('getGhostTemplateSignature', () => {
    it('changes when a part is added, swapped or hidden, not when it moves', () => {
        const root = createTemplateRoot();
        const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
        root.add(mesh);
        const initial = getGhostTemplateSignature(root);
        assert.equal(getGhostTemplateSignature(root), initial);

        mesh.position.set(0.3, 0.2, 0);
        assert.equal(getGhostTemplateSignature(root), initial);

        mesh.material = new MeshStandardMaterial();
        const swapped = getGhostTemplateSignature(root);
        assert.notEqual(swapped, initial);

        const rim = new InstancedMesh(
            new BoxGeometry(),
            new MeshStandardMaterial(),
            4,
        );
        root.add(rim);
        const added = getGhostTemplateSignature(root);
        assert.notEqual(added, swapped);

        rim.count = 2;
        const recounted = getGhostTemplateSignature(root);
        assert.notEqual(recounted, added);

        mesh.visible = false;
        assert.notEqual(getGhostTemplateSignature(root), recounted);
    });
});
