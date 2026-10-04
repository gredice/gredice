'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { Approved, Inbox } from '@gredice/ui/icons';
import { List } from '@gredice/ui/List';
import { Row } from '@gredice/ui/Row';
import { Skeleton } from '@gredice/ui/Skeleton';
import { Stack } from '@gredice/ui/Stack';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@gredice/ui/Tabs';
import { Typography } from '@gredice/ui/Typography';
import { FarmNotificationListItem } from './FarmNotificationListItem';
import type { FarmNotificationNavigationTarget } from './notificationLinks';
import type {
    FarmNotification,
    FarmNotificationsFilter,
} from './notificationTypes';

interface FarmNotificationListProps {
    filter: FarmNotificationsFilter;
    isError?: boolean;
    isLoading?: boolean;
    markAllPending?: boolean;
    notifications: FarmNotification[];
    onFilterChange: (filter: FarmNotificationsFilter) => void;
    onMarkAllRead: (notificationIds: string[]) => void;
    onNotificationOpen: (
        notification: FarmNotification,
        target: FarmNotificationNavigationTarget | null,
    ) => void;
    onNotificationReadChange: (
        notification: FarmNotification,
        read: boolean,
    ) => void;
    onRetry?: () => void;
    readPendingIds?: ReadonlySet<string>;
}

export function filterFarmNotifications(
    notifications: FarmNotification[],
    filter: FarmNotificationsFilter,
) {
    if (filter === 'all') {
        return notifications;
    }

    return notifications.filter((notification) => !notification.readAt);
}

export function setFarmNotificationReadState(
    notifications: FarmNotification[],
    id: string,
    read: boolean,
    readAt = new Date(),
) {
    return notifications.map((notification) =>
        notification.id === id
            ? {
                  ...notification,
                  readAt: read ? readAt : null,
              }
            : notification,
    );
}

export function setFarmNotificationsReadState(
    notifications: FarmNotification[],
    ids: string[],
    readAt = new Date(),
) {
    const idSet = new Set(ids);
    return notifications.map((notification) =>
        idSet.has(notification.id)
            ? {
                  ...notification,
                  readAt,
              }
            : notification,
    );
}

function FarmNotificationSkeletons() {
    return (
        <Stack spacing={0} aria-hidden="true">
            {[0, 1, 2].map((item) => (
                <div key={item} className="border-b p-4 last:border-b-0">
                    <Row spacing={3} className="items-start">
                        <Skeleton className="size-14 shrink-0 sm:size-16" />
                        <Stack spacing={2} className="min-w-0 flex-1">
                            <Skeleton className="h-5 w-2/3" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-4 w-32" />
                        </Stack>
                    </Row>
                </div>
            ))}
        </Stack>
    );
}

function EmptyNotificationsState({
    filter,
    onShowAll,
}: {
    filter: FarmNotificationsFilter;
    onShowAll: () => void;
}) {
    return (
        <Stack
            spacing={3}
            alignItems="center"
            className="px-4 py-12 text-center"
        >
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Inbox className="size-6" />
            </span>
            <Stack spacing={1}>
                <Typography semiBold>
                    {filter === 'unread'
                        ? 'Nema nepročitanih obavijesti.'
                        : 'Nema obavijesti.'}
                </Typography>
                {filter === 'unread' && (
                    <Typography level="body2" secondary>
                        Sve pročitane obavijesti dostupne su u prikazu Sve.
                    </Typography>
                )}
            </Stack>
            {filter === 'unread' && (
                <Button variant="plain" size="sm" onClick={onShowAll}>
                    Prikaži sve
                </Button>
            )}
        </Stack>
    );
}

export function FarmNotificationList({
    filter,
    isError,
    isLoading,
    markAllPending,
    notifications,
    onFilterChange,
    onMarkAllRead,
    onNotificationOpen,
    onNotificationReadChange,
    onRetry,
    readPendingIds,
}: FarmNotificationListProps) {
    const visibleNotifications = filterFarmNotifications(notifications, filter);
    const unreadNotificationIds = notifications
        .filter((notification) => !notification.readAt)
        .map((notification) => notification.id);
    const hasUnreadNotifications = unreadNotificationIds.length > 0;

    return (
        <Card className="p-0">
            <CardHeader className="p-4">
                <Row
                    alignItems="start"
                    justifyContent="space-between"
                    spacing={3}
                    className="flex-wrap gap-y-3"
                >
                    <Stack spacing={1}>
                        <CardTitle>Obavijesti</CardTitle>
                        <Typography level="body2" secondary>
                            {hasUnreadNotifications
                                ? `${unreadNotificationIds.length.toString()} nepročitano`
                                : 'Sve je pročitano'}
                        </Typography>
                    </Stack>
                    <Button
                        size="sm"
                        variant="outlined"
                        disabled={!hasUnreadNotifications}
                        loading={markAllPending}
                        onClick={() => onMarkAllRead(unreadNotificationIds)}
                        startDecorator={<Approved className="size-4" />}
                    >
                        Označi sve kao pročitane
                    </Button>
                </Row>
            </CardHeader>
            <CardContent>
                <Tabs
                    value={filter}
                    onValueChange={(value) => {
                        if (value === 'unread' || value === 'all') {
                            onFilterChange(value);
                        }
                    }}
                >
                    <TabsList aria-label="Prikaz obavijesti">
                        <TabsTrigger value="unread">Nepročitane</TabsTrigger>
                        <TabsTrigger value="all">Sve</TabsTrigger>
                    </TabsList>
                    <TabsContent value={filter} className="mt-4" forceMount>
                        {isError ? (
                            <Alert
                                color="danger"
                                endDecorator={
                                    onRetry ? (
                                        <Button
                                            size="sm"
                                            variant="outlined"
                                            onClick={onRetry}
                                        >
                                            Pokušaj ponovno
                                        </Button>
                                    ) : undefined
                                }
                            >
                                Obavijesti nisu učitane.
                            </Alert>
                        ) : null}
                    </TabsContent>
                </Tabs>
            </CardContent>
            <CardOverflow>
                {isLoading ? (
                    <FarmNotificationSkeletons />
                ) : !isError && visibleNotifications.length === 0 ? (
                    <EmptyNotificationsState
                        filter={filter}
                        onShowAll={() => onFilterChange('all')}
                    />
                ) : !isError ? (
                    <List
                        variant="outlined"
                        className="rounded-none border-x-0 border-b-0"
                    >
                        {visibleNotifications.map((notification) => (
                            <FarmNotificationListItem
                                key={notification.id}
                                notification={notification}
                                onNotificationOpen={onNotificationOpen}
                                onReadChange={onNotificationReadChange}
                                readPending={readPendingIds?.has(
                                    notification.id,
                                )}
                            />
                        ))}
                    </List>
                ) : null}
            </CardOverflow>
        </Card>
    );
}
