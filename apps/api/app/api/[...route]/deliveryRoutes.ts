import {
    cancelDeliveryRequest,
    createDeliveryAddress,
    createDeliveryRequest,
    deleteDeliveryAddress,
    getDeliveryAddress,
    getDeliveryAddresses,
    getDeliveryRequestsWithEvents,
    getPickupLocations,
    getTimeSlots,
    type InsertDeliveryAddress,
    type UpdateDeliveryAddress,
    updateDeliveryAddress,
    validateDeliveryAddress,
} from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import {
    createDeliveryRequestCalendarEvent,
    deleteDeliveryRequestCalendarEvent,
} from '../../../lib/delivery/calendarSync';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';

// Validation schemas
const createAddressSchema = z.object({
    label: z.string().min(1).max(100),
    contactName: z.string().min(1).max(100),
    phone: z.string().min(1).max(20),
    street1: z.string().min(1).max(200),
    street2: z.string().max(200).optional(),
    city: z.string().min(1).max(100),
    postalCode: z.string().min(3).max(10),
    countryCode: z.string().length(2).default('HR'),
    isDefault: z.boolean().default(false),
});

const updateAddressSchema = z.object({
    label: z.string().min(1).max(100).optional(),
    contactName: z.string().min(1).max(100).optional(),
    phone: z.string().min(1).max(20).optional(),
    street1: z.string().min(1).max(200).optional(),
    street2: z.string().max(200).optional(),
    city: z.string().min(1).max(100).optional(),
    postalCode: z.string().min(3).max(10).optional(),
    countryCode: z.string().length(2).optional(),
    isDefault: z.boolean().optional(),
});

const slotsQuerySchema = z.object({
    type: z.enum(['delivery', 'pickup']).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    locationId: z.coerce.number().optional(),
});

const createRequestSchema = z.object({
    operationId: z.number(),
    slotId: z.number(),
    mode: z.enum(['delivery', 'pickup']),
    addressId: z.number().optional(),
    locationId: z.number().optional(),
    notes: z.string().max(500).optional(),
});

const cancelRequestSchema = z.object({
    cancelReason: z.string().min(1).max(50),
    note: z.string().max(500).optional(),
});

const app = new Hono<{ Variables: AuthVariables }>()
    // GET /addresses - list current user addresses
    .get(
        '/addresses',
        describeRoute({
            description: 'Get all delivery addresses for the current user',
            tags: ['Delivery'],
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const addresses = await getDeliveryAddresses(accountId);
            return context.json(addresses);
        },
    )
    // POST /addresses - create address
    .post(
        '/addresses',
        describeRoute({
            description: 'Create a new delivery address',
            tags: ['Delivery'],
        }),
        authValidator(['user', 'admin']),
        zValidator('json', createAddressSchema),
        async (context) => {
            const { accountId } = context.get('authContext');
            const data = context.req.valid('json');

            // Validate the address data
            const validationErrors = validateDeliveryAddress(data);
            if (validationErrors.length > 0) {
                return context.json(
                    { error: 'Validation failed', details: validationErrors },
                    400,
                );
            }

            const insertData: InsertDeliveryAddress = {
                ...data,
                accountId,
            };

            try {
                const addressId = await createDeliveryAddress(insertData);
                const newAddress = await getDeliveryAddress(
                    addressId,
                    accountId,
                );
                return context.json(newAddress, 201);
            } catch (error) {
                console.error('Failed to create delivery address:', error);
                return context.json({ error: 'Failed to create address' }, 500);
            }
        },
    )
    // PATCH /addresses/:id - update address
    .patch(
        '/addresses/:id',
        describeRoute({
            description: 'Update a delivery address',
            tags: ['Delivery'],
        }),
        authValidator(['user', 'admin']),
        zValidator('param', z.object({ id: z.coerce.number() })),
        zValidator('json', updateAddressSchema),
        async (context) => {
            const { accountId } = context.get('authContext');
            const { id } = context.req.valid('param');
            const data = context.req.valid('json');

            // Validate the address data
            const validationErrors = validateDeliveryAddress(data);
            if (validationErrors.length > 0) {
                return context.json(
                    { error: 'Validation failed', details: validationErrors },
                    400,
                );
            }

            const updateData: UpdateDeliveryAddress = {
                id,
                ...data,
            };

            try {
                await updateDeliveryAddress(updateData, accountId);
                const updatedAddress = await getDeliveryAddress(id, accountId);
                return context.json(updatedAddress);
            } catch (error) {
                console.error('Failed to update delivery address:', error);
                return context.json({ error: 'Failed to update address' }, 500);
            }
        },
    )
    // DELETE /addresses/:id - soft delete address
    .delete(
        '/addresses/:id',
        describeRoute({
            description: 'Delete a delivery address',
            tags: ['Delivery'],
        }),
        authValidator(['user', 'admin']),
        zValidator('param', z.object({ id: z.coerce.number() })),
        async (context) => {
            const { accountId } = context.get('authContext');
            const { id } = context.req.valid('param');

            try {
                await deleteDeliveryAddress(id, accountId);
                return context.json({ success: true });
            } catch (error) {
                console.error('Failed to delete delivery address:', error);
                return context.json({ error: 'Failed to delete address' }, 500);
            }
        },
    )
    // GET /pickup-locations - list pickup locations
    .get(
        '/pickup-locations',
        describeRoute({
            description: 'Get all active pickup locations',
            tags: ['Delivery'],
        }),
        async (context) => {
            try {
                const locations = await getPickupLocations();
                return context.json(locations);
            } catch (error) {
                console.error('Failed to get pickup locations:', error);
                return context.json(
                    { error: 'Failed to get pickup locations' },
                    500,
                );
            }
        },
    )
    // GET /slots - list available time slots
    .get(
        '/slots',
        describeRoute({
            description: 'Get available time slots for delivery or pickup',
            tags: ['Delivery'],
        }),
        zValidator('query', slotsQuerySchema),
        async (context) => {
            const { type, from, to, locationId } = context.req.valid('query');

            // Default to next 14 days if no date range provided
            const fromDate = from ? new Date(from) : new Date();
            const toDate = to
                ? new Date(to)
                : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

            try {
                const slots = await getTimeSlots({
                    type,
                    locationId,
                    fromDate,
                    toDate,
                    status: 'scheduled', // Only return bookable slots
                });
                return context.json(slots);
            } catch (error) {
                console.error('Failed to get time slots:', error);
                return context.json({ error: 'Failed to get time slots' }, 500);
            }
        },
    )
    // GET /requests - list user's delivery requests
    .get(
        '/requests',
        describeRoute({
            description: 'Get delivery requests for the current user',
            tags: ['Delivery'],
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');

            try {
                const requests = await getDeliveryRequestsWithEvents(accountId);
                return context.json(requests);
            } catch (error) {
                console.error('Failed to get delivery requests:', error);
                return context.json(
                    { error: 'Failed to get delivery requests' },
                    500,
                );
            }
        },
    )
    // POST /requests - create delivery request
    .post(
        '/requests',
        describeRoute({
            description: 'Create a new delivery request',
            tags: ['Delivery'],
        }),
        authValidator(['user', 'admin']),
        zValidator('json', createRequestSchema),
        async (context) => {
            const { accountId } = context.get('authContext');
            const data = context.req.valid('json');

            try {
                const requestId = await createDeliveryRequest({
                    ...data,
                    accountId: accountId,
                });

                void createDeliveryRequestCalendarEvent(requestId);

                return context.json({ id: requestId }, 201);
            } catch (error) {
                console.error('Failed to create delivery request:', error);
                return context.json(
                    {
                        error: 'Failed to create delivery request',
                        details:
                            error instanceof Error
                                ? error.message
                                : 'Unknown error',
                    },
                    500,
                );
            }
        },
    )
    // PATCH /requests/:id/cancel - cancel delivery request
    .patch(
        '/requests/:id/cancel',
        describeRoute({
            description: 'Cancel a delivery request',
            tags: ['Delivery'],
        }),
        authValidator(['user', 'admin']),
        zValidator('param', z.object({ id: z.string().uuid() })),
        zValidator('json', cancelRequestSchema),
        async (context) => {
            const { accountId } = context.get('authContext');
            const { id } = context.req.valid('param');
            const { cancelReason, note } = context.req.valid('json');

            try {
                await cancelDeliveryRequest(
                    id,
                    'user',
                    cancelReason,
                    note,
                    accountId,
                );

                void deleteDeliveryRequestCalendarEvent(id);

                return context.json({ success: true });
            } catch (error) {
                console.error('Failed to cancel delivery request:', error);
                const errorMessage =
                    error instanceof Error ? error.message : 'Unknown error';

                // Handle specific error cases
                if (errorMessage.includes('cutoff time has passed')) {
                    return context.json(
                        { error: 'CUTOFF_EXPIRED', message: errorMessage },
                        400,
                    );
                }

                return context.json(
                    {
                        error: 'Failed to cancel delivery request',
                        details: errorMessage,
                    },
                    500,
                );
            }
        },
    );

export default app;
