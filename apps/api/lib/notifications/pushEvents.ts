import { z } from 'zod';

const pushEventActionSchema = z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9:_-]+$/u, 'Invalid notification action key')
    .optional();

const optionalEventTextSchema = z.string().trim().min(1).max(128).optional();

export const pushNotificationEventSchema = z.object({
    action: pushEventActionSchema,
    at: z.string().datetime({ offset: true }).optional(),
    campaignId: optionalEventTextSchema,
    category: optionalEventTextSchema,
    deliveryAttemptId: z.number().int().positive().optional(),
    notificationId: z.string().trim().min(1).max(128),
    type: z.enum(['clicked', 'dismissed']),
});

export type PushNotificationEvent = z.infer<typeof pushNotificationEventSchema>;

export function pushNotificationEventMetadata(event: PushNotificationEvent) {
    return {
        action: event.action,
        campaignId: event.campaignId,
        category: event.category,
        source: 'service_worker',
    };
}
