import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { storage } from '..';
import {
    type InsertWebPushSubscription,
    type SelectWebPushSubscription,
    webPushSubscriptions,
} from '../schema';

export type SavePushSubscriptionInput = {
    accountId: string;
    userId: string;
    endpoint: string;
    keys: {
        auth: string;
        p256dh: string;
    };
    expirationTime?: Date | null;
    userAgent?: string | null;
    platform?: string | null;
};

export async function savePushSubscription(input: SavePushSubscriptionInput) {
    const now = new Date();
    const values: InsertWebPushSubscription & { id: string } = {
        id: randomUUID(),
        accountId: input.accountId,
        userId: input.userId,
        endpoint: input.endpoint,
        auth: input.keys.auth,
        p256dh: input.keys.p256dh,
        expirationTime: input.expirationTime ?? null,
        userAgent: input.userAgent ?? null,
        platform: input.platform ?? null,
        createdAt: now,
        updatedAt: now,
    };

    await storage()
        .insert(webPushSubscriptions)
        .values(values)
        .onConflictDoUpdate({
            target: webPushSubscriptions.endpoint,
            set: {
                accountId: input.accountId,
                userId: input.userId,
                auth: input.keys.auth,
                p256dh: input.keys.p256dh,
                expirationTime: input.expirationTime ?? null,
                userAgent: input.userAgent ?? null,
                platform: input.platform ?? null,
                updatedAt: now,
            },
        });
}

export function removePushSubscription(endpoint: string, accountId?: string) {
    if (accountId) {
        return storage()
            .delete(webPushSubscriptions)
            .where(
                and(
                    eq(webPushSubscriptions.endpoint, endpoint),
                    eq(webPushSubscriptions.accountId, accountId),
                ),
            );
    }

    return storage()
        .delete(webPushSubscriptions)
        .where(eq(webPushSubscriptions.endpoint, endpoint));
}

export function getPushSubscriptionsForNotification({
    accountId,
    userId,
}: {
    accountId: string;
    userId?: string | null;
}): Promise<SelectWebPushSubscription[]> {
    if (userId) {
        return storage()
            .select()
            .from(webPushSubscriptions)
            .where(
                and(
                    eq(webPushSubscriptions.accountId, accountId),
                    eq(webPushSubscriptions.userId, userId),
                ),
            );
    }

    return storage()
        .select()
        .from(webPushSubscriptions)
        .where(eq(webPushSubscriptions.accountId, accountId));
}
