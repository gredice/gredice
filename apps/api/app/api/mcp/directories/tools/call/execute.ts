import { getEntitiesFormatted } from '@gredice/storage';
import { z } from 'zod';
import { handleSearchEntities } from '../../searchEntities';

type EntityStandardized = {
    id: number;
    information?: {
        name?: string;
        label?: string;
        shortDescription?: string;
        description?: string;
        plant?: EntityStandardized;
    };
    attributes?: Record<string, unknown>;
    images?: {
        cover?: { url?: string };
    };
    prices?: {
        perPlant?: number;
        perOperation?: number;
    };
    [key: string]: unknown;
};

const GetPlantsSchema = z.object({
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
    category: z.string().optional(),
});

const GetPlantSchema = z.object({
    plantName: z.string().min(1),
    includeSorts: z.boolean().default(false),
});

const SearchEntitiesSchema = z.object({
    query: z.string().min(1),
    entityTypes: z.array(z.string()).optional(),
    limit: z.number().int().min(1).max(100).default(20),
});

const GetPlantSortsSchema = z.object({
    plant_type: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
});

const GetOperationsSchema = z.object({
    category: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
});

const GetSeedsSchema = z.object({
    plant_type: z.string().optional(),
    variety: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
});

const DIRECTORY_ENTITY_TYPES = {
    plant: 'plant',
    sort: 'plant-sort',
    operation: 'operation',
    seed: 'seed',
} as const;

function entityName(entity: EntityStandardized): string {
    return (
        entity.information?.name ||
        entity.information?.label ||
        `Entity ${entity.id}`
    );
}

function extractPlantName(entity: EntityStandardized): string {
    const info = entity.information;
    if (!info) return '';
    if (typeof info.plant === 'object' && info.plant) {
        return entityName(info.plant);
    }
    const nestedPlantName = (info as Record<string, unknown>).plant;
    if (typeof nestedPlantName === 'object' && nestedPlantName) {
        const nestedInfo = (
            nestedPlantName as { information?: { name?: string } }
        ).information;
        return nestedInfo?.name ?? '';
    }
    return '';
}

function extractSeedSortName(seed: EntityStandardized): string {
    const plantSort = (
        seed.information as
            | { plantSort?: { information?: { name?: string } } }
            | undefined
    )?.plantSort;
    return plantSort?.information?.name ?? '';
}

function paginate<T>(values: T[], limit: number, offset: number) {
    return values.slice(offset, offset + limit);
}

async function getDirectoryEntities(
    entityTypeName: string,
    signal?: AbortSignal,
): Promise<EntityStandardized[]> {
    try {
        signal?.throwIfAborted();
        const entities =
            await getEntitiesFormatted<EntityStandardized>(entityTypeName);
        signal?.throwIfAborted();
        return [...(entities ?? [])].sort((a, b) =>
            entityName(a).localeCompare(entityName(b), 'hr'),
        );
    } catch {
        return [];
    }
}

export class DirectoryToolNotFoundError extends Error {
    constructor(name: string) {
        super(`Method not found: ${name}`);
        this.name = 'DirectoryToolNotFoundError';
    }
}

export async function executeDirectoryTool(
    name: string,
    args: unknown,
    options?: { signal?: AbortSignal },
) {
    options?.signal?.throwIfAborted();

    switch (name) {
        case 'directories/get-plants':
            return handleGetPlants(
                GetPlantsSchema.parse(args),
                options?.signal,
            );
        case 'directories/get-plant':
            return handleGetPlant(GetPlantSchema.parse(args), options?.signal);
        case 'directories/get-plant-sorts':
            return handleGetPlantSorts(
                GetPlantSortsSchema.parse(args),
                options?.signal,
            );
        case 'directories/search-entities':
            return handleSearchEntities(
                SearchEntitiesSchema.parse(args),
                options?.signal,
            );
        case 'directories/get-operations':
            return handleGetOperations(
                GetOperationsSchema.parse(args),
                options?.signal,
            );
        case 'directories/get-seeds':
            return handleGetSeeds(GetSeedsSchema.parse(args), options?.signal);
        default:
            throw new DirectoryToolNotFoundError(name);
    }
}

async function handleGetPlants(
    input: z.infer<typeof GetPlantsSchema>,
    signal?: AbortSignal,
) {
    const allPlants = await getDirectoryEntities(
        DIRECTORY_ENTITY_TYPES.plant,
        signal,
    );
    signal?.throwIfAborted();
    const filtered = input.category
        ? allPlants.filter((plant) =>
              `${plant.attributes?.category ?? ''}`
                  .toLowerCase()
                  .includes((input.category ?? '').toLowerCase()),
          )
        : allPlants;

    return {
        plants: paginate(filtered, input.limit, input.offset).map((plant) => ({
            id: plant.id.toString(),
            name: entityName(plant),
            nameLatin: plant.information?.shortDescription || '',
            description: plant.information?.description || '',
            category: plant.attributes?.category ?? null,
        })),
        total: filtered.length,
        limit: input.limit,
        offset: input.offset,
    };
}

async function handleGetPlant(
    input: z.infer<typeof GetPlantSchema>,
    signal?: AbortSignal,
) {
    const allPlants = await getDirectoryEntities(
        DIRECTORY_ENTITY_TYPES.plant,
        signal,
    );
    signal?.throwIfAborted();
    const term = input.plantName.toLowerCase();
    const plant = allPlants.find((item) =>
        entityName(item).toLowerCase().includes(term),
    );

    if (!plant) {
        return { error: `Biljka "${input.plantName}" nije pronađena` };
    }

    const result = {
        id: plant.id.toString(),
        name: entityName(plant),
        nameLatin: plant.information?.shortDescription || '',
        description: plant.information?.description || '',
        category: plant.attributes?.category ?? null,
    };

    if (!input.includeSorts) return result;

    const allSorts = await getDirectoryEntities(
        DIRECTORY_ENTITY_TYPES.sort,
        signal,
    );
    signal?.throwIfAborted();
    const sorts = allSorts
        .filter((sort) => {
            const sortPlantId = sort.attributes?.plantId;
            const sortPlantName = sort.information?.plant?.information?.name;
            return (
                sortPlantId === plant.id ||
                sortPlantName === plant.information?.name
            );
        })
        .map((sort) => ({
            id: sort.id.toString(),
            name: entityName(sort),
            description:
                sort.information?.description ||
                sort.information?.shortDescription ||
                '',
        }));

    return { ...result, sorts };
}

async function handleGetPlantSorts(
    input: z.infer<typeof GetPlantSortsSchema>,
    signal?: AbortSignal,
) {
    const allSorts = await getDirectoryEntities(
        DIRECTORY_ENTITY_TYPES.sort,
        signal,
    );
    signal?.throwIfAborted();
    const filtered = input.plant_type
        ? allSorts.filter((sort) =>
              extractPlantName(sort)
                  .toLowerCase()
                  .includes((input.plant_type ?? '').toLowerCase()),
          )
        : allSorts;

    return {
        sorts: paginate(filtered, input.limit, input.offset).map((sort) => ({
            id: sort.id.toString(),
            name: entityName(sort),
            description: sort.information?.description || '',
        })),
        total: filtered.length,
        limit: input.limit,
        offset: input.offset,
    };
}

async function handleGetOperations(
    input: z.infer<typeof GetOperationsSchema>,
    signal?: AbortSignal,
) {
    const allOperations = await getDirectoryEntities(
        DIRECTORY_ENTITY_TYPES.operation,
        signal,
    );
    signal?.throwIfAborted();
    const filtered = input.category
        ? allOperations.filter(
              (op) =>
                  `${op.attributes?.application ?? op.attributes?.frequency ?? ''}`.toLowerCase() ===
                  (input.category ?? '').toLowerCase(),
          )
        : allOperations;

    return {
        operations: paginate(filtered, input.limit, input.offset).map(
            (operation) => ({
                id: operation.id.toString(),
                name: entityName(operation),
                category:
                    operation.attributes?.application ??
                    operation.attributes?.frequency ??
                    null,
                description: operation.information?.description || '',
                steps: operation.attributes?.steps ?? [],
                tools: operation.attributes?.tools ?? [],
            }),
        ),
        total: filtered.length,
        limit: input.limit,
        offset: input.offset,
    };
}

async function handleGetSeeds(
    input: z.infer<typeof GetSeedsSchema>,
    signal?: AbortSignal,
) {
    const allSeeds = await getDirectoryEntities(
        DIRECTORY_ENTITY_TYPES.seed,
        signal,
    );
    signal?.throwIfAborted();
    let filtered = allSeeds;
    if (input.plant_type) {
        filtered = filtered.filter((seed) =>
            extractPlantName(seed)
                .toLowerCase()
                .includes((input.plant_type ?? '').toLowerCase()),
        );
    }
    if (input.variety) {
        filtered = filtered.filter((seed) =>
            extractSeedSortName(seed)
                .toLowerCase()
                .includes((input.variety ?? '').toLowerCase()),
        );
    }

    return {
        seeds: paginate(filtered, input.limit, input.offset).map((seed) => ({
            id: seed.id.toString(),
            name: entityName(seed),
            plant_type: extractPlantName(seed) || null,
            variety: extractSeedSortName(seed) || null,
            description: seed.information?.description || '',
        })),
        total: filtered.length,
        limit: input.limit,
        offset: input.offset,
    };
}
