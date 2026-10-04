import type { SelectNotification } from '@gredice/storage';

type RaisedBedGardenNotification = Pick<
    SelectNotification,
    | 'category'
    | 'content'
    | 'createdAt'
    | 'gardenId'
    | 'header'
    | 'iconUrl'
    | 'id'
    | 'imageUrl'
    | 'linkUrl'
    | 'metadata'
    | 'priority'
    | 'raisedBedId'
    | 'readAt'
    | 'timestamp'
    | 'type'
>;

export function serializeRaisedBedGardenNotification(
    notification: RaisedBedGardenNotification,
) {
    return {
        id: notification.id,
        header: notification.header,
        content: notification.content,
        iconUrl: notification.iconUrl,
        imageUrl: notification.imageUrl,
        linkUrl: notification.linkUrl,
        category: notification.category,
        type: notification.type,
        priority: notification.priority,
        metadata: notification.metadata,
        gardenId: notification.gardenId,
        raisedBedId: notification.raisedBedId,
        readAt: notification.readAt?.toISOString() ?? null,
        timestamp: notification.timestamp.toISOString(),
        createdAt: notification.createdAt.toISOString(),
    };
}
