import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    DoubleSide,
    MeshBasicMaterial,
    MeshPhysicalMaterial,
    MeshStandardMaterial,
    Plane,
    Texture,
    Vector2,
    Vector4,
} from 'three';
import { applyGroundPatchMaterial } from '../entities/helpers/groundPatchMaterial';
import { retainCloudShadowAttenuationMaterial } from './cloudShadowAttenuation';
import {
    acquireSharedGardenMaterial,
    classifyGardenMaterial,
    getGardenMaterialSignature,
    readSharedGardenMaterialMetrics,
} from './gardenMaterials';

function standard(color = '#7a5a3a') {
    return new MeshStandardMaterial({ color, metalness: 0, roughness: 1 });
}

function cloudUniforms() {
    return {
        bounds: { value: new Vector4(0, 0, 1, 1) },
        hardness: { value: 0 },
        map: { value: null },
        projection: { value: new Vector2() },
        strength: { value: 0 },
    };
}

describe('garden material families', () => {
    it('batches opaque and cutout materials and keeps transparent ones apart', () => {
        assert.deepEqual(classifyGardenMaterial(standard()), {
            batchable: true,
            family: 'opaque',
        });
        assert.deepEqual(
            classifyGardenMaterial(
                new MeshStandardMaterial({ alphaTest: 0.5 }),
            ),
            { batchable: true, family: 'cutout' },
        );
        assert.deepEqual(
            classifyGardenMaterial(
                new MeshBasicMaterial({ opacity: 0.5, transparent: true }),
            ),
            { batchable: false, family: 'transparent', reason: 'transparent' },
        );
        assert.deepEqual(classifyGardenMaterial([standard()]), {
            batchable: false,
            reason: 'material-array',
        });
        assert.deepEqual(classifyGardenMaterial(undefined), {
            batchable: false,
            reason: 'missing-material',
        });
    });
});

describe('garden material signatures', () => {
    it('matches value-equal materials and separates any rendered difference', () => {
        const left = standard();
        const right = standard();
        right.name = 'Material.Dirt';
        assert.ok(getGardenMaterialSignature(left));
        assert.equal(
            getGardenMaterialSignature(left),
            getGardenMaterialSignature(right),
        );
        for (const change of [
            (material: MeshStandardMaterial) => material.color.set('#7a5a3b'),
            (material: MeshStandardMaterial) => {
                material.roughness = 0.99;
            },
            (material: MeshStandardMaterial) => {
                material.emissiveIntensity = 2;
            },
            (material: MeshStandardMaterial) => {
                material.side = DoubleSide;
            },
            (material: MeshStandardMaterial) => {
                material.map = new Texture();
            },
        ]) {
            const changed = standard();
            change(changed);
            assert.notEqual(
                getGardenMaterialSignature(changed),
                getGardenMaterialSignature(left),
            );
        }
        assert.notEqual(
            getGardenMaterialSignature(new MeshBasicMaterial()),
            getGardenMaterialSignature(new MeshStandardMaterial()),
        );
    });

    it('shares registered ground patches by configuration only', () => {
        const dirt = applyGroundPatchMaterial(standard(), 'dirt', {});
        const sameDirt = applyGroundPatchMaterial(standard(), 'dirt', {});
        const grass = applyGroundPatchMaterial(standard(), 'grass', {});
        const wet = applyGroundPatchMaterial(standard(), 'dirt', {
            wetPatches: [{ center: [1, 2], halfSize: [0.5, 0.5] }],
        });
        assert.ok(getGardenMaterialSignature(dirt));
        assert.equal(
            getGardenMaterialSignature(dirt),
            getGardenMaterialSignature(sameDirt),
        );
        assert.notEqual(
            getGardenMaterialSignature(dirt),
            getGardenMaterialSignature(grass),
        );
        assert.notEqual(
            getGardenMaterialSignature(dirt),
            getGardenMaterialSignature(wet),
        );
    });

    it('describes physical materials and rejects clipping planes', () => {
        assert.ok(getGardenMaterialSignature(new MeshPhysicalMaterial()));
        const clipped = standard();
        clipped.clippingPlanes = [new Plane()];
        assert.equal(getGardenMaterialSignature(clipped), undefined);
    });

    it('keeps unknown hooks and user data identity-only', () => {
        const hooked = standard();
        hooked.onBeforeCompile = () => {};
        assert.equal(getGardenMaterialSignature(hooked), undefined);
        const tagged = standard();
        tagged.userData.season = 'autumn';
        assert.equal(getGardenMaterialSignature(tagged), undefined);
    });

    it('ignores the scene cloud shadow decorator', () => {
        const plain = standard();
        const decorated = standard();
        const lease = retainCloudShadowAttenuationMaterial(
            decorated,
            cloudUniforms(),
        );
        assert.equal(
            getGardenMaterialSignature(decorated),
            getGardenMaterialSignature(plain),
        );
        lease.release();
    });
});

describe('shared garden materials', () => {
    it('resolves equal materials to one canonical instance until released', () => {
        const before = readSharedGardenMaterialMetrics();
        const first = standard('#123456');
        const second = standard('#123456');
        const firstLease = acquireSharedGardenMaterial(first);
        const secondLease = acquireSharedGardenMaterial(second);
        assert.equal(firstLease.material, first);
        assert.equal(secondLease.material, first);
        const during = readSharedGardenMaterialMetrics();
        assert.equal(during.canonicalMaterials, before.canonicalMaterials + 1);
        assert.equal(
            during.deduplicatedMaterialUsers,
            before.deduplicatedMaterialUsers + 1,
        );
        firstLease.release();
        firstLease.release();
        assert.equal(acquireSharedGardenMaterial(second).material, first);
        secondLease.release();
        const unique = standard('#654321');
        const uniqueLease = acquireSharedGardenMaterial(unique);
        assert.equal(uniqueLease.material, unique);
        uniqueLease.release();
    });

    it('starts a new canonical instance after every user releases', () => {
        const first = standard('#abcdef');
        const lease = acquireSharedGardenMaterial(first);
        lease.release();
        const second = standard('#abcdef');
        const next = acquireSharedGardenMaterial(second);
        assert.equal(next.material, second);
        next.release();
    });
});
