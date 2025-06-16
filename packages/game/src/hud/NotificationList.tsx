import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Alert } from "@signalco/ui/Alert";
import { NoNotificationsPlaceholder } from "../shared-ui/NoNotificationsPlaceholder";
import { Skeleton } from "@signalco/ui-primitives/Skeleton";
import { useNotifications } from "../hooks/useNotifications";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { List } from "@signalco/ui-primitives/List";
import { ListItem } from "@signalco/ui-primitives/ListItem";
import { useSetNotificationRead } from "../hooks/useSetNotificationRead";
import { Markdown } from "../content/Markdown";
import { cx } from "@signalco/ui-primitives/cx";
import { Check } from "@signalco/ui-icons";
import { Row } from "@signalco/ui-primitives/Row";

interface NotificationProps {
    read?: boolean;
    short?: boolean;
}

type NotificationListItemProps = {
    notification: {
        id: string;
        header: string;
        content: string;
        linkUrl: string | null;
        imageUrl: string | null;
        readAt: Date | null;
        createdAt: Date;
    };
};

function NotificationListItem({ notification }: NotificationListItemProps) {
    const { id, header, content, linkUrl, readAt, createdAt } = notification;
    const setNotificationRead = useSetNotificationRead();

    function handleSetNotificationRead() {
        setNotificationRead.mutate({
            id,
            read: readAt ? false : true,
            readWhere: 'game'
        });
    }

    const isRead = Boolean(readAt);

    return (
        <div className="relative">
            <ListItem
                href={linkUrl ?? '#'}
                className="rounded-none p-4"
                label={(
                    <Row spacing={2}>
                        {notification.imageUrl && (
                            <img
                                src={notification.imageUrl}
                                alt={header}
                                width={80}
                                height={80}
                                className="w-20 h-20 object-cover rounded"
                            />
                        )}
                        <Stack>
                            <Typography level="body2" bold noWrap className="mr-3">{header}</Typography>
                            <Markdown>
                                {content}
                            </Markdown>
                            <Typography level="body3" className="text-gray-500 mr-3s" title={createdAt.toLocaleString('hr-HR')}>
                                {`${createdAt.toLocaleDateString('hr-HR', { day: "numeric", month: 'long', year: 'numeric' })}`}
                            </Typography>
                        </Stack>
                    </Row>
                )} />
            <button
                title={isRead ? "Označi kao nepročitano" : "Označi kao pročitano"}
                className={cx(
                    "size-4 rounded-full hover:outline absolute top-2.5 right-2 group",
                    isRead ? "border hover:outline" : "bg-green-600"
                )}
                onClick={handleSetNotificationRead}>
                {!isRead && <Check className="size-4 shrink-0 hidden group-hover:block" />}
            </button>
        </div>
    );

}

export function NotificationList({ read, short }: NotificationProps) {
    const { data: currentUser } = useCurrentUser();
    const { data: notifications, isLoading, error } = useNotifications(currentUser?.id, read, 0, short ? 10 : undefined);

    if (isLoading) {
        return (
            <Stack spacing={2}>
                {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                ))}
            </Stack>
        );
    }

    if (error) {
        return (
            <Alert color="danger">
                <Typography level="body2">Došlo je do greške prilikom učitavanja obavijesti.</Typography>
            </Alert>
        );
    }

    if (!notifications?.length) {
        return <NoNotificationsPlaceholder />;
    }

    return (
        <List variant="outlined">
            {notifications.map((notification) => (
                <NotificationListItem key={notification.id} notification={notification} />
            ))}
        </List>
    );
}
