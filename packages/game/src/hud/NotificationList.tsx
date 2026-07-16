import { getRaisedBedCloseupUrl } from '@gredice/js/urls';
import { Alert } from '@gredice/ui/Alert';
import { ImageViewer } from '@gredice/ui/ImageViewer';
import { Check } from '@gredice/ui/icons';
import { List } from '@gredice/ui/List';
import { ListItem } from '@gredice/ui/ListItem';
import { Markdown } from '@gredice/ui/Markdown';
import { RaisedBedIcon } from '@gredice/ui/RaisedBedIcon';
import { Row } from '@gredice/ui/Row';
import { Skeleton } from '@gredice/ui/Skeleton';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type { Route } from 'next';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useNotifications } from '../hooks/useNotifications';
import { useSetNotificationRead } from '../hooks/useSetNotificationRead';
import { NoNotificationsPlaceholder } from '../shared-ui/NoNotificationsPlaceholder';
import { navigateNotificationLink } from './notificationNavigation';

interface NotificationProps {
    read?: boolean;
    short?: boolean;
    unreadOnly?: boolean;
    onNotificationSelected?: () => void;
}

type NotificationListItemProps = {
    notification: {
        id: string;
        header: string;
        content: string;
        iconUrl: string | null;
        linkUrl: string | null;
        imageUrl: string | null;
        readAt: Date | null;
        timestamp: Date;
        raisedBedId: number | null;
    };
    onNotificationSelected?: () => void;
};

function NotificationListItem({
    notification,
    onNotificationSelected,
}: NotificationListItemProps) {
    const router = useRouter();
    const { id, header, content, linkUrl, readAt, timestamp, raisedBedId } =
        notification;
    const { track } = useGameAnalytics();
    const setNotificationRead = useSetNotificationRead();
    const { data: currentGarden } = useCurrentGarden();

    const raisedBed = useMemo(() => {
        if (!raisedBedId || !currentGarden) {
            return undefined;
        }
        return currentGarden.raisedBeds.find((bed) => bed.id === raisedBedId);
    }, [raisedBedId, currentGarden]);

    // TODO: Remove this backward compatibility code after December 9, 2026
    // This generates the raised bed closeup URL from raisedBedId if linkUrl is not present
    // After all notifications have been migrated to include linkUrl, this can be removed
    const computedLinkUrl = useMemo(() => {
        if (linkUrl) {
            return linkUrl;
        }

        // Backward compatibility: generate URL from raisedBedId if linkUrl is missing
        if (raisedBed?.name) {
            return getRaisedBedCloseupUrl(raisedBed.name);
        }

        return '#';
    }, [linkUrl, raisedBed]);

    const isRead = Boolean(readAt);
    const readToggleLabel = isRead
        ? 'Označi kao nepročitano'
        : 'Označi kao pročitano';

    function handleSetNotificationRead() {
        track('game_notification_read_toggled', {
            has_link: computedLinkUrl !== '#',
            notification_id: id,
            raised_bed_id: raisedBedId,
            read: !isRead,
        });
        setNotificationRead.mutate({
            id,
            read: !readAt,
            readWhere: 'game',
        });
    }

    function handleNotificationSelected() {
        track('game_notification_opened', {
            has_link: computedLinkUrl !== '#',
            notification_id: id,
            raised_bed_id: raisedBedId,
            was_read: isRead,
        });

        if (!readAt) {
            setNotificationRead.mutate({
                id,
                read: true,
                readWhere: 'game',
            });
        }

        if (computedLinkUrl !== '#') {
            navigateNotificationLink({
                assign: (url) => window.location.assign(url),
                currentOrigin: window.location.origin,
                href: computedLinkUrl,
                push: (url) => router.push(url as Route),
            });
        }

        onNotificationSelected?.();
    }

    return (
        <div className="relative">
            <ListItem
                nodeId={id}
                onSelected={handleNotificationSelected}
                className="rounded-none p-4"
                label={
                    <Row spacing={4}>
                        {notification.iconUrl ? (
                            <Image
                                src={notification.iconUrl}
                                alt={header}
                                width={80}
                                height={80}
                                className="w-20 h-20 object-cover rounded"
                            />
                        ) : (
                            notification.imageUrl && (
                                <ImageViewer
                                    src={notification.imageUrl}
                                    alt={header}
                                    previewWidth={80}
                                    previewHeight={80}
                                    previewAs="div"
                                />
                            )
                        )}
                        <Stack>
                            <Typography level="body2" bold className="mr-3">
                                {header}
                            </Typography>
                            <div className="font-normal -my-1">
                                <Markdown>{content}</Markdown>
                            </div>
                            <Typography
                                level="body3"
                                className="text-gray-500 mr-3s"
                                title={timestamp.toLocaleString('hr-HR')}
                            >
                                {`${timestamp.toLocaleDateString('hr-HR', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                            </Typography>
                        </Stack>
                    </Row>
                }
            />
            <button
                type="button"
                aria-label={readToggleLabel}
                title={readToggleLabel}
                className={cx(
                    "absolute top-2.5 right-2 size-4 rounded-full outline-2 outline-offset-2 hover:outline focus-visible:outline group before:absolute before:-inset-3 before:rounded-full before:content-['']",
                    isRead ? 'border' : 'bg-green-600',
                )}
                onClick={handleSetNotificationRead}
            >
                {!isRead && (
                    <Check className="size-4 shrink-0 hidden group-hover:block text-white" />
                )}
            </button>
            {raisedBed?.physicalId && (
                <div
                    className="pointer-events-none absolute bottom-2 right-2 text-muted-foreground"
                    title={`Gredica ${raisedBed.physicalId}`}
                >
                    <RaisedBedIcon
                        physicalId={raisedBed.physicalId}
                        className="size-5"
                    />
                </div>
            )}
        </div>
    );
}

export function NotificationList({
    onNotificationSelected,
    read,
    short,
    unreadOnly,
}: NotificationProps) {
    const { data: currentUser } = useCurrentUser();
    const { data: notifications, error } = useNotifications(
        currentUser?.id,
        read,
        0,
        short ? 10 : 1000,
    );
    const isLoading = false;
    if (isLoading) {
        return (
            <Stack spacing={2}>
                {[...Array(3)].map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: Allowed, skeleton
                    <Stack key={i} spacing={2} className="p-4">
                        <Skeleton className="h-5 w-2/3" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-5 w-20" />
                    </Stack>
                ))}
            </Stack>
        );
    }

    if (error) {
        return (
            <Alert color="danger">
                <Typography level="body2">
                    Došlo je do greške prilikom učitavanja obavijesti.
                </Typography>
            </Alert>
        );
    }

    const visibleNotifications = unreadOnly
        ? notifications?.filter((notification) => !notification.readAt)
        : notifications;

    if (!visibleNotifications?.length) {
        return <NoNotificationsPlaceholder />;
    }

    return (
        <List variant="outlined" className="border-none">
            {visibleNotifications.map((notification) => (
                <NotificationListItem
                    key={notification.id}
                    notification={notification}
                    onNotificationSelected={onNotificationSelected}
                />
            ))}
        </List>
    );
}
