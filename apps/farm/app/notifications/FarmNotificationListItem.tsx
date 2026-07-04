'use client';

import { Check, ExternalLink, Inbox } from '@gredice/ui/icons';
import { ListItem } from '@gredice/ui/ListItem';
import { Markdown } from '@gredice/ui/Markdown';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import {
    type FarmNotificationNavigationTarget,
    resolveFarmNotificationNavigationTarget,
} from './notificationLinks';
import type { FarmNotification } from './notificationTypes';

interface FarmNotificationListItemProps {
    notification: FarmNotification;
    onNotificationOpen: (
        notification: FarmNotification,
        target: FarmNotificationNavigationTarget | null,
    ) => void;
    onReadChange: (notification: FarmNotification, read: boolean) => void;
    readPending?: boolean;
}

function formatTimestamp(timestamp: Date) {
    return timestamp.toLocaleDateString('hr-HR', {
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        month: 'long',
        year: 'numeric',
    });
}

export function FarmNotificationListItem({
    notification,
    onNotificationOpen,
    onReadChange,
    readPending,
}: FarmNotificationListItemProps) {
    const isRead = Boolean(notification.readAt);
    const target = resolveFarmNotificationNavigationTarget(notification);
    const mediaUrl = notification.iconUrl ?? notification.imageUrl;
    const readToggleLabel = isRead
        ? `Označi obavijest "${notification.header}" kao nepročitanu`
        : `Označi obavijest "${notification.header}" kao pročitanu`;

    return (
        <div className="relative">
            <ListItem
                className={cx(
                    'rounded-none px-3 py-3 pr-12 sm:px-4',
                    !isRead && 'bg-secondary/40 hover:bg-secondary/60',
                )}
                data-testid={`farm-notification-${notification.id}`}
                nodeId={notification.id}
                onSelected={() => onNotificationOpen(notification, target)}
                label={
                    <Row spacing={3} className="items-start">
                        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background text-muted-foreground sm:size-16">
                            {mediaUrl ? (
                                <>
                                    {/* biome-ignore lint/performance/noImgElement: Notification media can come from campaign URLs outside Next image config. */}
                                    <img
                                        src={mediaUrl}
                                        alt=""
                                        className="size-full object-cover"
                                    />
                                </>
                            ) : (
                                <Inbox className="size-6" />
                            )}
                        </div>
                        <Stack spacing={1} className="min-w-0">
                            <Row spacing={2} className="min-w-0 items-start">
                                <Typography
                                    level="body2"
                                    semiBold
                                    className="min-w-0 flex-1"
                                >
                                    {notification.header}
                                </Typography>
                                {target?.kind === 'external' && (
                                    <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                )}
                            </Row>
                            <div className="text-sm font-normal leading-relaxed text-foreground">
                                <Markdown>{notification.content}</Markdown>
                            </div>
                            <Row spacing={2} className="flex-wrap gap-y-1">
                                <Typography
                                    level="body3"
                                    className="text-muted-foreground"
                                    title={notification.timestamp.toLocaleString(
                                        'hr-HR',
                                    )}
                                >
                                    {formatTimestamp(notification.timestamp)}
                                </Typography>
                                {!isRead && (
                                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900">
                                        Nepročitano
                                    </span>
                                )}
                            </Row>
                        </Stack>
                    </Row>
                }
            />
            <button
                type="button"
                aria-label={readToggleLabel}
                title={readToggleLabel}
                disabled={readPending}
                className={cx(
                    "absolute right-3 top-3 size-5 rounded-full outline-2 outline-offset-2 transition-colors hover:outline focus-visible:outline disabled:opacity-50 group before:absolute before:-inset-3 before:rounded-full before:content-['']",
                    isRead
                        ? 'border border-muted-foreground/50 bg-background'
                        : 'bg-green-600 text-white',
                )}
                onClick={() => onReadChange(notification, !isRead)}
            >
                {!isRead && (
                    <Check className="size-5 shrink-0 text-white sm:hidden sm:group-hover:block" />
                )}
            </button>
        </div>
    );
}
