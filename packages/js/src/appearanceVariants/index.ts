export type PersistedAppearanceVariantFamily<TVariant extends number = number> =
    {
        key: string;
        variant: TVariant;
    };

export type PersistedAppearanceVariantDefinition<
    TFamilies extends readonly [
        PersistedAppearanceVariantFamily,
        ...PersistedAppearanceVariantFamily[],
    ] = readonly [
        PersistedAppearanceVariantFamily,
        ...PersistedAppearanceVariantFamily[],
    ],
> = {
    blockName: string;
    families: TFamilies;
};

export type PersistedAppearanceVariant<
    TDefinition extends PersistedAppearanceVariantDefinition,
> = TDefinition['families'][number]['variant'];

export function definePersistedAppearanceVariants<
    const TFamilies extends readonly [
        PersistedAppearanceVariantFamily,
        ...PersistedAppearanceVariantFamily[],
    ],
>(definition: {
    blockName: string;
    families: TFamilies;
}): PersistedAppearanceVariantDefinition<TFamilies> {
    const variants = new Set<number>();
    const keys = new Set<string>();

    for (const family of definition.families) {
        if (!Number.isInteger(family.variant) || family.variant < 0) {
            throw new Error(
                `Appearance variant for ${definition.blockName} must be a non-negative integer.`,
            );
        }
        if (variants.has(family.variant)) {
            throw new Error(
                `Duplicate appearance variant ${family.variant.toString()} for ${definition.blockName}.`,
            );
        }
        if (!family.key || keys.has(family.key)) {
            throw new Error(
                `Appearance family keys for ${definition.blockName} must be non-empty and unique.`,
            );
        }
        variants.add(family.variant);
        keys.add(family.key);
    }

    return definition;
}

export const rabbitAppearanceVariants = definePersistedAppearanceVariants({
    blockName: 'Rabbit',
    families: [
        { key: 'chestnut-agouti', variant: 0 },
        { key: 'cream', variant: 1 },
    ],
});

const persistedAppearanceVariantsByBlockName = new Map<
    string,
    PersistedAppearanceVariantDefinition
>([[rabbitAppearanceVariants.blockName, rabbitAppearanceVariants]]);

export function getPersistedAppearanceVariantDefinition(blockName: string) {
    return persistedAppearanceVariantsByBlockName.get(blockName) ?? null;
}

export function isPersistedAppearanceVariant(
    definition: PersistedAppearanceVariantDefinition,
    value: unknown,
): value is number {
    return (
        typeof value === 'number' &&
        definition.families.some((family) => family.variant === value)
    );
}

function normalizedRandomIndex(randomValue: number, length: number) {
    if (!Number.isFinite(randomValue)) {
        return 0;
    }

    const normalized = Math.min(Math.max(randomValue, 0), 1 - Number.EPSILON);
    return Math.floor(normalized * length);
}

export function selectPersistedAppearanceVariant(
    definition: PersistedAppearanceVariantDefinition,
    random: () => number,
) {
    const family =
        definition.families[
            normalizedRandomIndex(random(), definition.families.length)
        ] ?? definition.families[0];
    return family.variant;
}

export function createPersistedAppearanceVariantForPlacement(
    blockName: string,
    random: () => number,
) {
    const definition = getPersistedAppearanceVariantDefinition(blockName);
    return definition
        ? selectPersistedAppearanceVariant(definition, random)
        : undefined;
}

function hashStableId(stableId: string) {
    let hash = 2_166_136_261;
    for (let index = 0; index < stableId.length; index += 1) {
        hash ^= stableId.charCodeAt(index);
        hash = Math.imul(hash, 16_777_619);
    }
    return hash >>> 0;
}

export function resolvePersistedAppearanceVariant({
    blockName,
    persistedVariant,
    stableId,
}: {
    blockName: string;
    persistedVariant: unknown;
    stableId: string;
}) {
    const definition = getPersistedAppearanceVariantDefinition(blockName);
    if (!definition) {
        return undefined;
    }
    if (isPersistedAppearanceVariant(definition, persistedVariant)) {
        return persistedVariant;
    }

    const family =
        definition.families[
            hashStableId(stableId) % definition.families.length
        ] ?? definition.families[0];
    return family.variant;
}

export function isPersistedAppearanceVariantUpdateAllowed({
    blockName,
    currentVariant,
    requestedVariant,
}: {
    blockName: string;
    currentVariant: number | null;
    requestedVariant: number | null;
}) {
    const definition = getPersistedAppearanceVariantDefinition(blockName);
    if (!definition) {
        return true;
    }

    return (
        currentVariant === requestedVariant &&
        isPersistedAppearanceVariant(definition, requestedVariant)
    );
}
