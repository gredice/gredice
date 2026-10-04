import { useGLTF } from '@react-three/drei';
import { BufferGeometry, Material, type Object3D, Texture } from 'three';
import { updateGameProfileMetadata } from '../gameProfileMetadata';
import { GameResourceCache } from './gameResourceCache';
import { registerResidentGardenMaterial } from './gardenMaterialOrigins';

/** Unreferenced GLTF bytes kept warm for quick returns to a recent garden. */
export const gameResourceIdleBudgetBytes = 24 * 1024 * 1024;
/** Covers a garden switch fade plus a quick back-and-forth. */
export const gameResourceGraceMs = 30_000;

let sharedCache: GameResourceCache<ReturnType<typeof setTimeout>> | null = null;

let publishQueued = false;

// A garden mount acquires hundreds of references in one commit; publish the
// profile snapshot once per task instead of once per reference.
function publishSnapshot() {
    if (publishQueued) return;
    publishQueued = true;
    queueMicrotask(() => {
        publishQueued = false;
        if (sharedCache) {
            updateGameProfileMetadata({
                sceneResourceCache: sharedCache.getSnapshot(),
            });
        }
    });
}

export function getGameResourceCache() {
    sharedCache ??= new GameResourceCache({
        budgetBytes: gameResourceIdleBudgetBytes,
        graceMs: gameResourceGraceMs,
        now: () => globalThis.performance.now(),
        setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
        clearTimeout: (handle) => clearTimeout(handle),
        onChange: publishSnapshot,
    });
    return sharedCache;
}

type GLTFLike = {
    scene?: Object3D;
};

function hasScene(value: unknown): value is GLTFLike & { scene: Object3D } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'scene' in value &&
        typeof value.scene === 'object' &&
        value.scene !== null &&
        'traverse' in value.scene
    );
}

function readNumber(value: unknown, key: string) {
    if (typeof value !== 'object' || value === null || !(key in value)) {
        return 0;
    }
    const property: unknown = Reflect.get(value, key);
    return typeof property === 'number' && Number.isFinite(property)
        ? property
        : 0;
}

function textureBytes(texture: Texture) {
    const image: unknown = texture.image;
    const pixels = readNumber(image, 'width') * readNumber(image, 'height');
    // RGBA8 upload plus a full mip chain when mipmaps are generated.
    return pixels * 4 * (texture.generateMipmaps ? 4 / 3 : 1);
}

function geometryBytes(geometry: BufferGeometry) {
    let bytes = geometry.index?.array.byteLength ?? 0;
    for (const attribute of Object.values(geometry.attributes)) {
        if ('array' in attribute) bytes += attribute.array.byteLength;
    }
    return bytes;
}

function collectMaterials(object: Object3D) {
    if (!('material' in object)) return [];
    const material: unknown = object.material;
    const materials = Array.isArray(material) ? material : [material];
    return materials.filter(
        (candidate): candidate is Material => candidate instanceof Material,
    );
}

export type GameGLTFResources = {
    geometries: Set<BufferGeometry>;
    materials: Set<Material>;
    textures: Set<Texture>;
    bytes: number;
};

/** Every GPU-backed resource reachable from a loaded GLTF scene graph. */
export function collectGameGLTFResources(gltf: unknown): GameGLTFResources {
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    const textures = new Set<Texture>();
    if (hasScene(gltf)) {
        gltf.scene.traverse((object) => {
            if (
                'geometry' in object &&
                object.geometry instanceof BufferGeometry
            ) {
                geometries.add(object.geometry);
            }
            for (const material of collectMaterials(object)) {
                materials.add(material);
            }
        });
    }
    for (const material of materials) {
        for (const value of Object.values(material)) {
            if (value instanceof Texture) textures.add(value);
        }
    }
    let bytes = 0;
    for (const geometry of geometries) bytes += geometryBytes(geometry);
    for (const texture of textures) bytes += textureBytes(texture);
    return { geometries, materials, textures, bytes };
}

export function disposeGameGLTFResources(resources: GameGLTFResources) {
    for (const geometry of resources.geometries) geometry.dispose();
    for (const texture of resources.textures) texture.dispose();
    for (const material of resources.materials) material.dispose();
}

const materialRegistrations = new Map<string, { release: () => void }>();

/** Registers a decoded GLTF so the cache can measure and later evict it. */
export function trackGameGLTF(url: string, gltf: unknown) {
    getGameResourceCache().track(url, 'gltf', gltf, () => {
        const resources = collectGameGLTFResources(gltf);
        const previous = materialRegistrations.get(url);
        const releases = [...resources.materials].map(
            registerResidentGardenMaterial,
        );
        // A decoded replacement may share originals with the previous value.
        previous?.release();
        const registration = {
            release: () => {
                for (const release of releases) release();
            },
        };
        materialRegistrations.set(url, registration);
        return {
            bytes: resources.bytes,
            dispose: () => {
                // Drop the loader cache entry first so the next consumer
                // decodes a fresh copy instead of reusing disposed objects.
                useGLTF.clear(url);
                registration.release();
                if (materialRegistrations.get(url) === registration)
                    materialRegistrations.delete(url);
                disposeGameGLTFResources(resources);
            },
        };
    });
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        'then' in value &&
        typeof value.then === 'function'
    );
}

// drei's GLTF reader is a plain suspense-cache lookup (no React hooks). It
// returns the cached value, throws the pending promise, or throws the error.
const readGLTFCache: (url: string) => unknown = useGLTF;

/**
 * Loads through the same suspense cache `useGameGLTF` reads, so a prefetch
 * and a mounted renderer share one fetch and one decoded GLTF.
 */
export async function loadGameGLTF(url: string) {
    for (;;) {
        try {
            const gltf = readGLTFCache(url);
            trackGameGLTF(url, gltf);
            return gltf;
        } catch (thrown) {
            if (!isPromiseLike(thrown)) throw thrown;
            await thrown;
        }
    }
}

export function isGameGLTFResident(url: string) {
    return getGameResourceCache().has(url);
}
