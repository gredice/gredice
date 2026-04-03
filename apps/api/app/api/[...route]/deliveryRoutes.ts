import { notifyDeliveryRequestEvent } from '@gredice/notifications';
import {
    cancelDeliveryRequest,
    createDeliveryAddress,
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
import { authSecurity, publicSecurity } from '../../../lib/docs/security';
import {
    computeAddressDistanceData,
    isAddressDistanceVerificationEnabled,
    validateDeliveryDistanceLimit,
} from '../../../lib/delivery/addressDistance';
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
    from: z.iso.datetime().optional(),
    to: z.iso.datetime().optional(),
    locationId: z.coerce.number().optional(),
});

const cancelRequestSchema = z.object({
    cancelReason: z.string().min(1).max(50),
    note: z.string().max(500).optional(),
});

function hasAddressFieldChanges(data: z.infer<typeof updateAddressSchema>) {
    return (
        typeof data.street1 === 'string' ||
        typeof data.street2 === 'string' ||
        typeof data.city === 'string' ||
        typeof data.postalCode === 'string' ||
        typeof data.countryCode === 'string'
    );
}

const app = new Hono<{ Variables: AuthVariables }>()
    // GET /addresses - list current user addresses
    .get(
        '/addresses',
        describeRoute({
            description: 'Get all delivery addresses for the current user',
            security: authSecurity,
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
            security: authSecurity,
            tags: ['Delivery'],
        }),
        authValidator(['user', 'admin']),
        zValidator('json', createAddressSchema),
        async (context) => {
            const { accountId } = context.get('authContext');
            const data = context.req.valid('json');
            const shouldVerifyDistance = isAddressDistanceVerificationEnabled();

            // Validate the address data
            const validationErrors = validateDeliveryAddress(data);
            if (validationErrors.length > 0) {
                return context.json(
                    { error: 'Validation failed', details: validationErrors },
                    400,
                );
            }

            try {
                const distanceData = shouldVerifyDistance
                    ? await computeAddressDistanceData(data)
                    : null;

                if (distanceData?.roadDistanceKm) {
                    await validateDeliveryDistanceLimit(
                        distanceData.roadDistanceKm,
                    );
                }

                const insertData: InsertDeliveryAddress = {
                    ...data,
                    ...(distanceData
                        ? {
                              ...distanceData,
                              distanceCalculatedAt: new Date(),
                          }
                        : {}),
                    accountId,
                };

                const addressId = await createDeliveryAddress(insertData);
                const newAddress = await getDeliveryAddress(
                    addressId,
                    accountId,
                );
                return context.json(newAddress, 201);
            } catch (error) {
                const details =
                    error instanceof Error ? error.message : 'Unknown error';
                return context.json(
                    {
                        error: 'Address is not eligible for delivery',
                        details,
                    },
                    400,
                );
            }
        },
    )
    // PATCH /addresses/:id - update address
    .patch(
        '/addresses/:id',
        describeRoute({
            description: 'Update a delivery address',
            security: authSecurity,
            tags: ['Delivery'],
        }),
        authValidator(['user', 'admin']),
        zValidator('param', z.object({ id: z.coerce.number() })),
        zValidator('json', updateAddressSchema),
        async (context) => {
            const { accountId } = context.get('authContext');
            const { id } = context.req.valid('param');
            const data = context.req.valid('json');
            const shouldVerifyDistance = isAddressDistanceVerificationEnabled();

            // Validate the address data
            const validationErrors = validateDeliveryAddress(data);
            if (validationErrors.length > 0) {
                return context.json(
                    { error: 'Validation failed', details: validationErrors },
                    400,
                );
            }

            const existingAddress = await getDeliveryAddress(id, accountId);
            if (!existingAddress) {
                return context.json(
                    {
                        error: 'Delivery address not found',
                    },
                    404,
                );
            }

            try {
                const distanceData = !shouldVerifyDistance
                    ? null
                    : hasAddressFieldChanges(data)
                      ? await computeAddressDistanceData({
                            street1: data.street1 ?? existingAddress.street1,
                            street2:
                                data.street2 === undefined
                                    ? (existingAddress.street2 ?? undefined)
                                    : data.street2,
                            city: data.city ?? existingAddress.city,
                            postalCode:
                                data.postalCode ?? existingAddress.postalCode,
                            countryCode:
                                data.countryCode ?? existingAddress.countryCode,
                        })
                      : {
                            latitude: existingAddress.latitude ?? null,
                            longitude: existingAddress.longitude ?? null,
                            roadDistanceKm:
                                existingAddress.roadDistanceKm ?? null,
                        };

                if (distanceData?.roadDistanceKm) {
                    await validateDeliveryDistanceLimit(
                        distanceData.roadDistanceKm,
                    );
                }

                const updateData: UpdateDeliveryAddress = {
                    id,
                    ...data,
                    ...(distanceData
                        ? {
                              ...distanceData,
                              distanceCalculatedAt: new Date(),
                          }
                        : {}),
                };

                await updateDeliveryAddress(updateData, accountId);
                const updatedAddress = await getDeliveryAddress(id, accountId);
                return context.json(updatedAddress);
            } catch (error) {
                const details =
                    error instanceof Error ? error.message : 'Unknown error';
                return context.json(
                    {
                        error: 'Address is not eligible for delivery',
                        details,
                    },
                    400,
                );
            }
        },
    )
    // DELETE /addresses/:id - soft delete address
    .delete(
        '/addresses/:id',
        describeRoute({
            description: 'Delete a delivery address',
            security: authSecurity,
            tags: ['Delivery'],
        }),
        authValidator(['user', 'admin']),
        zValidator('param', z.object({ id: z.coerce.number() })),
        async (context) => {
            const { accountId } = context.get('authContext');
            const { id } = context.req.valid('param');

            await deleteDeliveryAddress(id, accountId);
            return context.json({ success: true });
        },
    )
    // GET /pickup-locations - list pickup locations
    .get(
        '/pickup-locations',
        describeRoute({
            description: 'Get all active pickup locations',
            security: publicSecurity,
            tags: ['Delivery'],
        }),
        async (context) => {
            const locations = await getPickupLocations();
            return context.json(locations);
        },
    )
    // GET /slots - list available time slots
    .get(
        '/slots',
        describeRoute({
            description: 'Get available time slots for delivery or pickup',
            security: publicSecurity,
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

            const slots = await getTimeSlots({
                type,
                locationId,
                fromDate,
                toDate,
                status: 'scheduled', // Only return bookable slots
            });
            return context.json(slots);
        },
    )
    // GET /requests - list user's delivery requests
    .get(
        '/requests',
        describeRoute({
            description: 'Get delivery requests for the current user',
            security: authSecurity,
            tags: ['Delivery'],
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const requests = await getDeliveryRequestsWithEvents(accountId);
            return context.json(requests);
        },
    )
    // PATCH /requests/:id/cancel - cancel delivery request
    .patch(
        '/requests/:id/cancel',
        describeRoute({
            description: 'Cancel a delivery request',
            security: authSecurity,
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
                // TODO: Move to service
                // TODO: Add email notification for delivery cancellation
                await cancelDeliveryRequest(
                    id,
                    'user',
                    cancelReason,
                    note,
                    accountId,
                );
                await notifyDeliveryRequestEvent(id, 'cancelled', {
                    reason: cancelReason,
                    note,
                });
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
