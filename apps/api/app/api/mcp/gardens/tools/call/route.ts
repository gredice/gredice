import {
    createGarden,
    getAccountGardens,
    getGarden,
    type InsertGarden,
} from '@gredice/storage';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Logger } from 'next-axiom';
import { z } from 'zod';
import {
    checkMCPPermission,
    createMCPAuthError,
    extractMCPAuth,
    type MCPAuth,
} from '../../../auth';
export const dynamic = 'force-dynamic';

// Input schemas for gardens tools
const GetGardensSchema = z.object({
    userId: z.string(),
    locale: z.enum(['hr', 'en']).default('hr'),
    limit: z.number().min(1).max(100).default(50),
    offset: z.number().min(0).default(0),
});

const GetGardenSchema = z.object({
    gardenId: z.string(),
    includeActivities: z.boolean().default(true),
    locale: z.enum(['hr', 'en']).default('hr'),
});

const CreateGardenSchema = z.object({
    userId: z.string(),
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    location: z
        .object({
            city: z.string().optional(),
            region: z.string().optional(),
            coordinates: z
                .object({
                    lat: z.number(),
                    lng: z.number(),
                })
                .optional(),
        })
        .optional(),
    gardenType: z
        .enum(['outdoor', 'indoor', 'greenhouse', 'balcony'])
        .default('outdoor'),
    size: z
        .object({
            area: z.number().positive(),
            unit: z.enum(['m2', 'ha', 'ft2']).default('m2'),
        })
        .optional(),
    locale: z.enum(['hr', 'en']).default('hr'),
});

const AddPlantToGardenSchema = z.object({
    gardenId: z.string(),
    plantId: z.string(),
    sortId: z.string().optional(),
    quantity: z.number().positive().default(1),
    plantingDate: z.string(), // ISO date string
    location: z
        .object({
            section: z.string().optional(),
            row: z.number().optional(),
            position: z.number().optional(),
        })
        .optional(),
    notes: z.string().optional(),
    locale: z.enum(['hr', 'en']).default('hr'),
});

const GetGardenActivitiesSchema = z.object({
    gardenId: z.string(),
    activityType: z
        .enum([
            'planting',
            'watering',
            'fertilizing',
            'harvesting',
            'pruning',
            'weeding',
        ])
        .optional(),
    dateRange: z
        .object({
            from: z.string(), // ISO date string
            to: z.string(), // ISO date string
        })
        .optional(),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
    locale: z.enum(['hr', 'en']).default('hr'),
});

const LogGardenActivitySchema = z.object({
    gardenId: z.string(),
    plantInstanceId: z.string().optional(), // Specific plant in garden
    activityType: z.enum([
        'planting',
        'watering',
        'fertilizing',
        'harvesting',
        'pruning',
        'weeding',
        'observing',
    ]),
    description: z.string(),
    date: z.string(), // ISO date string
    duration: z.number().positive().optional(), // minutes
    weather: z
        .object({
            temperature: z.number().optional(),
            humidity: z.number().optional(),
            condition: z.enum(['sunny', 'cloudy', 'rainy', 'windy']).optional(),
        })
        .optional(),
    notes: z.string().optional(),
    locale: z.enum(['hr', 'en']).default('hr'),
});

export async function GET() {
    return NextResponse.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        server: 'gredice-mcp-gardens',
        availableTools: [
            'gardens/get-gardens',
            'gardens/get-garden',
            'gardens/create-garden',
            'gardens/add-plant-to-garden',
            'gardens/get-garden-activities',
            'gardens/log-garden-activity',
        ],
    });
}

export async function POST(request: NextRequest) {
    const logger = new Logger();
    const startTime = Date.now();
    const correlationId = crypto.randomUUID();

    try {
        // Extract and validate authentication
        const auth = await extractMCPAuth(request);

        if (!auth) {
            return NextResponse.json(
                createMCPAuthError(null, 'unauthorized', correlationId),
                { status: 401 },
            );
        }

        // Check basic gardens permission
        if (!checkMCPPermission(auth, 'gardens:read')) {
            return NextResponse.json(
                createMCPAuthError(auth, 'forbidden', correlationId),
                { status: 403 },
            );
        }

        const body = await request.json();
        const { name, arguments: args } = body.params || {};

        logger.info('mcp.gardens.tool.start', {
            toolName: name,
            correlationId,
            userId: auth.userId,
            userRole: auth.role,
            timestamp: new Date().toISOString(),
        });

        let result: unknown;

        // Route to appropriate handler based on tool name
        switch (name) {
            case 'gardens/get-gardens': {
                const getGardensInput = GetGardensSchema.parse(args);
                result = await handleGetGardens(getGardensInput, auth);
                break;
            }

            case 'gardens/get-garden': {
                const getGardenInput = GetGardenSchema.parse(args);
                result = await handleGetGarden(getGardenInput, auth);
                break;
            }

            case 'gardens/create-garden': {
                // Check write permission for creating gardens
                if (!checkMCPPermission(auth, 'gardens:write')) {
                    return NextResponse.json(
                        createMCPAuthError(auth, 'forbidden', correlationId),
                        { status: 403 },
                    );
                }

                const createGardenInput = CreateGardenSchema.parse(args);
                result = await handleCreateGarden(createGardenInput, auth);
                break;
            }

            case 'gardens/add-plant-to-garden': {
                // Check write permission for adding plants
                if (!checkMCPPermission(auth, 'gardens:write')) {
                    return NextResponse.json(
                        createMCPAuthError(auth, 'forbidden', correlationId),
                        { status: 403 },
                    );
                }

                const addPlantInput = AddPlantToGardenSchema.parse(args);
                result = await handleAddPlantToGarden(addPlantInput, auth);
                break;
            }

            case 'gardens/get-garden-activities': {
                const getActivitiesInput =
                    GetGardenActivitiesSchema.parse(args);
                result = await handleGetGardenActivities(
                    getActivitiesInput,
                    auth,
                );
                break;
            }

            case 'gardens/log-garden-activity': {
                // Check write permission for logging activities
                if (!checkMCPPermission(auth, 'gardens:write')) {
                    return NextResponse.json(
                        createMCPAuthError(auth, 'forbidden', correlationId),
                        { status: 403 },
                    );
                }

                const logActivityInput = LogGardenActivitySchema.parse(args);
                result = await handleLogGardenActivity(logActivityInput, auth);
                break;
            }

            default:
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

        const duration = Date.now() - startTime;
        logger.info('mcp.gardens.tool.success', {
            toolName: name,
            correlationId,
            duration,
            timestamp: new Date().toISOString(),
        });

        return NextResponse.json({
            jsonrpc: '2.0',
            result,
            id: body.id || null,
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        const statusCode = error instanceof z.ZodError ? 400 : 500;

        logger.error('mcp.gardens.tool.error', {
            correlationId,
            duration,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString(),
        });

        return NextResponse.json(
            {
                jsonrpc: '2.0',
                error: {
                    code: error instanceof z.ZodError ? -32602 : -32603,
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Tool execution failed',
                    data:
                        error instanceof z.ZodError ? error.issues : undefined,
                },
                id: null,
            },
            { status: statusCode },
        );
    }
}

// Tool handlers (placeholder implementations - ready for @gredice/storage integration)
async function handleGetGardens(
    input: z.infer<typeof GetGardensSchema>,
    auth: MCPAuth,
) {
    // Get real gardens from database filtered by authenticated user
    const authenticatedUserId = auth.userId;

    try {
        // Get all gardens for the authenticated user
        const userGardens = await getAccountGardens(authenticatedUserId);

        // Transform to MCP response format with Croatian data
        const gardens = userGardens.map((garden) => {
            // Calculate plants count from raised beds
            const plantsCount =
                garden.raisedBeds?.reduce((count, bed) => {
                    return (
                        count +
                        (bed.fields?.filter(
                            (field) =>
                                field.plantSortId !== null && field.active,
                        ).length || 0)
                    );
                }, 0) || 0;

            // Find most recent activity
            const lastActivity = garden.raisedBeds?.reduce((latest, bed) => {
                const bedLatest = bed.fields?.reduce((fieldLatest, field) => {
                    return field.updatedAt > fieldLatest
                        ? field.updatedAt
                        : fieldLatest;
                }, new Date(0));
                return bedLatest && bedLatest > latest ? bedLatest : latest;
            }, new Date(0));

            return {
                id: garden.id.toString(),
                userId: authenticatedUserId,
                name: garden.name || 'Moj vrt',
                description: `Vrt s ${garden.raisedBeds?.length || 0} podignutih gredica`,
                gardenType: 'outdoor', // Default type - could be stored in database
                size: {
                    area: garden.raisedBeds?.length
                        ? garden.raisedBeds.length * 2
                        : 1,
                    unit: 'm2',
                },
                location: {
                    city: 'Zagreb', // Default - could get from user data
                    region: 'Grad Zagreb',
                    coordinates: {
                        lat: 45.815, // Zagreb default coordinates
                        lng: 15.9819,
                    },
                },
                createdAt: garden.createdAt.toISOString(),
                plantsCount,
                lastActivity:
                    lastActivity && lastActivity > new Date(0)
                        ? lastActivity.toISOString()
                        : null,
                raisedBedsCount: garden.raisedBeds?.length || 0,
            };
        });

        // Apply pagination
        const total = gardens.length;
        const paginatedGardens = gardens.slice(
            input.offset,
            input.offset + input.limit,
        );

        return {
            gardens: paginatedGardens,
            total,
            limit: input.limit,
            offset: input.offset,
            userId: authenticatedUserId,
            locale: input.locale,
        };
    } catch (error) {
        console.error('Error fetching user gardens:', error);
        return {
            gardens: [],
            total: 0,
            limit: input.limit,
            offset: input.offset,
            userId: authenticatedUserId,
            locale: input.locale,
            error: 'Greška pri dohvaćanju vrtova',
        };
    }
}

async function handleGetGarden(
    input: z.infer<typeof GetGardenSchema>,
    auth: MCPAuth,
) {
    // Get real garden data from database
    try {
        const gardenId = parseInt(input.gardenId, 10);
        const garden = await getGarden(gardenId);

        if (!garden) {
            return {
                error: 'Vrt nije pronađen',
                id: input.gardenId,
                userId: auth.userId,
                locale: input.locale,
            };
        }

        // Security check - ensure user owns this garden
        if (garden.accountId !== auth.userId) {
            return {
                error: 'Nemate dozvolu za pristup ovom vrtu',
                id: input.gardenId,
                userId: auth.userId,
                locale: input.locale,
            };
        }

        // Transform raised bed fields into plants array
        const plants =
            garden.raisedBeds?.flatMap(
                (bed) =>
                    bed.fields
                        ?.filter((field) => field.active && field.plantSortId)
                        .map((field) => ({
                            id: `field-${bed.id}-${field.positionIndex}`,
                            plantId: field.plantSortId?.toString() || 'unknown',
                            plantName: 'Biljka', // Would need to fetch from plant data
                            sortId: field.plantSortId?.toString() || 'unknown',
                            sortName: 'Sorta', // Would need to fetch from sort data
                            quantity: 1,
                            plantingDate:
                                field.plantSowDate?.toISOString() ||
                                field.plantScheduledDate?.toISOString(),
                            location: {
                                section: bed.name || `Gredica ${bed.id}`,
                                row: Math.floor(field.positionIndex / 6) + 1,
                                position: (field.positionIndex % 6) + 1,
                            },
                            status: field.plantStatus || 'unknown',
                            expectedHarvest:
                                field.plantReadyDate?.toISOString(),
                            notes: `Pozicija ${field.positionIndex} u gredici "${bed.name}"`,
                        })) || [],
            ) || [];

        // Get recent activities if requested
        let activities;
        if (input.includeActivities) {
            // TODO: Implement actual activity fetching from events/operations
            activities = [
                {
                    id: 'activity-recent',
                    type: 'maintenance',
                    description: 'Održavanje vrtnih gredica',
                    date: new Date().toISOString(),
                    duration: 30,
                    notes: 'Redovna njega biljaka u vrtu',
                },
            ];
        }

        return {
            id: garden.id.toString(),
            userId: garden.accountId,
            name: garden.name || 'Moj vrt',
            description: `Vrt s ${garden.raisedBeds?.length || 0} podignutih gredica i ${plants.length} biljaka`,
            gardenType: 'outdoor', // Default type
            size: {
                area: garden.raisedBeds?.length
                    ? garden.raisedBeds.length * 2
                    : 1,
                unit: 'm2',
            },
            location: {
                city: 'Zagreb',
                region: 'Grad Zagreb',
                coordinates: { lat: 45.815, lng: 15.9819 },
            },
            createdAt: garden.createdAt.toISOString(),
            plants,
            activities,
            raisedBedsCount: garden.raisedBeds?.length || 0,
            locale: input.locale,
        };
    } catch (error) {
        console.error('Error fetching garden:', error);
        return {
            error: 'Greška pri dohvaćanju vrta',
            id: input.gardenId,
            userId: auth.userId,
            locale: input.locale,
        };
    }
}

async function handleCreateGarden(
    input: z.infer<typeof CreateGardenSchema>,
    auth: MCPAuth,
) {
    // Create real garden in database
    try {
        // Get default farm (first available farm)
        const { getFarms } = await import('@gredice/storage');
        const farms = await getFarms();
        if (farms.length === 0) {
            return {
                success: false,
                error:
                    input.locale === 'hr'
                        ? 'Nema dostupnih farmi'
                        : 'No farms available',
            };
        }

        const gardenData: InsertGarden = {
            name: input.name,
            accountId: auth.userId, // Use authenticated user ID
            farmId: farms[0].id, // Use first available farm
        };

        const createdGardenId = await createGarden(gardenData);

        return {
            success: true,
            garden: {
                id: createdGardenId.toString(),
                userId: auth.userId,
                name: input.name,
                description: input.description || `Novi vrt "${input.name}"`,
                gardenType: input.gardenType || 'outdoor',
                size: input.size || { area: 1, unit: 'm2' },
                location: input.location || {
                    city: 'Zagreb',
                    region: 'Grad Zagreb',
                    coordinates: { lat: 45.815, lng: 15.9819 },
                },
                createdAt: new Date().toISOString(),
                plantsCount: 0,
                lastActivity: null,
                raisedBedsCount: 0,
            },
            message:
                input.locale === 'hr'
                    ? `Vrt "${input.name}" je uspješno stvoren!`
                    : `Garden "${input.name}" created successfully!`,
        };
    } catch (error) {
        console.error('Error creating garden:', error);
        return {
            success: false,
            error:
                input.locale === 'hr'
                    ? 'Greška pri stvaranju vrta'
                    : 'Error creating garden',
        };
    }
}

async function handleAddPlantToGarden(
    input: z.infer<typeof AddPlantToGardenSchema>,
    auth: MCPAuth,
) {
    // TODO: Implement with actual database insert
    const plantInstance = {
        id: `plant-instance-${Date.now()}`,
        gardenId: input.gardenId,
        plantId: input.plantId,
        sortId: input.sortId,
        quantity: input.quantity,
        plantingDate: input.plantingDate,
        location: input.location,
        status: 'planted',
        notes: input.notes,
        createdAt: new Date().toISOString(),
    };

    return {
        success: true,
        plantInstance,
        message:
            input.locale === 'hr'
                ? 'Biljka je uspješno dodana u vrt!'
                : 'Plant added to garden successfully!',
    };
}

async function handleGetGardenActivities(
    input: z.infer<typeof GetGardenActivitiesSchema>,
    auth: MCPAuth,
) {
    // TODO: Implement with actual database query with filtering
    const mockActivities = [
        {
            id: 'activity-1',
            gardenId: input.gardenId,
            type: 'watering',
            description: 'Zalijevanje svih biljaka u vrtu',
            date: '2025-09-26T14:30:00Z',
            duration: 15,
            weather: { temperature: 24, condition: 'sunny' },
            notes: 'Sve biljke dobro zalijevane, tlo je vlažno.',
        },
        {
            id: 'activity-2',
            gardenId: input.gardenId,
            type: 'harvesting',
            description: 'Berba zrele salate',
            date: '2025-09-25T08:15:00Z',
            duration: 20,
            weather: { temperature: 18, condition: 'cloudy' },
            plantInstanceId: 'plant-instance-2',
            notes: 'Ubrano 2 kg svježe salate.',
        },
        {
            id: 'activity-3',
            gardenId: input.gardenId,
            type: 'fertilizing',
            description: 'Gnojidba rajčica organskim gnojivom',
            date: '2025-09-24T10:00:00Z',
            duration: 30,
            weather: { temperature: 22, condition: 'cloudy' },
            plantInstanceId: 'plant-instance-1',
            notes: 'Dodano kompostno gnojivo oko biljaka.',
        },
        {
            id: 'activity-4',
            gardenId: input.gardenId,
            type: 'planting',
            description: 'Sadnja novih sadnica rajčica',
            date: '2025-04-20T09:30:00Z',
            duration: 45,
            weather: { temperature: 16, condition: 'sunny' },
            plantInstanceId: 'plant-instance-1',
            notes: 'Posađene 3 sadnice Cherry rajčice.',
        },
    ];

    let filteredActivities = mockActivities;

    // Filter by activity type if provided
    if (input.activityType) {
        filteredActivities = filteredActivities.filter(
            (activity) => activity.type === input.activityType,
        );
    }

    // Filter by date range if provided
    if (input.dateRange) {
        const fromDate = new Date(input.dateRange.from);
        const toDate = new Date(input.dateRange.to);
        filteredActivities = filteredActivities.filter((activity) => {
            const activityDate = new Date(activity.date);
            return activityDate >= fromDate && activityDate <= toDate;
        });
    }

    // Apply pagination
    const paginatedActivities = filteredActivities.slice(
        input.offset,
        input.offset + input.limit,
    );

    return {
        activities: paginatedActivities,
        total: filteredActivities.length,
        limit: input.limit,
        offset: input.offset,
        gardenId: input.gardenId,
        filters: {
            activityType: input.activityType,
            dateRange: input.dateRange,
        },
        locale: input.locale,
    };
}

async function handleLogGardenActivity(
    input: z.infer<typeof LogGardenActivitySchema>,
    auth: MCPAuth,
) {
    // TODO: Implement with actual database insert
    const newActivity = {
        id: `activity-${Date.now()}`,
        gardenId: input.gardenId,
        plantInstanceId: input.plantInstanceId,
        type: input.activityType,
        description: input.description,
        date: input.date,
        duration: input.duration,
        weather: input.weather,
        notes: input.notes,
        createdAt: new Date().toISOString(),
    };

    return {
        success: true,
        activity: newActivity,
        message:
            input.locale === 'hr'
                ? 'Aktivnost je uspješno zabilježena!'
                : 'Activity logged successfully!',
    };
}
