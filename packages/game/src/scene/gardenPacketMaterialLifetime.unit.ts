import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MeshStandardMaterial, Scene, Texture } from 'three';
import { applyGroundPatchMaterial } from '../entities/helpers/groundPatchMaterial';
import { readSharedGardenMaterialMetrics } from './gardenMaterials';
import {
    acquireGardenPacketMaterialRoot,
    readGardenPacketMaterialLifetime,
} from './gardenPacketMaterialLifetime';
import { acquireGardenPacketMaterial } from './gardenPacketMaterials';
import {
    inheritGardenMaterialOrigin,
    registerResidentGardenMaterial,
} from './resources/gardenMaterialOrigins';
import { createIntegratedWeatherSurfaceMaterial } from './weatherSurfaceMaterial';

function acquire(source: MeshStandardMaterial, root: Scene) {
    const lease = acquireGardenPacketMaterial(source, root);
    assert.ok(lease);
    return lease;
}
function decorated(original: MeshStandardMaterial, color: string) {
    const source = original.clone();
    source.color.set(color);
    applyGroundPatchMaterial(source, 'raisedBedSoil', {
        wetStrength: color === '#112233' ? 0.4 : 0.8,
    });
    inheritGardenMaterialOrigin(source, original);
    return source;
}

describe('bounded resident stock material lifetime', () => {
    it('keeps one exact compatible clone across replacement and releases it once on root teardown, borrowing inputs', () => {
        const before = readSharedGardenMaterialMetrics();
        const root = new Scene();
        const source = new MeshStandardMaterial({ map: new Texture() });
        const releaseResident = registerResidentGardenMaterial(source);
        const releaseRoot = acquireGardenPacketMaterialRoot(root);
        let sourceDisposals = 0,
            textureDisposals = 0,
            cloneDisposals = 0;
        source.addEventListener('dispose', () => sourceDisposals++);
        source.map?.addEventListener('dispose', () => textureDisposals++);
        const first = acquire(source, root);
        first.material.addEventListener('dispose', () => cloneDisposals++);
        for (let i = 0; i < 20; i++) {
            const current = acquire(source, root);
            assert.equal(current.material, first.material);
            current.release();
        }
        first.release();
        assert.equal(cloneDisposals, 0);
        assert.deepEqual(readGardenPacketMaterialLifetime(root), {
            idleOrigins: 1,
            activeSignatures: 0,
        });
        const returned = acquire(source, root);
        assert.equal(returned.material, first.material);
        returned.release();
        releaseRoot();
        releaseRoot();
        releaseResident();
        assert.equal(cloneDisposals, 1);
        assert.equal(sourceDisposals, 0);
        assert.equal(textureDisposals, 0);
        assert.deepEqual(readSharedGardenMaterialMetrics(), before);
    });
    it('selects the newest configuration instead of the last cleanup, and never retains visited history', () => {
        const root = new Scene(),
            original = new MeshStandardMaterial();
        const releaseRoot = acquireGardenPacketMaterialRoot(root);
        const releaseResident = registerResidentGardenMaterial(original);
        const oldSource = decorated(original, '#112233'),
            newSource = decorated(original, '#445566');
        const old = acquire(oldSource, root),
            latest = acquire(newSource, root);
        let oldDisposals = 0,
            latestDisposals = 0;
        old.material.addEventListener('dispose', () => oldDisposals++);
        latest.material.addEventListener('dispose', () => latestDisposals++);
        latest.release();
        old.release();
        assert.equal(oldDisposals, 1);
        assert.equal(latestDisposals, 0);
        assert.deepEqual(readGardenPacketMaterialLifetime(root), {
            idleOrigins: 1,
            activeSignatures: 0,
        });
        const returned = acquire(newSource, root);
        assert.equal(returned.material, latest.material);
        returned.release();
        releaseRoot();
        releaseResident();
    });
    it('bounds incompatible visits to one idle slot and isolates equal signatures from two origins', () => {
        const root = new Scene(),
            a = new MeshStandardMaterial(),
            b = a.clone();
        const releaseRoot = acquireGardenPacketMaterialRoot(root);
        const residentA = registerResidentGardenMaterial(a),
            residentB = registerResidentGardenMaterial(b);
        const initial = acquire(a, root),
            equal = acquire(b, root);
        assert.equal(initial.material, equal.material);
        initial.release();
        equal.release();
        assert.equal(readGardenPacketMaterialLifetime(root).idleOrigins, 2);
        residentA();
        assert.equal(readGardenPacketMaterialLifetime(root).idleOrigins, 1);
        for (let i = 0; i < 25; i++) {
            const changed = decorated(b, i % 2 ? '#112233' : '#445566');
            const lease = acquire(changed, root);
            lease.release();
            assert.deepEqual(readGardenPacketMaterialLifetime(root), {
                idleOrigins: 1,
                activeSignatures: 0,
            });
        }
        residentB();
        releaseRoot();
    });
    it('invalidates original disposal and uncommitted residency without reviving disposed inputs', () => {
        const root = new Scene(),
            original = new MeshStandardMaterial();
        const releaseRoot = acquireGardenPacketMaterialRoot(root);
        const untracked = acquire(original, root);
        let untrackedDisposals = 0;
        untracked.material.addEventListener(
            'dispose',
            () => untrackedDisposals++,
        );
        untracked.release();
        assert.equal(untrackedDisposals, 1);
        // Passive registration may follow the child's layout acquisition.
        const trackedLater = acquire(original, root);
        const releaseResident = registerResidentGardenMaterial(original);
        let disposals = 0;
        trackedLater.material.addEventListener('dispose', () => disposals++);
        trackedLater.release();
        assert.equal(disposals, 0);
        original.dispose();
        assert.equal(disposals, 1);
        assert.equal(readGardenPacketMaterialLifetime(root).idleOrigins, 0);
        registerResidentGardenMaterial(original)();
        acquire(original, root).release();
        assert.equal(readGardenPacketMaterialLifetime(root).idleOrigins, 0);
        releaseResident();
        releaseRoot();
    });
    it('closes exact generations before child cleanup and keeps a replayed root independent', () => {
        const rootA = new Scene(),
            rootB = new Scene(),
            source = new MeshStandardMaterial();
        const resident = registerResidentGardenMaterial(source);
        const closeA = acquireGardenPacketMaterialRoot(rootA),
            closeB = acquireGardenPacketMaterialRoot(rootB);
        const old = acquire(source, rootA),
            other = acquire(source, rootB);
        closeA();
        const closeReplay = acquireGardenPacketMaterialRoot(rootA),
            replay = acquire(source, rootA);
        assert.notEqual(old.material, replay.material);
        assert.notEqual(other.material, replay.material);
        old.release();
        old.release();
        other.release();
        replay.release();
        assert.equal(readGardenPacketMaterialLifetime(rootA).idleOrigins, 1);
        assert.equal(readGardenPacketMaterialLifetime(rootB).idleOrigins, 1);
        closeB();
        assert.equal(readGardenPacketMaterialLifetime(rootA).idleOrigins, 1);
        closeReplay();
        resident();
    });
    it('does not pin direct callers, transparent, unknown hooks or mutable integrated weather materials', () => {
        const root = new Scene(),
            source = new MeshStandardMaterial();
        const resident = registerResidentGardenMaterial(source);
        const lease = acquire(source, root);
        let disposals = 0;
        lease.material.addEventListener('dispose', () => disposals++);
        lease.release();
        assert.equal(disposals, 1);
        assert.equal(readGardenPacketMaterialLifetime(root).idleOrigins, 0);
        const transparent = new MeshStandardMaterial({ transparent: true });
        assert.equal(acquireGardenPacketMaterial(transparent, root), undefined);
        const wetness = { value: 0.8 };
        const weather = createIntegratedWeatherSurfaceMaterial(source, {
            frostIntensityUniform: { value: 0.4 },
            rain: {
                enabled: true,
                bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
                darkness: 1,
                glossiness: 0.7,
                puddleStrengthUniform: { value: 0.3 },
                topSurfaceBias: 1.8,
                wetnessUniform: wetness,
            },
            snow: {
                enabled: false,
                amountUniform: { value: 0 },
                color: '#f7f7ff',
                lift: 0.003,
                maxThickness: 0.18,
                noiseAmplitude: 0.35,
                noiseInfluence: 0.15,
                noiseScale: 2.5,
                slopeExponent: 2.4,
            },
        });
        const close = acquireGardenPacketMaterialRoot(root);
        const weatherLease = acquire(weather, root);
        let weatherDisposals = 0;
        weatherLease.material.addEventListener(
            'dispose',
            () => weatherDisposals++,
        );
        wetness.value = 0.2;
        weatherLease.release();
        assert.equal(weatherDisposals, 1);
        const afterWeather = decorated(weather, '#112233');
        assert.equal(
            acquireGardenPacketMaterial(afterWeather, root),
            undefined,
        );
        assert.equal(readGardenPacketMaterialLifetime(root).idleOrigins, 0);
        close();
        weather.dispose();
        source.onBeforeCompile = () => {};
        assert.equal(acquireGardenPacketMaterial(source, root), undefined);
        resident();
    });
});
