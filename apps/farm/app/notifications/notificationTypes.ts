export type FarmNotificationsFilter = 'unread' | 'all';

export type FarmNotification = {
    id: string;
    actionUrl: string | null;
    content: string;
    createdAt: Date;
    header: string;
    iconUrl: string | null;
    imageUrl: string | null;
    linkUrl: string | null;
    raisedBedId: number | null;
    readAt: Date | null;
    timestamp: Date;
};
