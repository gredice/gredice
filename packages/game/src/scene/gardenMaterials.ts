import { useLayoutEffect, useMemo, useState } from 'react';
import { Material } from 'three';
import { getMaterialShaderHooksWithoutCloudShadowAttenuation } from './cloudShadowAttenuation';
import { updateGameProfileMetadata } from './gameProfileMetadata';

/**
 * Garden material families that static render packets understand. Opaque and
 * cutout materials do not depend on draw order, so compatible geometry can be
 * concatenated into one submission without changing the rendered result.
 * Transparent materials depend on per-object sorting and stay on their
 * existing per-component path until parity is demonstrated.
 */
export type GardenMaterialFamily = 'cutout' | 'opaque' | 'transparent';

export type GardenMaterialClassification =
    | { batchable: true; family: 'cutout' | 'opaque' }
    | {
          batchable: false;
          family?: GardenMaterialFamily;
          reason: GardenMaterialFallbackReason;
      };

export type GardenMaterialFallbackReason =
    | 'material-array'
    | 'missing-material'
    | 'transparent';

export function classifyGardenMaterial(
    material: Material | Material[] | undefined,
): GardenMaterialClassification {
    if (Array.isArray(material)) {
        return { batchable: false, reason: 'material-array' };
    }
    if (!material) {
        return { batchable: false, reason: 'missing-material' };
    }
    if (material.transparent) {
        return {
            batchable: false,
            family: 'transparent',
            reason: 'transparent',
        };
    }
    return {
        batchable: true,
        family: material.alphaTest > 0 ? 'cutout' : 'opaque',
    };
}

const defaultShaderHookSignature = 'default';
const shaderHookSignatures = new WeakMap<
    Material['onBeforeCompile'],
    {
        customProgramCacheKey: Material['customProgramCacheKey'];
        signature: string;
        userDataSignature?: string;
    }
>();

/**
 * Shader decorators that are pure functions of their configuration register
 * that configuration here so equal decorated materials can share one
 * instance. Unregistered hooks keep a material identity-only.
 */
export function registerGardenMaterialShaderHooks(
    hooks: Pick<Material, 'customProgramCacheKey' | 'onBeforeCompile'>,
    signature: string,
    userData?: Material['userData'],
) {
    shaderHookSignatures.set(hooks.onBeforeCompile, {
        customProgramCacheKey: hooks.customProgramCacheKey,
        signature,
        userDataSignature: userData
            ? serializeMaterialValue(userData)
            : undefined,
    });
}

function getShaderHookSignature(
    hooks: Pick<Material, 'customProgramCacheKey' | 'onBeforeCompile'>,
) {
    if (
        hooks.onBeforeCompile === Material.prototype.onBeforeCompile &&
        hooks.customProgramCacheKey === Material.prototype.customProgramCacheKey
    ) {
        return defaultShaderHookSignature;
    }
    const registered = shaderHookSignatures.get(hooks.onBeforeCompile);
    return registered?.customProgramCacheKey === hooks.customProgramCacheKey
        ? registered.signature
        : undefined;
}

/**
 * Signature of the hooks a material was authored with. The scene-owned cloud
 * shadow decorator is excluded because the cloud layer applies it to
 * whichever shared instance is rendered.
 */
export function getGardenMaterialShaderHookSignature(material: Material) {
    return getShaderHookSignature(
        getMaterialShaderHooksWithoutCloudShadowAttenuation(material),
    );
}

/**
 * Signature of the hooks currently installed on a material, including any
 * scene decorator. Use this before composing a new hook around them.
 */
export function getGardenMaterialInstalledShaderHookSignature(
    material: Material,
) {
    return getShaderHookSignature(material);
}

const ignoredMaterialKeys = new Set([
    '_listeners',
    'id',
    'name',
    'userData',
    'uuid',
    'version',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function serializeMaterialValue(value: unknown): string | undefined {
    if (value === null) return 'null';
    switch (typeof value) {
        case 'boolean':
        case 'number':
        case 'string':
            return `${(typeof value)[0]}${String(value)}`;
        case 'undefined':
            return 'u';
        case 'function':
            return undefined;
    }
    if (!isRecord(value)) return undefined;
    if (value.isTexture === true) return `t${String(value.uuid)}`;
    if (value.isColor === true)
        return `c${String(value.r)},${String(value.g)},${String(value.b)}`;
    if (value.isVector2 === true)
        return `v${String(value.x)},${String(value.y)}`;
    if (value.isEuler === true)
        return `e${String(value.x)},${String(value.y)},${String(value.z)},${String(value.order)}`;
    if (Array.isArray(value)) {
        const items: string[] = [];
        for (const item of value) {
            // Arrays of objects (clipping planes) stay identity-only.
            if (isRecord(item)) return undefined;
            const serialized = serializeMaterialValue(item);
            if (serialized === undefined) return undefined;
            items.push(serialized);
        }
        return `[${items.join(',')}]`;
    }
    if (Object.getPrototypeOf(value) === Object.prototype) {
        const entries: string[] = [];
        for (const key of Object.keys(value).sort()) {
            const serialized = serializeMaterialValue(value[key]);
            if (serialized === undefined) return undefined;
            entries.push(`${key}=${serialized}`);
        }
        return `{${entries.join(',')}}`;
    }
    return undefined;
}

/**
 * Value signature for materials whose rendered output is fully described by
 * their serializable properties and registered shader hooks. Returns
 * undefined when a material carries unregistered user data, clipping planes, unknown
 * objects, or unregistered shader hooks so it can only batch by identity.
 */
export function getGardenMaterialSignature(
    material: Material,
    excludedProperties: readonly string[] = [],
) {
    const hookSignature = getGardenMaterialShaderHookSignature(material);
    if (!hookSignature) return undefined;
    let userDataSignature: string | undefined;
    if (Object.keys(material.userData).length > 0) {
        const hooks =
            getMaterialShaderHooksWithoutCloudShadowAttenuation(material);
        const registered = shaderHookSignatures.get(hooks.onBeforeCompile);
        if (
            !registered?.userDataSignature ||
            registered.userDataSignature !==
                serializeMaterialValue(material.userData)
        )
            return undefined;
        userDataSignature = registered.userDataSignature;
    }

    const entries = [`type=${material.type}`, `hooks=${hookSignature}`];
    if (userDataSignature) entries.push(`userData=${userDataSignature}`);
    for (const key of Object.keys(material).sort()) {
        if (ignoredMaterialKeys.has(key) || excludedProperties.includes(key))
            continue;
        const value: unknown = Reflect.get(material, key);
        if (typeof value === 'function') {
            // Shader hooks are covered above; other own functions are unknown.
            if (key === 'onBeforeCompile' || key === 'customProgramCacheKey')
                continue;
            return undefined;
        }
        const serialized = serializeMaterialValue(value);
        if (serialized === undefined) return undefined;
        entries.push(`${key}=${serialized}`);
    }
    return entries.join(';');
}

type SharedGardenMaterialEntry = {
    material: Material;
    users: number;
    dispose?: () => void;
};

const sharedMaterialMetrics = {
    canonicalMaterials: 0,
    deduplicatedMaterialUsers: 0,
    identityOnlyMaterialUsers: 0,
    sharedMaterialUsers: 0,
};

export type SharedGardenMaterialMetrics = typeof sharedMaterialMetrics;

function publishSharedMaterialMetrics() {
    updateGameProfileMetadata({
        gardenMaterials: { ...sharedMaterialMetrics },
    });
}

export function readSharedGardenMaterialMetrics() {
    return { ...sharedMaterialMetrics };
}

const sharedMaterials = new Map<string, SharedGardenMaterialEntry>();

/** Owns generated shared shaders until their final packet consumer releases. */
export function acquireOwnedSharedGardenMaterial(
    signature: string,
    createMaterial: () => Material,
) {
    if (!sharedMaterials.has(signature)) {
        const material = createMaterial();
        sharedMaterials.set(signature, {
            material,
            users: 0,
            dispose: () => material.dispose(),
        });
        sharedMaterialMetrics.canonicalMaterials++;
    }
    const entry = sharedMaterials.get(signature);
    if (!entry) throw new Error('Shared garden material was not registered.');
    return acquireSharedGardenMaterial(entry.material, signature);
}

/**
 * Resolves a material to the shared instance for its value signature. The
 * first registered material becomes canonical while any user holds it; the
 * registry never creates or disposes materials, so ownership stays with the
 * component that created the source material.
 */
export function acquireSharedGardenMaterial(
    material: Material,
    signature = getGardenMaterialSignature(material),
) {
    if (!signature) {
        sharedMaterialMetrics.identityOnlyMaterialUsers++;
        publishSharedMaterialMetrics();
        let released = false;
        return {
            material,
            release: () => {
                if (released) return;
                released = true;
                sharedMaterialMetrics.identityOnlyMaterialUsers--;
                publishSharedMaterialMetrics();
            },
        };
    }

    let entry = sharedMaterials.get(signature);
    if (!entry) {
        entry = { material, users: 0 };
        sharedMaterials.set(signature, entry);
        sharedMaterialMetrics.canonicalMaterials++;
    }
    const lease = entry;
    const deduplicated = lease.material !== material;
    lease.users++;
    sharedMaterialMetrics.sharedMaterialUsers++;
    if (deduplicated) sharedMaterialMetrics.deduplicatedMaterialUsers++;
    publishSharedMaterialMetrics();

    let released = false;
    return {
        material: lease.material,
        release: () => {
            if (released) return;
            released = true;
            lease.users--;
            sharedMaterialMetrics.sharedMaterialUsers--;
            if (deduplicated) sharedMaterialMetrics.deduplicatedMaterialUsers--;
            if (lease.users === 0 && sharedMaterials.get(signature) === lease) {
                sharedMaterials.delete(signature);
                sharedMaterialMetrics.canonicalMaterials--;
                lease.dispose?.();
            }
            publishSharedMaterialMetrics();
        },
    };
}

/**
 * Shares equal static garden materials across components while `enabled`.
 * Render reads the current canonical instance without side effects; the
 * lease that keeps it canonical is taken in a layout effect.
 * Disabled, array, and unsupported materials are returned unchanged.
 */
export function useSharedGardenMaterial(
    material: Material | Material[] | undefined,
    enabled: boolean,
): Material | Material[] | undefined {
    const source =
        enabled && material && !Array.isArray(material) ? material : undefined;
    const signature = useMemo(
        () => (source ? getGardenMaterialSignature(source) : undefined),
        [source],
    );
    const [leased, setLeased] = useState<{
        material: Material;
        source: Material;
    }>();
    useLayoutEffect(() => {
        if (!source) return;
        const lease = acquireSharedGardenMaterial(source, signature);
        setLeased({ material: lease.material, source });
        return lease.release;
    }, [signature, source]);
    if (!source) return material;
    if (leased?.source === source) return leased.material;
    return (signature && sharedMaterials.get(signature)?.material) || source;
}
