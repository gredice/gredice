import {
    getAccountGardens,
    getGarden,
    getOperations,
    getRaisedBedAiHistoryEntries,
} from '@gredice/storage';
import { z } from 'zod';

type McpAuthContext = {
    accountId: string;
    userId: string;
    role: string;
};

const GardenIdSchema = z.coerce.number().int().positive();

const ListGardensSchema = z.object({
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
});

const GardenScopedSchema = z.object({
    gardenId: GardenIdSchema,
});

const RaisedBedScopedSchema = z.object({
    gardenId: GardenIdSchema,
    raisedBedId: z.coerce.number().int().positive(),
});

const GetRaisedBedFieldsSchema = RaisedBedScopedSchema;

const GetRaisedBedAiHistorySchema = RaisedBedScopedSchema.extend({
    limit: z.number().int().min(1).max(20).default(5),
});

const GetGardenOperationsSchema = z.object({
    gardenId: GardenIdSchema,
    raisedBedId: z.coerce.number().int().positive().optional(),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
});

async function getOwnedGardenOrThrow(auth: McpAuthContext, gardenId: number) {
    const garden = await getGarden(gardenId);
    if (!garden || garden.accountId !== auth.accountId) {
        throw new Error('Garden not found for authenticated account');
    }

    return garden;
}

export async function executeGardenTool(
    name: string,
    args: unknown,
    auth: McpAuthContext,
) {
    switch (name) {
        case 'gardens/list-gardens': {
            const input = ListGardensSchema.parse(args ?? {});
            const gardens = await getAccountGardens(auth.accountId);
            return {
                items: gardens
                    .slice(input.offset, input.offset + input.limit)
                    .map((garden) => ({
                        id: garden.id,
                        name: garden.name,
                        isSandbox: garden.isSandbox,
                        createdAt: garden.createdAt,
                        raisedBedsCount: garden.raisedBeds.length,
                    })),
                total: gardens.length,
                limit: input.limit,
                offset: input.offset,
            };
        }
        case 'gardens/list-raised-beds': {
            const input = GardenScopedSchema.parse(args);
            const garden = await getOwnedGardenOrThrow(auth, input.gardenId);
            return {
                gardenId: garden.id,
                gardenName: garden.name,
                items: garden.raisedBeds.map((bed) => ({
                    id: bed.id,
                    name: bed.name,
                    physicalId: bed.physicalId,
                    status: bed.status,
                    weedState: bed.weedState,
                    fieldsCount: bed.fields.length,
                    activeFieldsCount: bed.fields.filter(
                        (field) => field.active,
                    ).length,
                })),
            };
        }
        case 'gardens/get-raised-bed-fields': {
            const input = GetRaisedBedFieldsSchema.parse(args);
            const garden = await getOwnedGardenOrThrow(auth, input.gardenId);
            const raisedBed = garden.raisedBeds.find(
                (bed) => bed.id === input.raisedBedId,
            );
            if (!raisedBed) {
                throw new Error('Raised bed not found in garden');
            }

            return {
                gardenId: garden.id,
                raisedBedId: raisedBed.id,
                raisedBedName: raisedBed.name,
                status: raisedBed.status,
                weedState: raisedBed.weedState,
                items: raisedBed.fields.map((field) => ({
                    id: field.id,
                    positionIndex: field.positionIndex,
                    active: field.active,
                    plantSortId: field.plantSortId,
                    plantStatus: field.plantStatus,
                    plantScheduledDate: field.plantScheduledDate,
                    plantSowDate: field.plantSowDate,
                    plantGrowthDate: field.plantGrowthDate,
                    plantReadyDate: field.plantReadyDate,
                    sowingLocation: field.sowingLocation,
                    toBeRemoved: field.toBeRemoved,
                })),
            };
        }
        case 'gardens/list-operations': {
            const input = GetGardenOperationsSchema.parse(args);
            const garden = await getOwnedGardenOrThrow(auth, input.gardenId);
            const operations = await getOperations(
                auth.accountId,
                garden.id,
                input.raisedBedId,
            );
            const sliced = operations.slice(
                input.offset,
                input.offset + input.limit,
            );
            return {
                gardenId: garden.id,
                items: sliced.map((operation) => ({
                    id: operation.id,
                    status: operation.status,
                    entityId: operation.entityId,
                    entityTypeName: operation.entityTypeName,
                    gardenId: operation.gardenId,
                    raisedBedId: operation.raisedBedId,
                    raisedBedFieldId: operation.raisedBedFieldId,
                    scheduledDate: operation.scheduledDate,
                    completedAt: operation.completedAt,
                    createdAt: operation.createdAt,
                })),
                total: operations.length,
                limit: input.limit,
                offset: input.offset,
            };
        }
        case 'gardens/get-lifecycle-context': {
            const input = GardenScopedSchema.parse(args);
            const garden = await getOwnedGardenOrThrow(auth, input.gardenId);
            const activeFields = garden.raisedBeds
                .flatMap((bed) => bed.fields)
                .filter((field) => field.active && field.plantSortId);
            return {
                gardenId: garden.id,
                gardenName: garden.name,
                raisedBedsCount: garden.raisedBeds.length,
                activePlantFieldsCount: activeFields.length,
                hasLifecycleActivity: activeFields.length > 0,
            };
        }
        case 'gardens/get-raised-bed-ai-history': {
            const input = GetRaisedBedAiHistorySchema.parse(args);
            const garden = await getOwnedGardenOrThrow(auth, input.gardenId);
            const raisedBed = garden.raisedBeds.find(
                (bed) => bed.id === input.raisedBedId,
            );
            if (!raisedBed) {
                throw new Error('Raised bed not found in garden');
            }

            const entries = await getRaisedBedAiHistoryEntries(raisedBed.id);
            return {
                gardenId: garden.id,
                raisedBedId: raisedBed.id,
                items: entries.slice(0, input.limit),
            };
        }
        default:
            throw new Error(`Method not found: ${name}`);
    }
}
