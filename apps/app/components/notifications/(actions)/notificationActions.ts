'use server';
import 'server-only';
import {
    type SelectNotification,
    deleteNotifications as storageDeleteNotifications,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';

export type DeleteNotificationsContext = {
    accountId?: string;
    userId?: string | null;
    gardenId?: number;
    raisedBedId?: number;
};

type DeletedNotification = Pick<
    SelectNotification,
    'accountId' | 'gardenId' | 'raisedBedId' | 'userId'
>;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function parseString(value: unknown) {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed || undefined;
}

function parseInteger(value: unknown) {
    return typeof value === 'number' && Number.isInteger(value)
        ? value
        : undefined;
}

function parseNotificationIds(value: unknown) {
    if (!Array.isArray(value)) {
        return [];
    }

    const ids = new Set<string>();
    for (const item of value) {
        const id = parseString(item);
        if (id) {
            ids.add(id);
        }
    }

    return Array.from(ids);
}

function parseContext(value: unknown): DeleteNotificationsContext {
    if (!isRecord(value)) {
        return {};
    }

    return {
        accountId: parseString(value.accountId),
        userId: parseString(value.userId),
        gardenId: parseInteger(value.gardenId),
        raisedBedId: parseInteger(value.raisedBedId),
    };
}

function revalidateNotificationPaths(
    context: DeleteNotificationsContext,
    deletedNotifications: DeletedNotification[],
) {
    const accountIds = new Set<string>();
    const userIds = new Set<string>();
    const gardenIds = new Set<number>();
    const raisedBedIds = new Set<number>();

    if (context.accountId) accountIds.add(context.accountId);
    if (context.userId) userIds.add(context.userId);
    if (context.gardenId) gardenIds.add(context.gardenId);
    if (context.raisedBedId) raisedBedIds.add(context.raisedBedId);

    for (const notification of deletedNotifications) {
        accountIds.add(notification.accountId);
        if (notification.userId) userIds.add(notification.userId);
        if (notification.gardenId) gardenIds.add(notification.gardenId);
        if (notification.raisedBedId)
            raisedBedIds.add(notification.raisedBedId);
    }

    revalidatePath(KnownPages.Notifications);

    for (const accountId of accountIds) {
        revalidatePath(KnownPages.Account(accountId));
    }
    for (const userId of userIds) {
        revalidatePath(KnownPages.User(userId));
    }
    for (const gardenId of gardenIds) {
        revalidatePath(KnownPages.Garden(gardenId));
    }
    for (const raisedBedId of raisedBedIds) {
        revalidatePath(KnownPages.RaisedBed(raisedBedId));
    }
}

export async function deleteNotification(
    accountId: string,
    userId: string | null | undefined,
    id: string,
) {
    return deleteNotifications([id], { accountId, userId });
}

export async function deleteNotifications(
    notificationIds: unknown,
    contextValue: unknown,
) {
    await auth(['admin']);

    const ids = parseNotificationIds(notificationIds);
    if (ids.length === 0) {
        return {
            success: false,
            deletedCount: 0,
            error: 'No notifications selected',
        };
    }

    const context = parseContext(contextValue);
    const deletedNotifications = await storageDeleteNotifications(ids);
    revalidateNotificationPaths(context, deletedNotifications);

    return { success: true, deletedCount: deletedNotifications.length };
}
