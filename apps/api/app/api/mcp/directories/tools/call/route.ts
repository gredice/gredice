import { getEntitiesFormatted } from '@gredice/storage';
import { type NextRequest, NextResponse } from 'next/server';
import { Logger } from 'next-axiom';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Entity type for database integration
type EntityStandardized = {
    id: number;
    information?: {
        name?: string;
        label?: string;
        shortDescription?: string;
        description?: string;
        plant?: EntityStandardized;
    };
    attributes?: {
        seedingDistance?: number;
        duration?: number | string;
        [key: string]: unknown;
    };
    images?: {
        cover?: { url?: string };
    };
    prices?: {
        perPlant?: number;
        perOperation?: number;
    };
    conditions?: {
        completionAttachImages?: boolean;
        completionAttachImagesRequired?: boolean;
    };
    [key: string]: unknown;
};

// Input schemas for directories tools
const GetPlantsSchema = z.object({
    limit: z.number().min(1).max(1000).default(100),
    offset: z.number().min(0).default(0),
    category: z.string().optional(),
});

const GetPlantSchema = z.object({
    plantName: z.string(),
    includeSorts: z.boolean().default(false),
});

const SearchEntitiesSchema = z.object({
    query: z.string().min(1),
    entityTypes: z.array(z.string()).optional(),
    limit: z.number().min(1).max(100).default(20),
});

const GetPlantSortsSchema = z.object({
    plant_type: z.string().optional(),
    limit: z.number().min(1).max(100).default(50),
    offset: z.number().min(0).default(0),
});

const GetOperationsSchema = z.object({
    category: z.string().optional(),
    limit: z.number().min(1).max(100).default(50),
    offset: z.number().min(0).default(0),
});

const GetSeedsSchema = z.object({
    plant_type: z.string().optional(),
    variety: z.string().optional(),
    limit: z.number().min(1).max(100).default(50),
    offset: z.number().min(0).default(0),
});

export async function GET() {
    return NextResponse.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        server: 'gredice-mcp-directories',
        availableTools: [
            'directories/get-plants',
            'directories/get-plant',
            'directories/get-plant-sorts',
            'directories/search-entities',
            'directories/get-operations',
            'directories/get-seeds',
        ],
    });
}

export async function POST(request: NextRequest) {
    const logger = new Logger();
    const startTime = Date.now();
    const correlationId = crypto.randomUUID();

    try {
        const body = await request.json();
        const { name, arguments: args } = body.params || {};

        logger.info('mcp.directories.tool.start', {
            toolName: name,
            correlationId,
            timestamp: new Date().toISOString(),
        });

        let result: unknown;

        switch (name) {
            case 'directories/get-plants': {
                const input = GetPlantsSchema.parse(args);
                result = await handleGetPlants(input);
                break;
            }
            case 'directories/get-plant': {
                const input = GetPlantSchema.parse(args);
                result = await handleGetPlant(input);
                break;
            }
            case 'directories/get-plant-sorts': {
                const input = GetPlantSortsSchema.parse(args);
                result = await handleGetPlantSorts(input);
                break;
            }
            case 'directories/search-entities': {
                const input = SearchEntitiesSchema.parse(args);
                result = await handleSearchEntities(input);
                break;
            }
            case 'directories/get-operations': {
                const input = GetOperationsSchema.parse(args);
                result = await handleGetOperations(input);
                break;
            }
            case 'directories/get-seeds': {
                const input = GetSeedsSchema.parse(args);
                result = await handleGetSeeds(input);
                break;
            }
            default:
                logger.error('mcp.directories.tool.error', {
                    correlationId,
                    duration: Date.now() - startTime,
                    error: `Unknown tool: ${name}`,
                    timestamp: new Date().toISOString(),
                });

                await logger.flush();

                return NextResponse.json(
                    {
                        jsonrpc: '2.0',
                        error: {
                            code: -32601,
                            message: `Method not found: ${name}`,
                        },
                        id: null,
                    },
                    { status: 400 },
                );
        }

        logger.info('mcp.directories.tool.success', {
            toolName: name,
            correlationId,
            duration: Date.now() - startTime,
            timestamp: new Date().toISOString(),
        });

        await logger.flush();

        return NextResponse.json({
            jsonrpc: '2.0',
            result,
            id: body.id || correlationId,
        });
    } catch (error) {
        logger.error('mcp.directories.tool.error', {
            correlationId,
            duration: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
        });

        await logger.flush();

        const statusCode = error instanceof z.ZodError ? 400 : 500;

        return NextResponse.json(
            {
                jsonrpc: '2.0',
                error: {
                    code: error instanceof z.ZodError ? -32602 : -32603,
                    message:
                        error instanceof z.ZodError
                            ? 'Invalid params'
                            : error instanceof Error
                              ? error.message
                              : 'Tool execution failed',
                    data:
                        error instanceof z.ZodError ? error.issues : undefined,
                },
                id: correlationId,
            },
            { status: statusCode },
        );
    }
}

// Tool handlers (placeholder implementations - ready for @gredice/storage integration)
async function handleGetPlants(input: z.infer<typeof GetPlantsSchema>) {
    // Get real plants data from database
    const allPlants =
        (await getEntitiesFormatted<EntityStandardized>('plant')) || [];

    // Filter by category if specified
    let filteredPlants = allPlants;
    if (input.category && allPlants) {
        filteredPlants = allPlants.filter(
            (plant) =>
                plant.attributes?.category === input.category ||
                plant.information?.description
                    ?.toLowerCase()
                    .includes(input.category?.toLowerCase() || ''),
        );
    }

    // Apply pagination
    const total = filteredPlants?.length || 0;
    const paginatedPlants =
        filteredPlants?.slice(input.offset, input.offset + input.limit) || [];

    // Transform to MCP response format
    const plants = paginatedPlants.map((plant) => ({
        id: plant.id.toString(),
        name:
            plant.information?.name ||
            plant.information?.label ||
            `Plant ${plant.id}`,
        nameLatin: plant.information?.shortDescription || '',
        description: plant.information?.description || '',
        category: plant.attributes?.category || 'other',
        difficulty: plant.attributes?.difficulty || 'medium',
        season: plant.attributes?.season || [],
        plantingMonths: plant.attributes?.plantingMonths || [],
        harvestMonths: plant.attributes?.harvestMonths || [],
        seedingDistance: plant.attributes?.seedingDistance || 0,
        duration: plant.attributes?.duration || 0,
    }));

    return {
        plants,
        total,
        limit: input.limit,
        offset: input.offset,
    };
}

async function handleGetPlant(input: z.infer<typeof GetPlantSchema>) {
    // Get real plant data from database by searching by name
    let plant: EntityStandardized | null = null;

    // Get all plants and search by name
    const allPlants =
        (await getEntitiesFormatted<EntityStandardized>('plant')) || [];

    // Search for plant by name (case-insensitive, partial match)
    const searchName = input.plantName.toLowerCase();
    plant =
        allPlants.find(
            (p) =>
                p.information?.name?.toLowerCase().includes(searchName) ||
                p.information?.label?.toLowerCase().includes(searchName) ||
                p.information?.name?.toLowerCase() === searchName ||
                p.information?.label?.toLowerCase() === searchName,
        ) || null;

    if (!plant) {
        return { error: `Biljka "${input.plantName}" nije pronađena` };
    }

    // Get plant sorts if requested
    let sorts:
        | Array<{
              id: string;
              name: string;
              plantingMonths: unknown;
              harvestMonths: unknown;
              description: string;
              daysToMaturity: unknown;
          }>
        | undefined;
    if (input.includeSorts) {
        try {
            const allSorts =
                (await getEntitiesFormatted<EntityStandardized>(
                    'plant-sort',
                )) || [];
            const plantSorts = allSorts.filter(
                (sort) =>
                    sort.information?.plant?.id === plant.id ||
                    sort.attributes?.plantId === plant.id ||
                    sort.information?.plant?.information?.name ===
                        plant.information?.name,
            );

            sorts = plantSorts.map((sort) => ({
                id: sort.id.toString(),
                name:
                    sort.information?.name ||
                    sort.information?.label ||
                    `Sort ${sort.id}`,
                plantingMonths: sort.attributes?.plantingMonths || [],
                harvestMonths: sort.attributes?.harvestMonths || [],
                description:
                    sort.information?.description ||
                    sort.information?.shortDescription ||
                    '',
                daysToMaturity: sort.attributes?.duration || 0,
            }));
        } catch (error) {
            // If plant-sort entity type doesn't exist, continue without sorts
            console.warn('Plant sorts not available:', error);
        }
    }

    return {
        id: plant.id.toString(),
        name:
            plant.information?.name ||
            plant.information?.label ||
            `Plant ${plant.id}`,
        nameLatin: plant.information?.shortDescription || '',
        description: plant.information?.description || '',
        category: plant.attributes?.category || 'other',
        difficulty: plant.attributes?.difficulty || 'medium',
        careInstructions: {
            watering:
                plant.attributes?.watering ||
                'Redovito zalijevanje prema potrebi',
            sunlight: plant.attributes?.sunlight || 'Puno sunčeve svjetlosti',
            soil: plant.attributes?.soil || 'Dobro drenirana zemlja',
            temperature: plant.attributes?.temperature || '15-25°C optimalno',
        },
        plantingCalendar: {
            sowing:
                plant.attributes?.sowingMonths ||
                plant.attributes?.plantingMonths ||
                [],
            transplanting: plant.attributes?.transplantingMonths || [],
            harvest: plant.attributes?.harvestMonths || [],
        },
        seedingDistance: plant.attributes?.seedingDistance || 0,
        duration: plant.attributes?.duration || 0,
        sorts,
    };
}

async function handleSearchEntities(
    input: z.infer<typeof SearchEntitiesSchema>,
) {
    // TODO: Implement with actual search across entities
    const query = input.query.toLowerCase();
    const mockResults = [
        {
            id: '1',
            type: 'plant',
            name: 'Rajčica',
            nameLatin: 'Solanum lycopersicum',
            description:
                'Popularna biljka za uzgoj - pronađeno po upitu: ' +
                input.query,
            category: 'vegetables',
            relevance: query.includes('rajč') ? 0.9 : 0.3,
        },
        {
            id: '2',
            type: 'plant_sort',
            name: 'Cherry rajčica',
            description:
                'Mala, slatka rajčica - pronađeno po upitu: ' + input.query,
            plant: { name: 'Rajčica', nameLatin: 'Solanum lycopersicum' },
            relevance:
                query.includes('cherry') || query.includes('rajč') ? 0.8 : 0.2,
        },
        {
            id: '1',
            type: 'operation',
            name: 'Zalijevanje',
            description:
                'Redovito zalijevanje biljaka - pronađeno po upitu: ' +
                input.query,
            category: 'watering',
            relevance:
                query.includes('zalij') || query.includes('voda') ? 0.9 : 0.1,
        },
    ];

    // Simple relevance filtering
    const filteredResults = mockResults
        .filter((result) => result.relevance > 0.2)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, input.limit);

    return {
        results: filteredResults,
        total: filteredResults.length,
        query: input.query,
        limit: input.limit,
        entityTypes: input.entityTypes,
    };
}

// Handler function for getting plant sorts
async function handleGetPlantSorts(input: z.infer<typeof GetPlantSortsSchema>) {
    // TODO: Implement with actual getEntitiesFormatted('plant_sorts')
    const mockSorts = [
        {
            id: 'sort-rajcica-grande',
            name: 'Rajčica Grande',
            plant_type: 'rajčica',
            description: 'Krupna, mesnatna rajčica s izvrsnim okusom.',
            properties: {
                fruit_size: 'velika',
                maturity: '75 dana',
                yield: 'visoka',
            },
        },
        {
            id: 'sort-rajcica-cherry',
            name: 'Rajčica Cherry',
            plant_type: 'rajčica',
            description: 'Mala, slatka rajčica za salate.',
            properties: {
                fruit_size: 'mala',
                maturity: '65 dana',
                yield: 'vrlo visoka',
            },
        },
        {
            id: 'sort-salata-iceberg',
            name: 'Salata Iceberg',
            plant_type: 'salata',
            description: 'Hrskava salata s velikim glavicama.',
            properties: {
                head_size: 'velika',
                maturity: '85 dana',
                storage: 'dobra',
            },
        },
    ];

    let filteredSorts = mockSorts;

    // Filter by plant type if provided
    if (input.plant_type) {
        const plantType = input.plant_type;
        filteredSorts = filteredSorts.filter((sort) =>
            sort.plant_type.toLowerCase().includes(plantType.toLowerCase()),
        );
    }

    // Apply limit
    if (input.limit) {
        filteredSorts = filteredSorts.slice(0, input.limit);
    }

    return {
        sorts: filteredSorts,
        total: mockSorts.length,
        limit: input.limit,
    };
}

// Handler function for getting gardening operations
async function handleGetOperations(input: z.infer<typeof GetOperationsSchema>) {
    // TODO: Implement with actual getEntitiesFormatted('operations')
    const mockOperations = [
        {
            id: 'operation-sadnja-rajcica',
            name: 'Sadnja rajčice',
            category: 'sadnja',
            description: 'Sadnja sadnica rajčice u pripremljenu zemlju.',
            timing: 'proljeće (travanj-svibanj)',
            tools: ['lopata', 'zalijevalica'],
            steps: [
                'Pripremi rupu dubine 20cm',
                'Dodaj kompost u rupu',
                'Posadi sadnicu',
                'Obilno zalij',
            ],
        },
        {
            id: 'operation-zalijevanje',
            name: 'Zalijevanje biljaka',
            category: 'održavanje',
            description: 'Redovito zalijevanje biljaka prema potrebama.',
            timing: 'dnevno ili prema potrebi',
            tools: ['zalijevalica', 'crijevo'],
            steps: [
                'Provjeri vlažnost tla',
                'Zalij oko korijena',
                'Izbjegavaj listove',
            ],
        },
        {
            id: 'operation-berba-rajcica',
            name: 'Berba rajčice',
            category: 'berba',
            description: 'Berba zrelih plodova rajčice.',
            timing: 'ljeto (srpanj-rujan)',
            tools: ['škare', 'košara'],
            steps: [
                'Identificiraj zrele plodove',
                'Pažljivo odreži',
                'Pohrani u suho',
            ],
        },
    ];

    let filteredOperations = mockOperations;

    // Filter by category if provided
    if (input.category) {
        const category = input.category;
        filteredOperations = filteredOperations.filter(
            (op) => op.category.toLowerCase() === category.toLowerCase(),
        );
    }

    // Apply limit
    if (input.limit) {
        filteredOperations = filteredOperations.slice(0, input.limit);
    }

    return {
        operations: filteredOperations,
        total: mockOperations.length,
        limit: input.limit,
    };
}

// Handler function for getting seeds
async function handleGetSeeds(input: z.infer<typeof GetSeedsSchema>) {
    // TODO: Implement with actual getEntitiesFormatted('seeds')
    const mockSeeds = [
        {
            id: 'seed-rajcica-grande',
            name: 'Sjeme rajčice Grande',
            plant_type: 'rajčica',
            variety: 'Grande',
            description: 'Kvalitetno sjeme krupne rajčice s visokim prinosom.',
            properties: {
                germination_rate: '95%',
                germination_time: '7-14 dana',
                packet_size: '20 sjemenki',
                sowing_depth: '0.5 cm',
            },
            sowing: {
                indoor: 'veljača-ožujak',
                outdoor: 'travanj-svibanj',
                temperature: '20-25°C',
            },
        },
        {
            id: 'seed-salata-iceberg',
            name: 'Sjeme salate Iceberg',
            plant_type: 'salata',
            variety: 'Iceberg',
            description: 'Sjeme hrskave salate za proljetnu i jesensku sadnju.',
            properties: {
                germination_rate: '90%',
                germination_time: '5-10 dana',
                packet_size: '100 sjemenki',
                sowing_depth: '0.3 cm',
            },
            sowing: {
                indoor: 'ožujak-travanj',
                outdoor: 'travanj-srpanj',
                temperature: '15-20°C',
            },
        },
        {
            id: 'seed-mrkva-nantes',
            name: 'Sjeme mrkve Nantes',
            plant_type: 'mrkva',
            variety: 'Nantes',
            description: 'Klasična sorta mrkve s cilindričnim korijenjem.',
            properties: {
                germination_rate: '85%',
                germination_time: '10-21 dana',
                packet_size: '200 sjemenki',
                sowing_depth: '1 cm',
            },
            sowing: {
                indoor: 'ne preporučuje se',
                outdoor: 'ožujak-srpanj',
                temperature: '10-25°C',
            },
        },
    ];

    let filteredSeeds = mockSeeds;

    // Filter by plant type if provided
    if (input.plant_type) {
        const plantType = input.plant_type;
        filteredSeeds = filteredSeeds.filter((seed) =>
            seed.plant_type.toLowerCase().includes(plantType.toLowerCase()),
        );
    }

    // Filter by variety if provided
    if (input.variety) {
        const variety = input.variety;
        filteredSeeds = filteredSeeds.filter((seed) =>
            seed.variety.toLowerCase().includes(variety.toLowerCase()),
        );
    }

    // Apply limit
    if (input.limit) {
        filteredSeeds = filteredSeeds.slice(0, input.limit);
    }

    return {
        seeds: filteredSeeds,
        total: mockSeeds.length,
        limit: input.limit,
    };
}
