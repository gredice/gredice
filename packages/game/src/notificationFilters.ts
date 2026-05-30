export const notificationsFilterSearchParam = 'obavijestiFilter';

export type NotificationsFilter = 'unread' | 'all';

export function isNotificationsFilter(
    value: string | null | undefined,
): value is NotificationsFilter {
    return value === 'unread' || value === 'all';
}
