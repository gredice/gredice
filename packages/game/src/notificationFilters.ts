export const notificationsFilterSearchParam = 'obavijestiFilter';
export const notificationsViewSearchParam = 'obavijestiView';

export type NotificationsFilter = 'unread' | 'all';
export type NotificationsView = 'notifications' | 'settings';

export function isNotificationsFilter(
    value: string | null | undefined,
): value is NotificationsFilter {
    return value === 'unread' || value === 'all';
}

export function isNotificationsView(
    value: string | null | undefined,
): value is NotificationsView {
    return value === 'notifications' || value === 'settings';
}
