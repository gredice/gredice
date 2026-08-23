export const persistedAppearanceVariantNames = {
    Cow: ['brown-and-white', 'black-and-white'],
} as const;

export type PersistedAppearanceEntityName =
    keyof typeof persistedAppearanceVariantNames;

export type PersistedAppearanceVariantName<
    EntityName extends PersistedAppearanceEntityName,
> = (typeof persistedAppearanceVariantNames)[EntityName][number];

export type PersistedAppearanceVariantIndexByEntity = {
    Cow: 0 | 1;
};

export type PersistedAppearanceVariantIndex<
    EntityName extends PersistedAppearanceEntityName,
> = PersistedAppearanceVariantIndexByEntity[EntityName];

function hashAppearanceSeed(seed: string) {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
        hash ^= seed.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function isPersistedAppearanceEntityName(
    entityName: string,
): entityName is PersistedAppearanceEntityName {
    return Object.hasOwn(persistedAppearanceVariantNames, entityName);
}

export function getPersistedAppearanceVariantNames(
    entityName: string,
): readonly string[] | null {
    return isPersistedAppearanceEntityName(entityName)
        ? persistedAppearanceVariantNames[entityName]
        : null;
}

export function isPersistedAppearanceVariantIndex(
    entityName: string,
    variant: unknown,
) {
    const variants = getPersistedAppearanceVariantNames(entityName);
    return (
        variants !== null &&
        typeof variant === 'number' &&
        Number.isInteger(variant) &&
        variant >= 0 &&
        variant < variants.length
    );
}

export function isPersistedAppearanceVariantPlacementValid(
    entityName: string,
    variant: unknown,
) {
    return (
        variant === undefined ||
        isPersistedAppearanceVariantIndex(entityName, variant)
    );
}

export function isPersistedAppearanceVariantUpdateAllowed(
    entityName: string,
    persistedVariant: number | null | undefined,
    nextVariant: number | null | undefined,
) {
    return (
        nextVariant === undefined ||
        !isPersistedAppearanceEntityName(entityName) ||
        nextVariant === persistedVariant
    );
}

export function selectPersistedAppearanceVariantIndex(
    entityName: string,
    placementSeed: string,
) {
    const variants = getPersistedAppearanceVariantNames(entityName);
    if (!variants || variants.length === 0) {
        return null;
    }
    return (
        hashAppearanceSeed(`${entityName}:${placementSeed}`) % variants.length
    );
}

export function resolvePersistedAppearanceVariantIndex(
    entityName: string,
    persistedVariant: unknown,
    legacySeed: string,
) {
    if (
        typeof persistedVariant === 'number' &&
        isPersistedAppearanceVariantIndex(entityName, persistedVariant)
    ) {
        return persistedVariant;
    }
    return selectPersistedAppearanceVariantIndex(entityName, legacySeed);
}

export function getPersistedAppearanceVariantName(
    entityName: string,
    variant: unknown,
) {
    const variants = getPersistedAppearanceVariantNames(entityName);
    return variants &&
        typeof variant === 'number' &&
        isPersistedAppearanceVariantIndex(entityName, variant)
        ? (variants[variant] ?? null)
        : null;
}
