'use client';

import { Checkbox } from '@gredice/ui/Checkbox';
import { Chip } from '@gredice/ui/Chip';
import { IconButton } from '@gredice/ui/IconButton';
import { ImageViewer } from '@gredice/ui/ImageViewer';
import { Delete, ExternalLink } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Markdown } from '@gredice/ui/Markdown';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { KnownPages } from '../../src/KnownPages';
import { NoDataPlaceholder } from '../shared/placeholders/NoDataPlaceholder';

export type NotificationTableRow = {
    id: string;
    accountId: string | null;
    accountLabel: string | null;
    blockId: string | null;
    category: string;
    content: string;
    createdAt: string;
    gardenId: number | null;
    gardenName: string | null;
    header: string;
    imageUrl: string | null;
    linkUrl: string | null;
    raisedBedId: number | null;
    raisedBedPhysicalId: string | null;
    readAt: string | null;
    timestamp: string;
    type: string;
    primaryChannel: string;
    userId: string | null;
};

export type NotificationDeleteContext = {
    accountId?: string;
    userId?: string | null;
    gardenId?: number;
    raisedBedId?: number;
};

export type DeleteNotificationsResult = {
    success: boolean;
    deletedCount: number;
    error?: string;
};

export type DeleteNotificationsAction = (
    notificationIds: string[],
    context: NotificationDeleteContext,
) => Promise<DeleteNotificationsResult>;

type NotificationsTableProps = {
    isPending: boolean;
    notifications: NotificationTableRow[];
    onDeleteNotification: (notificationId: string) => void;
    onNotificationSelected: (notificationId: string, selected: boolean) => void;
    selectedIds: ReadonlySet<string>;
    showAccountColumn: boolean;
};

function getCreatedTimestampDistance(row: NotificationTableRow) {
    return Math.abs(
        new Date(row.createdAt).getTime() - new Date(row.timestamp).getTime(),
    );
}

function formatNotificationMeta(value: string) {
    return value.replaceAll('_', ' ');
}

function getNotificationChannelLabel(channel: string) {
    switch (channel) {
        case 'in_app':
            return 'In-app';
        case 'push':
            return 'Push';
        case 'email':
            return 'Email';
        default:
            return formatNotificationMeta(channel);
    }
}

export function NotificationsTable({
    isPending,
    notifications,
    onDeleteNotification,
    onNotificationSelected,
    selectedIds,
    showAccountColumn,
}: NotificationsTableProps) {
    const hasNotifications = notifications.length > 0;

    return (
        <Stack spacing={0} className="@container/notifications min-w-0">
            {!hasNotifications ? (
                <div className="p-4">
                    <NoDataPlaceholder>Nema obavjesti</NoDataPlaceholder>
                </div>
            ) : (
                <ul className="divide-y">
                    {notifications.map((notification) => {
                        const isSelected = selectedIds.has(notification.id);
                        const hasLocation = Boolean(
                            notification.gardenId ||
                                notification.raisedBedId ||
                                notification.blockId,
                        );

                        return (
                            <li
                                key={notification.id}
                                className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                            >
                                <div className="grid min-w-0 gap-3 @[48rem]/notifications:grid-cols-[minmax(0,1fr)_minmax(12rem,0.5fr)_minmax(14rem,0.5fr)] @[48rem]/notifications:items-start">
                                    <div className="flex min-w-0 items-start gap-3">
                                        <Checkbox
                                            aria-label={`Odaberi obavijest ${notification.header}`}
                                            checked={isSelected}
                                            disabled={isPending}
                                            className="mt-1 shrink-0"
                                            onCheckedChange={(checked) =>
                                                onNotificationSelected(
                                                    notification.id,
                                                    checked === true,
                                                )
                                            }
                                        />
                                        {notification.imageUrl && (
                                            <div className="shrink-0 overflow-hidden rounded-md">
                                                <ImageViewer
                                                    src={notification.imageUrl}
                                                    alt={notification.header}
                                                    previewWidth={64}
                                                    previewHeight={64}
                                                />
                                            </div>
                                        )}
                                        <Stack
                                            spacing={1}
                                            className="min-w-0 flex-1"
                                        >
                                            <Typography
                                                level="body2"
                                                bold
                                                className="break-words"
                                            >
                                                {notification.header}
                                            </Typography>
                                            <Markdown className="min-w-0 break-words text-sm text-secondary-foreground prose-p:my-1 prose-a:break-all prose-pre:whitespace-pre-wrap prose-pre:break-words prose-code:break-words">
                                                {notification.content}
                                            </Markdown>
                                            <Typography
                                                component="div"
                                                level="body3"
                                                className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
                                            >
                                                <span className="font-medium">
                                                    Link:
                                                </span>
                                                {notification.linkUrl ? (
                                                    <a
                                                        href={
                                                            notification.linkUrl
                                                        }
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex min-w-0 max-w-full items-center gap-1 break-all text-primary underline-offset-4 hover:underline"
                                                    >
                                                        <ExternalLink className="size-3.5 shrink-0" />
                                                        <span>Otvori</span>
                                                    </a>
                                                ) : (
                                                    <span>-</span>
                                                )}
                                            </Typography>
                                        </Stack>
                                    </div>

                                    <div className="grid min-w-0 gap-2 text-sm @[32rem]/notifications:grid-cols-2 @[48rem]/notifications:grid-cols-1 @[48rem]/notifications:gap-1">
                                        <Stack spacing={1} className="min-w-0">
                                            <Typography
                                                component="span"
                                                level="body3"
                                                className="font-medium uppercase"
                                            >
                                                Mjesto
                                            </Typography>
                                            {hasLocation ? (
                                                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                                    {notification.gardenId && (
                                                        <Link
                                                            href={KnownPages.Garden(
                                                                notification.gardenId,
                                                            )}
                                                            className="min-w-0 break-words text-primary underline-offset-4 hover:underline"
                                                        >
                                                            {notification.gardenName ??
                                                                'N/A'}
                                                        </Link>
                                                    )}
                                                    {notification.raisedBedId && (
                                                        <RaisedBedLabel
                                                            physicalId={
                                                                notification.raisedBedPhysicalId
                                                            }
                                                        />
                                                    )}
                                                    {notification.blockId && (
                                                        <Typography
                                                            component="span"
                                                            level="body3"
                                                            className="break-all"
                                                        >
                                                            Blok:{' '}
                                                            {
                                                                notification.blockId
                                                            }
                                                        </Typography>
                                                    )}
                                                </div>
                                            ) : (
                                                <Typography
                                                    component="span"
                                                    level="body3"
                                                >
                                                    -
                                                </Typography>
                                            )}
                                        </Stack>

                                        {showAccountColumn && (
                                            <Stack
                                                spacing={1}
                                                className="min-w-0"
                                            >
                                                <Typography
                                                    component="span"
                                                    level="body3"
                                                    className="font-medium uppercase"
                                                >
                                                    Račun
                                                </Typography>
                                                {notification.accountId ? (
                                                    <Link
                                                        href={KnownPages.Account(
                                                            notification.accountId,
                                                        )}
                                                        className="min-w-0 break-words text-primary underline-offset-4 hover:underline"
                                                    >
                                                        {notification.accountLabel ??
                                                            notification.accountId}
                                                    </Link>
                                                ) : (
                                                    <Typography
                                                        component="span"
                                                        level="body3"
                                                    >
                                                        -
                                                    </Typography>
                                                )}
                                            </Stack>
                                        )}

                                        <Stack spacing={1} className="min-w-0">
                                            <Typography
                                                component="span"
                                                level="body3"
                                                className="font-medium uppercase"
                                            >
                                                Korisnik
                                            </Typography>
                                            {notification.userId ? (
                                                <Link
                                                    href={KnownPages.User(
                                                        notification.userId,
                                                    )}
                                                    className="min-w-0 break-all text-primary underline-offset-4 hover:underline"
                                                >
                                                    {notification.userId}
                                                </Link>
                                            ) : (
                                                <Typography
                                                    component="span"
                                                    level="body3"
                                                >
                                                    -
                                                </Typography>
                                            )}
                                        </Stack>
                                    </div>

                                    <div className="flex min-w-0 flex-col gap-2 @[48rem]/notifications:items-end">
                                        <div className="flex min-w-0 flex-wrap items-center gap-2 @[48rem]/notifications:justify-end">
                                            <Chip
                                                color={
                                                    notification.readAt
                                                        ? 'success'
                                                        : 'neutral'
                                                }
                                                size="sm"
                                                className="w-fit"
                                            >
                                                {notification.readAt
                                                    ? 'Pročitano'
                                                    : 'Nepročitano'}
                                            </Chip>
                                            <Chip
                                                color="info"
                                                size="sm"
                                                variant="soft"
                                                title="Kanal"
                                            >
                                                {getNotificationChannelLabel(
                                                    notification.primaryChannel,
                                                )}
                                            </Chip>
                                            <Chip
                                                color="neutral"
                                                size="sm"
                                                variant="outlined"
                                                className="shrink whitespace-normal break-words"
                                                title="Tip"
                                            >
                                                {formatNotificationMeta(
                                                    notification.type,
                                                )}
                                            </Chip>
                                            <Chip
                                                color="neutral"
                                                size="sm"
                                                variant="outlined"
                                                className="shrink whitespace-normal break-words"
                                                title="Kategorija"
                                            >
                                                {formatNotificationMeta(
                                                    notification.category,
                                                )}
                                            </Chip>
                                            <IconButton
                                                type="button"
                                                title="Obriši obavijest"
                                                size="sm"
                                                color="danger"
                                                disabled={isPending}
                                                onClick={() =>
                                                    onDeleteNotification(
                                                        notification.id,
                                                    )
                                                }
                                            >
                                                <Delete className="size-5" />
                                            </IconButton>
                                        </div>
                                        <Stack
                                            spacing={1}
                                            className="min-w-0 @[48rem]/notifications:items-end"
                                        >
                                            <Typography
                                                component="span"
                                                level="body3"
                                                className="text-muted-foreground @[48rem]/notifications:text-right"
                                            >
                                                Kreirano:{' '}
                                                <span className="whitespace-nowrap">
                                                    <LocalDateTime>
                                                        {notification.createdAt}
                                                    </LocalDateTime>
                                                </span>
                                            </Typography>
                                            {getCreatedTimestampDistance(
                                                notification,
                                            ) > 1000 && (
                                                <Typography
                                                    component="span"
                                                    level="body3"
                                                    className="text-muted-foreground @[48rem]/notifications:text-right"
                                                >
                                                    Poslano:{' '}
                                                    <span className="whitespace-nowrap">
                                                        <LocalDateTime>
                                                            {
                                                                notification.timestamp
                                                            }
                                                        </LocalDateTime>
                                                    </span>
                                                </Typography>
                                            )}
                                        </Stack>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Stack>
    );
}
