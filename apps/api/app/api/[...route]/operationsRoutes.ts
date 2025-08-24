import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
    getOperationById,
    createEvent,
    createNotification,
    getRaisedBed,
    getEntityFormatted,
    earnSunflowers,
    knownEvents,
    getOperations
} from "@gredice/storage";
import { authValidator, AuthVariables } from "../../../lib/hono/authValidator";
import { EntityStandardized } from "./checkoutRoutes";

const cancelOperationSchema = z.object({
    operationId: z.number(),
    reason: z.string().min(1, "Cancellation reason is required")
});

const app = new Hono<{ Variables: AuthVariables }>()
    // GET / - get operations for current user
    .get(
        '/',
        describeRoute({
            description: 'Get operations for the current user',
            tags: ['Operations']
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');

            try {
                const operations = await getOperations(accountId);
                return context.json(operations);
            } catch (error) {
                console.error('Failed to get user operations:', error);
                return context.json({ error: 'Failed to get operations' }, 500);
            }
        }
    )
    // POST /cancel - cancel an operation
    .post(
        '/cancel',
        describeRoute({
            description: 'Cancel an operation',
            tags: ['Operations']
        }),
        authValidator(['user', 'admin']),
        zValidator('json', cancelOperationSchema),
        async (context) => {
            const { accountId, userId } = context.get('authContext');
            const { operationId, reason } = context.req.valid('json');

            try {
                const operation = await getOperationById(operationId);
                if (!operation) {
                    return context.json({ error: `Operation with ID ${operationId} not found.` }, 404);
                }

                // Allow if user owns the operation
                if (!operation.accountId || operation.accountId !== accountId) {
                    return context.json({ error: "You don't have permission to cancel this operation" }, 403);
                }

                // TODO: Move to cancellation disallowed status list
                // Only allow canceling new or planned operations
                if (operation.status === 'completed' ||
                    operation.status === 'failed' ||
                    operation.status === 'canceled') {
                    return context.json({ error: `Cannot cancel operation with status ${operation.status}` }, 400);
                }

                // Get operation details for notification and refund calculation
                const operationData = await getEntityFormatted<EntityStandardized>(operation.entityId);

                // TODO: Move to separate function and reuse
                // Calculate refund amount (operation price in sunflowers - multiplied by 1000 as per checkout logic)
                const refundAmount = operationData?.prices?.perOperation ?
                    Math.round(operationData.prices.perOperation * 1000) : 0;

                // TODO: Reuse logic from operation status changed to completed
                const header = "❌ Radnje je otkazana";
                let content = `Radnja **${operationData?.information?.label}** je otkazana.`;
                if (operation.raisedBedId) {
                    const raisedBed = await getRaisedBed(operation.raisedBedId);
                    if (!raisedBed) {
                        console.error(`Raised bed with ID ${operation.raisedBedId} not found.`);
                    } else {
                        const positionIndex = operation.raisedBedFieldId
                            ? raisedBed.fields.find(f => f.id === operation.raisedBedFieldId)?.positionIndex
                            : null;
                        if (typeof positionIndex === 'number') {
                            content = `Radnja **${operationData?.information?.label}** na gredici **${raisedBed.name}** za polje **${positionIndex + 1}** je otkazana.`;
                        } else {
                            content = `Radnja **${operationData?.information?.label}** na gredici **${raisedBed.name}** je otkazana.`;
                        }
                    }
                }

                // Add reason
                if (reason) {
                    content += `\nRazlog otkazivanja: ${reason}`;
                }

                // Add refund information
                if (refundAmount > 0) {
                    content += `\nSredstva su ti vraćana u iznosu od ${refundAmount} 🌻.`;
                }

                // Base promisses
                const promisses: Promise<unknown>[] = [
                    // Create cancellation event
                    createEvent(knownEvents.operations.canceledV1(operationId.toString(), {
                        canceledBy: userId,
                        reason
                    })),
                    // Create cancellation notification
                    createNotification({
                        accountId: operation.accountId,
                        gardenId: operation.gardenId,
                        raisedBedId: operation.raisedBedId,
                        header,
                        content,
                        timestamp: new Date(),
                    })
                ];

                // Refund sunflowers if applicable
                if (refundAmount > 0 && operation.accountId) {
                    promisses.push(
                        earnSunflowers(operation.accountId, refundAmount, `refund:operation:${operationId}`)
                    );
                }

                await Promise.all(promisses);

                return context.json({ success: true });
            } catch (error) {
                console.error('Failed to cancel operation:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                return context.json({ error: errorMessage }, 500);
            }
        }
    );

export default app;
