import { slugify } from '@gredice/js/slug';
import type { DirectoryEntityDataMap, DirectoryEntityTypeName } from './cms';

type PublicSearchCategoryConfig = {
    slug: string;
    label: string;
};

export const publicSearchCategoryByDirectoryEntityType = {
    plant: { slug: 'plants', label: 'Biljke' },
    operation: { slug: 'operations', label: 'Radnje' },
    block: { slug: 'blocks', label: 'Blokovi' },
    plantSort: { slug: 'sorts', label: 'Sorte' },
    seed: { slug: 'seeds', label: 'Sjeme' },
} satisfies Partial<
    Record<DirectoryEntityTypeName, PublicSearchCategoryConfig>
>;

export const publicDirectoryEntityTypeExclusions = {
    brand: 'No canonical www brand detail or listing page exists yet.',
    farmSupply:
        'Farm supplies are operational inventory records without a public www destination.',
    hqLocations:
        'HQ locations are referenced by delivery/pricing pages but do not have public detail pages.',
    liquidPreparation:
        'Liquid preparations are inventory records without a public www product/detail page.',
    operationFrequency:
        'Operation frequencies only describe operation metadata and do not have public indexable pages.',
    plantStage:
        'Plant stages only describe operation metadata and do not have public indexable pages.',
} satisfies Partial<Record<DirectoryEntityTypeName, string>>;

const publicSearchCategoryEntityTypes = new Set<string>(
    Object.keys(publicSearchCategoryByDirectoryEntityType),
);

export type DirectoryEntityPublicUrlInput = {
    [TEntityTypeName in DirectoryEntityTypeName]: {
        entityTypeName: TEntityTypeName;
        entity: DirectoryEntityDataMap[TEntityTypeName];
    };
}[DirectoryEntityTypeName];

export type DirectoryEntityPublicUrlParts = {
    entityTypeName: string;
    name?: string | null;
    label?: string | null;
    parentName?: string | null;
    parentLabel?: string | null;
    plantName?: string | null;
    plantSortName?: string | null;
};

export const PublicDirectoryPaths = {
    Plants: '/biljke',
    Plant(alias: string) {
        return `/biljke/${toPublicPageAlias(alias)}`;
    },
    PlantSort(plantAlias: string, sortAlias: string) {
        return `/biljke/${toPublicPageAlias(plantAlias)}/sorte/${toPublicPageAlias(sortAlias)}`;
    },
    Blocks: '/blokovi',
    Block(alias: string) {
        return `/blokovi/${toPublicPageAlias(alias)}`;
    },
    BlockPlants: '/blokovi/biljke',
    BlockPlant(alias: string) {
        return `/blokovi/biljke/${toPublicPageAlias(alias)}`;
    },
    Operations: '/radnje',
    Operation(alias: string) {
        return `/radnje/${toPublicPageAlias(alias)}`;
    },
    FAQ: '/cesta-pitanja',
    LegalOccasions: '/legalno/natjecaji',
    Occasion(alias: string) {
        return `/legalno/natjecaji/${toPublicPageAlias(alias)}`;
    },
};

export function toPublicPageAlias(value: string): string {
    return slugify(value);
}

export function publicSearchCategoryForDirectoryEntityType(
    entityTypeName: string,
) {
    if (!hasPublicSearchCategory(entityTypeName)) {
        return null;
    }

    return publicSearchCategoryByDirectoryEntityType[entityTypeName];
}

function hasPublicSearchCategory(
    entityTypeName: string,
): entityTypeName is keyof typeof publicSearchCategoryByDirectoryEntityType {
    return publicSearchCategoryEntityTypes.has(entityTypeName);
}

function firstText(...values: Array<string | null | undefined>) {
    return values.find((value) => value?.trim())?.trim() ?? null;
}

export function resolveDirectoryEntityPublicPathFromParts({
    entityTypeName,
    name,
    label,
    parentName,
    parentLabel,
    plantName,
    plantSortName,
}: DirectoryEntityPublicUrlParts): string | null {
    const entityTitle = firstText(label, name);

    switch (entityTypeName) {
        case 'plant': {
            const plantAlias = firstText(name, label);
            return plantAlias ? PublicDirectoryPaths.Plant(plantAlias) : null;
        }
        case 'plantSort': {
            const plantAlias = firstText(parentName, parentLabel);
            const sortAlias = firstText(name, label);
            return plantAlias && sortAlias
                ? PublicDirectoryPaths.PlantSort(plantAlias, sortAlias)
                : null;
        }
        case 'operation':
            return entityTitle
                ? PublicDirectoryPaths.Operation(entityTitle)
                : null;
        case 'block':
            return entityTitle ? PublicDirectoryPaths.Block(entityTitle) : null;
        case 'faq':
        case 'faq-category':
            return PublicDirectoryPaths.FAQ;
        case 'occasions': {
            const occasionAlias = firstText(name, label);
            return occasionAlias
                ? PublicDirectoryPaths.Occasion(occasionAlias)
                : null;
        }
        case 'seed': {
            const seedPlantAlias = firstText(
                parentName,
                parentLabel,
                plantName,
            );
            if (seedPlantAlias && plantSortName) {
                return PublicDirectoryPaths.PlantSort(
                    seedPlantAlias,
                    plantSortName,
                );
            }
            return seedPlantAlias
                ? PublicDirectoryPaths.Plant(seedPlantAlias)
                : null;
        }
        default:
            return null;
    }
}

export function resolveDirectoryEntityPublicPath(
    input: DirectoryEntityPublicUrlInput,
): string | null {
    switch (input.entityTypeName) {
        case 'plant':
            return resolveDirectoryEntityPublicPathFromParts({
                entityTypeName: input.entityTypeName,
                name: input.entity.information.name,
                label: input.entity.information.name,
            });
        case 'plantSort':
            return resolveDirectoryEntityPublicPathFromParts({
                entityTypeName: input.entityTypeName,
                name: input.entity.information.name,
                parentName: input.entity.information.plant.information.name,
            });
        case 'operation':
            return resolveDirectoryEntityPublicPathFromParts({
                entityTypeName: input.entityTypeName,
                name: input.entity.information.name,
                label: input.entity.information.label,
            });
        case 'block':
            return resolveDirectoryEntityPublicPathFromParts({
                entityTypeName: input.entityTypeName,
                name: input.entity.information.name,
                label: input.entity.information.label,
            });
        case 'faq':
        case 'faq-category':
            return PublicDirectoryPaths.FAQ;
        case 'occasions':
            return resolveDirectoryEntityPublicPathFromParts({
                entityTypeName: input.entityTypeName,
                name: input.entity.information.name,
            });
        case 'seed':
            return resolveDirectoryEntityPublicPathFromParts({
                entityTypeName: input.entityTypeName,
                name: input.entity.information.name,
                parentName: input.entity.information.plant.information.name,
                plantSortName:
                    input.entity.information.plantSort.information.name,
            });
        default:
            return null;
    }
}
