import { getEntitiesFormatted } from '@gredice/storage';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Logger } from 'next-axiom';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json({
        jsonrpc: '2.0',
        result: {
            protocolVersion: '2024-11-05',
            capabilities: {
                tools: {
                    listChanged: false,
                },
                resources: {},
                prompts: {},
            },
            serverInfo: {
                name: 'gredice-mcp-directories',
                version: '1.0.0',
                description: 'Croatian plant & botanical data directory',
            },
        },
    });
}

export async function POST(request: NextRequest) {
    const logger = new Logger();

    try {
        const body = await request.json();
        const { method } = body;

        logger.info('mcp.directories.request', {
            method,
            timestamp: new Date().toISOString(),
        });

        switch (method) {
            case 'initialize':
                return NextResponse.json({
                    jsonrpc: '2.0',
                    result: {
                        protocolVersion: '2024-11-05',
                        capabilities: {
                            tools: {
                                listChanged: false,
                            },
                            resources: {},
                            prompts: {},
                        },
                        serverInfo: {
                            name: 'gredice-mcp-directories',
                            version: '1.0.0',
                        },
                    },
                    id: body.id,
                });

            case 'tools/list':
                return NextResponse.json({
                    jsonrpc: '2.0',
                    result: {
                        tools: [
                            {
                                name: 'directories-get-plants',
                                description:
                                    'Get Croatian plant catalog with attributes and calendar data',
                                inputSchema: {
                                    type: 'object',
                                    properties: {
                                        limit: {
                                            type: 'number',
                                            minimum: 1,
                                            maximum: 1000,
                                            default: 100,
                                        },
                                        offset: {
                                            type: 'number',
                                            minimum: 0,
                                            default: 0,
                                        },
                                        category: {
                                            type: 'string',
                                            description:
                                                'Plant category filter',
                                        },
                                    },
                                },
                            },
                            {
                                name: 'directories-get-plant',
                                description:
                                    'Get detailed information for a specific plant',
                                inputSchema: {
                                    type: 'object',
                                    properties: {
                                        plantName: {
                                            type: 'string',
                                            description:
                                                'Plant name to search for',
                                        },
                                        includeSorts: {
                                            type: 'boolean',
                                            default: false,
                                        },
                                    },
                                    required: ['plantName'],
                                },
                            },
                            {
                                name: 'directories-search-entities',
                                description:
                                    'Search across plant, operation and seed entities',
                                inputSchema: {
                                    type: 'object',
                                    properties: {
                                        query: {
                                            type: 'string',
                                            description: 'Search query',
                                        },
                                        limit: {
                                            type: 'number',
                                            minimum: 1,
                                            maximum: 100,
                                            default: 20,
                                        },
                                    },
                                    required: ['query'],
                                },
                            },
                        ],
                    },
                    id: body.id,
                });

            case 'prompts/list':
                // VSCode requests available prompts - return empty list for now
                return NextResponse.json({
                    jsonrpc: '2.0',
                    result: {
                        prompts: [],
                    },
                    id: body.id,
                });

            case 'notifications/initialized':
                // Client has finished initializing - acknowledge
                return NextResponse.json({
                    jsonrpc: '2.0',
                    result: null,
                    id: body.id,
                });

            case 'resources/list':
                // Return list of available resources
                return NextResponse.json({
                    jsonrpc: '2.0',
                    result: {
                        resources: [],
                    },
                    id: body.id,
                });

            case 'resources/templates/list':
                // Return list of available resource templates
                return NextResponse.json({
                    jsonrpc: '2.0',
                    result: {
                        resourceTemplates: [],
                    },
                    id: body.id,
                });

            case 'tools/call': {
                // Inline tool execution (no subroute fetch)
                const startTime = Date.now();
                const correlationId = crypto.randomUUID();

                const { name, arguments: args } = body.params || {};

                logger.info('mcp.directories.tool.start', {
                    toolName: name,
                    correlationId,
                    timestamp: new Date().toISOString(),
                });

                try {
                    let result: unknown;

                    // Support both hyphen and slash naming just in case
                    switch (name) {
                        case 'directories-get-plants':
                        case 'directories/get-plants': {
                            const input = GetPlantsSchema.parse(args);
                            result = await handleGetPlants(input);
                            break;
                        }
                        case 'directories-get-plant':
                        case 'directories/get-plant': {
                            const input = GetPlantSchema.parse(args);
                            result = await handleGetPlant(input);
                            break;
                        }
                        case 'directories-search-entities':
                        case 'directories/search-entities': {
                            const input = SearchEntitiesSchema.parse(args);
                            result = await handleSearchEntities(input);
                            break;
                        }
                        default: {
                            logger.error('mcp.directories.tool.error', {
                                correlationId,
                                duration: Date.now() - startTime,
                                error: `Unknown tool: ${name as string}`,
                                timestamp: new Date().toISOString(),
                            });

                            return NextResponse.json(
                                {
                                    jsonrpc: '2.0',
                                    error: {
                                        code: -32601,
                                        message: `Method not found: ${name as string}`,
                                    },
                                    id: body.id ?? correlationId,
                                },
                                { status: 400 },
                            );
                        }
                    }

                    logger.info('mcp.directories.tool.success', {
                        toolName: name,
                        correlationId,
                        duration: Date.now() - startTime,
                        timestamp: new Date().toISOString(),
                    });

                    return NextResponse.json({
                        jsonrpc: '2.0',
                        result,
                        id: body.id ?? correlationId,
                    });
                } catch (err) {
                    const statusCode = err instanceof z.ZodError ? 400 : 500;

                    logger.error('mcp.directories.tool.error', {
                        correlationId,
                        duration: Date.now() - startTime,
                        error:
                            err instanceof Error
                                ? err.message
                                : 'Unknown error',
                        timestamp: new Date().toISOString(),
                    });

                    return NextResponse.json(
                        {
                            jsonrpc: '2.0',
                            error: {
                                code:
                                    err instanceof z.ZodError ? -32602 : -32603,
                                message:
                                    err instanceof z.ZodError
                                        ? 'Invalid params'
                                        : err instanceof Error
                                          ? err.message
                                          : 'Tool execution failed',
                                data:
                                    err instanceof z.ZodError
                                        ? err.issues
                                        : undefined,
                            },
                            id: body.id ?? correlationId,
                        },
                        { status: statusCode },
                    );
                }
            }

            default:
                return NextResponse.json(
                    {
                        jsonrpc: '2.0',
                        error: {
                            code: -32601,
                            message: `Method not found: ${method}`,
                        },
                        id: body.id,
                    },
                    { status: 400 },
                );
        }
    } catch (error) {
        console.error('MCP Directories POST error:', error);
        logger.error('mcp.directories.error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
        });

        return NextResponse.json(
            {
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal error',
                },
            },
            { status: 500 },
        );
    }
}

// =============================
// Inline tool schemas and handlers
// =============================

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
        category?: string;
        difficulty?: string;
        season?: unknown;
        plantingMonths?: unknown;
        harvestMonths?: unknown;
        sowingMonths?: unknown;
        transplantingMonths?: unknown;
        watering?: string;
        sunlight?: string;
        soil?: string;
        temperature?: string;
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

// Input schemas
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

// Handlers (adapted from tools/call subroute)
async function handleGetPlants(input: z.infer<typeof GetPlantsSchema>) {
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
            const plantId = plant.id;
            const plantName = plant.information?.name;
            const plantSorts = allSorts.filter((sort) => {
                const attrPlantId =
                    typeof sort.attributes?.['plantId'] === 'number'
                        ? (sort.attributes?.['plantId'] as number)
                        : undefined;
                return (
                    sort.information?.plant?.id === plantId ||
                    attrPlantId === plantId ||
                    sort.information?.plant?.information?.name === plantName
                );
            });

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
    // Placeholder search implementation
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
