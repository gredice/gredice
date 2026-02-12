import { getRaisedBedCloseupUrl } from '@gredice/js/urls';
import { ImageViewer } from '@gredice/ui/ImageViewer';
import { Markdown } from '@gredice/ui/Markdown';
import { Alert } from '@signalco/ui/Alert';
import { Check } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { List } from '@signalco/ui-primitives/List';
import { ListItem } from '@signalco/ui-primitives/ListItem';
import { Row } from '@signalco/ui-primitives/Row';
import { Skeleton } from '@signalco/ui-primitives/Skeleton';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Route } from 'next';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useNotifications } from '../hooks/useNotifications';
import { useSetNotificationRead } from '../hooks/useSetNotificationRead';
import { NoNotificationsPlaceholder } from '../shared-ui/NoNotificationsPlaceholder';

interface NotificationProps {
    read?: boolean;
    short?: boolean;
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
};

function NotificationListItem({ notification }: NotificationListItemProps) {
    const router = useRouter();
    const { id, header, content, linkUrl, readAt, timestamp, raisedBedId } =
        notification;
    const setNotificationRead = useSetNotificationRead();
    const { data: currentGarden } = useCurrentGarden();

    // TODO: Remove this backward compatibility code after December 9, 2026
    // This generates the raised bed closeup URL from raisedBedId if linkUrl is not present
    // After all notifications have been migrated to include linkUrl, this can be removed
    const computedLinkUrl = useMemo(() => {
        if (linkUrl) {
            return linkUrl;
        }

        // Backward compatibility: generate URL from raisedBedId if linkUrl is missing
        if (raisedBedId && currentGarden) {
            const raisedBed = currentGarden.raisedBeds.find(
                (bed) => bed.id === raisedBedId,
            );
            if (raisedBed?.name) {
                return getRaisedBedCloseupUrl(raisedBed.name);
            }
        }

        return '#';
    }, [linkUrl, raisedBedId, currentGarden]);

    function handleSetNotificationRead() {
        setNotificationRead.mutate({
            id,
            read: !readAt,
            readWhere: 'game',
        });
    }

    function handleNotificationSelected() {
        if (!readAt) {
            setNotificationRead.mutate({
                id,
                read: true,
                readWhere: 'game',
            });
        }

        if (computedLinkUrl !== '#') {
            router.push(computedLinkUrl as Route);
        }
    }

    const isRead = Boolean(readAt);

    return (
        <div className="relative">
            <ListItem
                nodeId={id}
                onSelected={handleNotificationSelected}
                className="rounded-none p-4"
                label={
                    <Row spacing={2}>
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
                title={
                    isRead ? 'Označi kao nepročitano' : 'Označi kao pročitano'
                }
                className={cx(
                    'size-4 rounded-full hover:outline outline-offset-2 outline-2 absolute top-2.5 right-2 group',
                    isRead ? 'border' : 'bg-green-600',
                )}
                onClick={handleSetNotificationRead}
            >
                {!isRead && (
                    <Check className="size-4 shrink-0 hidden group-hover:block" />
                )}
            </button>
        </div>
    );
}

export function NotificationList({ read, short }: NotificationProps) {
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
            <Stack spacing={1}>
                {[...Array(3)].map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: Allowed, skeleton
                    <Stack key={i} spacing={1} className="p-4">
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

    if (!notifications?.length) {
        return <NoNotificationsPlaceholder />;
    }

    return (
        <List variant="outlined" className="border-none">
            {notifications.map((notification) => (
                <NotificationListItem
                    key={notification.id}
                    notification={notification}
                />
            ))}
        </List>
    );
}
