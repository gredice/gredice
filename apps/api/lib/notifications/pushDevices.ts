import type { webPushSubscriptions } from '@gredice/storage';
import { z } from 'zod';

const pushSubscriptionEndpointSchema = z
    .string()
    .trim()
    .url()
    .max(2048)
    .refine((value) => new URL(value).protocol === 'https:', {
        message: 'Push endpoint must use HTTPS',
    });

const pushSubscriptionKeySchema = z
    .string()
    .trim()
    .min(8)
    .max(4096)
    .regex(/^[A-Za-z0-9_-]+=*$/u, 'Push key must be base64url encoded');

const optionalDeviceTextSchema = z.string().trim().min(1).max(512).optional();

export const pushDeviceUpsertSchema = z.object({
    deviceId: optionalDeviceTextSchema,
    deviceLabel: optionalDeviceTextSchema,
    browserName: optionalDeviceTextSchema,
    browserVersion: optionalDeviceTextSchema,
    platform: optionalDeviceTextSchema,
    userAgent: z.string().trim().min(1).max(1024).optional(),
    locale: z.string().trim().min(1).max(64).optional(),
    timezone: z.string().trim().min(1).max(128).optional(),
    endpoint: pushSubscriptionEndpointSchema,
    keys: z.object({
        p256dh: pushSubscriptionKeySchema,
        auth: pushSubscriptionKeySchema,
    }),
    permissionState: z
        .enum(['default', 'granted', 'denied'])
        .optional()
        .default('granted'),
});

export type PushDeviceUpsert = z.infer<typeof pushDeviceUpsertSchema>;

type PushDeviceRecord = Pick<
    typeof webPushSubscriptions.$inferSelect,
    | 'browserName'
    | 'browserVersion'
    | 'createdAt'
    | 'deviceId'
    | 'deviceLabel'
    | 'enabled'
    | 'failCount'
    | 'id'
    | 'lastFailureAt'
    | 'lastFailureCode'
    | 'lastFailureReason'
    | 'lastSeenAt'
    | 'lastSuccessAt'
    | 'locale'
    | 'permissionState'
    | 'platform'
    | 'revokedAt'
    | 'revokedReason'
    | 'timezone'
    | 'updatedAt'
    | 'userAgent'
>;

export function pushDeviceResponse(device: PushDeviceRecord) {
    return {
        browserName: device.browserName,
        browserVersion: device.browserVersion,
        createdAt: device.createdAt,
        deviceId: device.deviceId,
        deviceLabel: device.deviceLabel,
        enabled: device.enabled,
        failCount: device.failCount,
        id: device.id,
        lastFailureAt: device.lastFailureAt,
        lastFailureCode: device.lastFailureCode,
        lastFailureReason: device.lastFailureReason,
        lastSeenAt: device.lastSeenAt,
        lastSuccessAt: device.lastSuccessAt,
        locale: device.locale,
        permissionState: device.permissionState,
        platform: device.platform,
        revokedAt: device.revokedAt,
        revokedReason: device.revokedReason,
        timezone: device.timezone,
        updatedAt: device.updatedAt,
        userAgent: device.userAgent,
    };
}
