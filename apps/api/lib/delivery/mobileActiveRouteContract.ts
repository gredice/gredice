import { z } from 'zod';

export const deliveryMobileRouteScope = 'delivery:route:read';
export const deliveryMobileAudience = 'delivery-android';
export const deliveryMobileSchemaVersion = 1 as const;
export const maximumDeliveryMobileStops = 5;

export const deliveryMobileStopSchema = z
    .object({
        navigationId: z.string().min(1).max(96),
        kind: z.enum(['pickup', 'delivery']),
        sequence: z.number().int().positive(),
        actionState: z.enum(['current', 'upcoming']),
        label: z.string().min(1).max(80),
        address: z.string().min(1).max(300),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        estimatedArrivalAt: z.iso.datetime().nullable(),
        travelSeconds: z.number().int().nonnegative().nullable(),
        distanceMeters: z.number().int().nonnegative().nullable(),
    })
    .strict();

export const deliveryMobileRouteSchema = z
    .object({
        id: z.string().min(1).max(128),
        revision: z.number().int().nonnegative(),
        state: z.literal('active'),
        reroutePending: z.boolean(),
        currentNavigationId: z.string().min(1).max(96).nullable(),
        stops: z
            .array(deliveryMobileStopSchema)
            .max(maximumDeliveryMobileStops),
    })
    .strict();

export const deliveryMobileActiveRouteResponseSchema = z
    .object({
        schemaVersion: z.literal(deliveryMobileSchemaVersion),
        generatedAt: z.iso.datetime(),
        route: deliveryMobileRouteSchema.nullable(),
    })
    .strict();

export const deliveryMobileErrorCodeSchema = z.enum([
    'ANDROID_AUTO_DISABLED',
    'SESSION_REQUIRED',
    'DELIVERY_ROLE_REQUIRED',
    'ROUTE_TEMPORARILY_UNAVAILABLE',
]);

export const deliveryMobileErrorResponseSchema = z
    .object({
        error: z.string().min(1),
        code: deliveryMobileErrorCodeSchema,
    })
    .strict();

export type DeliveryMobileActiveRouteResponse = z.infer<
    typeof deliveryMobileActiveRouteResponseSchema
>;
export type DeliveryMobileStop = z.infer<typeof deliveryMobileStopSchema>;
