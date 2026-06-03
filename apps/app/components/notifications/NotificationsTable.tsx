'use client';

import { Button } from '@gredice/ui/Button';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Chip } from '@gredice/ui/Chip';
import { IconButton } from '@gredice/ui/IconButton';
import { ImageViewer } from '@gredice/ui/ImageViewer';
import { Delete } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Markdown } from '@gredice/ui/Markdown';
import { Row } from '@gredice/ui/Row';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { KnownPages } from '../../src/KnownPages';
import { NoDataPlaceholder } from '../shared/placeholders/NoDataPlaceholder';

export type NotificationTableRow = {
    id: string;
    accountId: string | null;
    accountLabel: string | null;
    blockId: string | null;
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
    userId: string | null;
};

export type NotificationDeleteContext = {
    accountId?: string;
    userId?: string | null;
    gardenId?: number;
    raisedBedId?: number;
};

type DeleteNotificationsResult = {
    success: boolean;
    deletedCount: number;
    error?: string;
};

type NotificationsTableProps = {
    deleteContext: NotificationDeleteContext;
    deleteNotificationsAction: (
        notificationIds: string[],
        context: NotificationDeleteContext,
    ) => Promise<DeleteNotificationsResult>;
    notifications: NotificationTableRow[];
    showAccountColumn: boolean;
};

function buildDeleteConfirmMessage(count: number) {
    return count === 1
        ? 'Da li ste sigurni da želite obrisati odabranu obavijest?'
        : `Da li ste sigurni da želite obrisati ${count} odabrane obavijesti?`;
}

function getCreatedTimestampDistance(row: NotificationTableRow) {
    return Math.abs(
        new Date(row.createdAt).getTime() - new Date(row.timestamp).getTime(),
    );
}

export function NotificationsTable({
    deleteContext,
    deleteNotificationsAction,
    notifications,
    showAccountColumn,
}: NotificationsTableProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isPending, startTransition] = useTransition();
    const selectedCount = selectedIds.size;
    const hasNotifications = notifications.length > 0;
    const allSelected =
        hasNotifications && selectedCount === notifications.length;
    const headerChecked = allSelected
        ? true
        : selectedCount > 0
          ? 'indeterminate'
          : false;
    const emptyStateColumnCount = showAccountColumn ? 9 : 8;

    const selectedNotificationIds = useMemo(
        () => notifications.map((notification) => notification.id),
        [notifications],
    );

    useEffect(() => {
        const visibleIds = new Set(selectedNotificationIds);
        setSelectedIds((current) => {
            const next = new Set<string>();
            for (const id of current) {
                if (visibleIds.has(id)) {
                    next.add(id);
                }
            }
            return next.size === current.size ? current : next;
        });
    }, [selectedNotificationIds]);

    function setNotificationSelected(id: string, selected: boolean) {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (selected) {
                next.add(id);
            } else {
                next.delete(id);
            }
            return next;
        });
    }

    function setAllSelected(selected: boolean) {
        setSelectedIds(selected ? new Set(selectedNotificationIds) : new Set());
    }

    function handleDelete(ids: string[]) {
        if (ids.length === 0) {
            return;
        }

        if (!confirm(buildDeleteConfirmMessage(ids.length))) {
            return;
        }

        startTransition(async () => {
            try {
                const result = await deleteNotificationsAction(
                    ids,
                    deleteContext,
                );
                if (!result.success) {
                    alert('Došlo je do greške pri brisanju obavijesti.');
                    return;
                }

                setSelectedIds((current) => {
                    const next = new Set(current);
                    for (const id of ids) {
                        next.delete(id);
                    }
                    return next;
                });
            } catch (error) {
                console.error('Error deleting notifications:', error);
                alert('Došlo je do greške pri brisanju obavijesti.');
            }
        });
    }

    return (
        <Stack spacing={2}>
            <Row justifyContent="space-between" className="px-4 pt-3">
                <Typography level="body2">Odabrano: {selectedCount}</Typography>
                <Button
                    type="button"
                    size="sm"
                    variant="outlined"
                    color="danger"
                    startDecorator={<Delete className="size-4" />}
                    disabled={selectedCount === 0 || isPending}
                    loading={isPending}
                    onClick={() => handleDelete(Array.from(selectedIds))}
                >
                    Obriši odabrane
                </Button>
            </Row>
            <Table>
                <Table.Header>
                    <Table.Row>
                        <Table.Head className="w-12">
                            <Checkbox
                                aria-label="Odaberi sve obavijesti"
                                checked={headerChecked}
                                disabled={!hasNotifications || isPending}
                                onCheckedChange={(checked) =>
                                    setAllSelected(checked === true)
                                }
                            />
                        </Table.Head>
                        <Table.Head>Sadržaj</Table.Head>
                        <Table.Head>Link</Table.Head>
                        <Table.Head>Mjesto</Table.Head>
                        {showAccountColumn && <Table.Head>Račun</Table.Head>}
                        <Table.Head>Korisnik</Table.Head>
                        <Table.Head>Pročitano</Table.Head>
                        <Table.Head>Datum</Table.Head>
                        <Table.Head>Akcije</Table.Head>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {!hasNotifications && (
                        <Table.Row>
                            <Table.Cell colSpan={emptyStateColumnCount}>
                                <NoDataPlaceholder>
                                    Nema obavjesti
                                </NoDataPlaceholder>
                            </Table.Cell>
                        </Table.Row>
                    )}
                    {notifications.map((notification) => {
                        const isSelected = selectedIds.has(notification.id);

                        return (
                            <Table.Row key={notification.id}>
                                <Table.Cell>
                                    <Checkbox
                                        aria-label={`Odaberi obavijest ${notification.header}`}
                                        checked={isSelected}
                                        disabled={isPending}
                                        onCheckedChange={(checked) =>
                                            setNotificationSelected(
                                                notification.id,
                                                checked === true,
                                            )
                                        }
                                    />
                                </Table.Cell>
                                <Table.Cell className="max-w-xs whitespace-pre-wrap">
                                    <Row spacing={4}>
                                        {notification.imageUrl && (
                                            <div className="shrink-0 aspect-square">
                                                <ImageViewer
                                                    src={notification.imageUrl}
                                                    alt={notification.header}
                                                    previewWidth={80}
                                                    previewHeight={80}
                                                />
                                            </div>
                                        )}
                                        <Stack>
                                            <Typography level="body2" bold>
                                                {notification.header}
                                            </Typography>
                                            <Markdown>
                                                {notification.content}
                                            </Markdown>
                                        </Stack>
                                    </Row>
                                </Table.Cell>
                                <Table.Cell>
                                    {notification.linkUrl ? (
                                        <a
                                            href={notification.linkUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary underline"
                                        >
                                            Otvori
                                        </a>
                                    ) : (
                                        '-'
                                    )}
                                </Table.Cell>
                                <Table.Cell>
                                    <Stack>
                                        {notification.gardenId && (
                                            <Link
                                                href={KnownPages.Garden(
                                                    notification.gardenId,
                                                )}
                                                className="text-primary underline"
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
                                            <span>
                                                Blok: {notification.blockId}
                                            </span>
                                        )}
                                    </Stack>
                                </Table.Cell>
                                {showAccountColumn && (
                                    <Table.Cell>
                                        {notification.accountId ? (
                                            <Link
                                                href={KnownPages.Account(
                                                    notification.accountId,
                                                )}
                                                className="text-primary underline"
                                            >
                                                {notification.accountLabel ??
                                                    notification.accountId}
                                            </Link>
                                        ) : (
                                            '-'
                                        )}
                                    </Table.Cell>
                                )}
                                <Table.Cell>
                                    {notification.userId ? (
                                        <Link
                                            href={KnownPages.User(
                                                notification.userId,
                                            )}
                                            className="text-primary underline"
                                        >
                                            {notification.userId}
                                        </Link>
                                    ) : (
                                        '-'
                                    )}
                                </Table.Cell>
                                <Table.Cell>
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
                                </Table.Cell>
                                <Table.Cell>
                                    <Typography level="body3">
                                        <LocalDateTime>
                                            {notification.createdAt}
                                        </LocalDateTime>
                                    </Typography>
                                    {getCreatedTimestampDistance(notification) >
                                        1000 && (
                                        <Typography level="body3">
                                            <LocalDateTime>
                                                {notification.timestamp}
                                            </LocalDateTime>
                                        </Typography>
                                    )}
                                </Table.Cell>
                                <Table.Cell>
                                    <IconButton
                                        type="button"
                                        title="Obriši obavijest"
                                        size="sm"
                                        color="danger"
                                        disabled={isPending}
                                        onClick={() =>
                                            handleDelete([notification.id])
                                        }
                                    >
                                        <Delete className="size-5" />
                                    </IconButton>
                                </Table.Cell>
                            </Table.Row>
                        );
                    })}
                </Table.Body>
            </Table>
        </Stack>
    );
}
