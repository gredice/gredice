export type AppearanceVariantDefinition = {
    id: string;
    value: number;
};

function fnv1a32(value: string) {
    let hash = 2_166_136_261;

    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16_777_619);
    }

    return hash >>> 0;
}

export function defineAppearanceVariants<
    const TEntityName extends string,
    const TVariants extends readonly AppearanceVariantDefinition[],
>(entityName: TEntityName, variants: TVariants) {
    const values = new Set<number>();
    for (const variant of variants) {
        if (!Number.isInteger(variant.value) || variant.value < 0) {
            throw new RangeError(
                'Appearance variant values must be non-negative integers',
            );
        }
        if (values.has(variant.value)) {
            throw new Error('Appearance variant values must be unique');
        }
        values.add(variant.value);
    }
    if (variants.length === 0) {
        throw new Error('At least one appearance variant is required');
    }

    return {
        entityName,
        isVariant(value: unknown): value is TVariants[number]['value'] {
            return typeof value === 'number' && values.has(value);
        },
        variants,
    };
}

export const horseAppearanceVariants = defineAppearanceVariants('Horse', [
    {
        id: 'bay',
        value: 0,
        label: 'Dorat',
        coatColor: '#6f3f2d',
        maneColor: '#211715',
        markingColor: '#eee3cf',
        muzzleColor: '#4d3832',
    },
    {
        id: 'chestnut',
        value: 1,
        label: 'Kestenjasti',
        coatColor: '#9b4d2f',
        maneColor: '#6d2f22',
        markingColor: '#f2dfc4',
        muzzleColor: '#6f453c',
    },
    {
        id: 'black',
        value: 2,
        label: 'Vranac',
        coatColor: '#24211f',
        maneColor: '#11100f',
        markingColor: '#ddd8ce',
        muzzleColor: '#393433',
    },
    {
        id: 'dapple-gray',
        value: 3,
        label: 'Sivac',
        coatColor: '#b9b5ad',
        maneColor: '#77736d',
        markingColor: '#e8e3d9',
        muzzleColor: '#858079',
    },
    {
        id: 'palomino',
        value: 4,
        label: 'Palomino',
        coatColor: '#c9944f',
        maneColor: '#ead8ab',
        markingColor: '#f4e8cd',
        muzzleColor: '#927052',
    },
    {
        id: 'pinto',
        value: 5,
        label: 'Šarac',
        coatColor: '#8b553b',
        maneColor: '#38251e',
        markingColor: '#f0e6d5',
        muzzleColor: '#725449',
    },
]);

export const cowAppearanceVariants = defineAppearanceVariants('Cow', [
    {
        id: 'brown-and-white',
        value: 0,
        label: 'Smeđe-bijela',
    },
    {
        id: 'black-and-white',
        value: 1,
        label: 'Crno-bijela',
    },
]);

export type CowAppearanceVariant =
    (typeof cowAppearanceVariants.variants)[number]['value'];

export type HorseAppearanceVariant =
    (typeof horseAppearanceVariants.variants)[number]['value'];

export type HorseAppearanceVariantDefinition =
    (typeof horseAppearanceVariants.variants)[number];

export function getHorseAppearanceVariantDefinition(
    variant: HorseAppearanceVariant,
): HorseAppearanceVariantDefinition {
    const definition = horseAppearanceVariants.variants.find(
        (candidate) => candidate.value === variant,
    );
    if (!definition) {
        throw new Error('Horse appearance variant definition not found');
    }
    return definition;
}

// Never extend or reorder this tuple. It is the permanent fallback domain for
// legacy Horse records that predate persisted appearance variants.
const horseLegacyFallbackVariants: readonly HorseAppearanceVariant[] = [
    0, 1, 2, 3, 4, 5,
];

// Never extend or reorder this tuple. It is the permanent fallback domain for
// legacy Cow records that predate persisted appearance variants.
const cowLegacyFallbackVariants: readonly CowAppearanceVariant[] = [0, 1];

type AppearanceVariantEntityName =
    | typeof cowAppearanceVariants.entityName
    | typeof horseAppearanceVariants.entityName;

export function isAppearanceVariantEntityName(
    entityName: string,
): entityName is AppearanceVariantEntityName {
    return (
        entityName === cowAppearanceVariants.entityName ||
        entityName === horseAppearanceVariants.entityName
    );
}

export function isValidEntityAppearanceVariant(
    entityName: string,
    variant: unknown,
) {
    if (entityName === cowAppearanceVariants.entityName) {
        return cowAppearanceVariants.isVariant(variant);
    }
    if (entityName === horseAppearanceVariants.entityName) {
        return horseAppearanceVariants.isVariant(variant);
    }
    return false;
}

export function requiresExplicitAppearanceVariantSelection(entityName: string) {
    return entityName === horseAppearanceVariants.entityName;
}

export function isAppearanceVariantRotationLocked(entityName: string) {
    return entityName === horseAppearanceVariants.entityName;
}

export function selectEntityAppearanceVariant(
    entityName: string,
    immutablePlacementId: string,
): number | null {
    const variants =
        entityName === cowAppearanceVariants.entityName
            ? cowAppearanceVariants.variants
            : entityName === horseAppearanceVariants.entityName
              ? horseAppearanceVariants.variants
              : null;
    if (!variants) {
        return null;
    }

    const selected =
        variants[
            fnv1a32(`${entityName}:${immutablePlacementId}`) % variants.length
        ];
    return selected?.value ?? null;
}

export function resolveCowAppearanceVariant(
    persistedVariant: unknown,
    immutableBlockId: string,
): CowAppearanceVariant {
    if (cowAppearanceVariants.isVariant(persistedVariant)) {
        return persistedVariant;
    }

    const fallback =
        cowLegacyFallbackVariants[
            fnv1a32(`Cow:${immutableBlockId}`) %
                cowLegacyFallbackVariants.length
        ];
    if (fallback === undefined) {
        throw new Error('Cow legacy appearance fallback is empty');
    }
    return fallback;
}

export function resolveHorseAppearanceVariant(
    persistedVariant: unknown,
    immutableBlockId: string,
): HorseAppearanceVariant {
    if (horseAppearanceVariants.isVariant(persistedVariant)) {
        return persistedVariant;
    }

    const fallback =
        horseLegacyFallbackVariants[
            fnv1a32(`Horse:${immutableBlockId}`) %
                horseLegacyFallbackVariants.length
        ];
    if (fallback === undefined) {
        throw new Error('Horse legacy appearance fallback is empty');
    }
    return fallback;
}
