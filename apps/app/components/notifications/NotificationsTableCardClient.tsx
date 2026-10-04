'use client';

import { Card, CardHeader, CardOverflow, CardTitle } from '@gredice/ui/Card';
import { IconButton } from '@gredice/ui/IconButton';
import { Delete } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { cx } from '@gredice/ui/utils';
import { useEffect, useMemo, useState, useTransition } from 'react';
import {
    scrollableTableCardClassName,
    scrollableTableCardOverflowClassName,
} from '../admin/cards/tableCardLayout';
import { NotificationCreateModal } from './NotificationCreateModal';
import {
    type DeleteNotificationsAction,
    type NotificationDeleteContext,
    NotificationsTable,
    type NotificationTableRow,
} from './NotificationsTable';

type AccountOption = {
    id: string;
    label: string;
};

type NotificationsTableCardClientProps = {
    accountId?: string;
    accounts: AccountOption[];
    deleteContext: NotificationDeleteContext;
    deleteNotificationsAction: DeleteNotificationsAction;
    notifications: NotificationTableRow[];
    scroll: boolean;
    showAccountColumn: boolean;
    showCard: boolean;
};

function buildDeleteConfirmMessage(count: number) {
    return count === 1
        ? 'Da li ste sigurni da želite obrisati odabranu obavijest?'
        : `Da li ste sigurni da želite obrisati ${count} odabrane obavijesti?`;
}

export function NotificationsTableCardClient({
    accountId,
    accounts,
    deleteContext,
    deleteNotificationsAction,
    notifications,
    scroll,
    showAccountColumn,
    showCard,
}: NotificationsTableCardClientProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isPending, startTransition] = useTransition();
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

    function handleNotificationSelected(id: string, selected: boolean) {
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

    function handleDelete(notificationIds: string[]) {
        if (notificationIds.length === 0) {
            return;
        }

        if (!confirm(buildDeleteConfirmMessage(notificationIds.length))) {
            return;
        }

        startTransition(async () => {
            try {
                const result = await deleteNotificationsAction(
                    notificationIds,
                    deleteContext,
                );
                if (!result.success) {
                    alert('Došlo je do greške pri brisanju obavijesti.');
                    return;
                }

                setSelectedIds((current) => {
                    const next = new Set(current);
                    for (const id of notificationIds) {
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

    const tableContent = (
        <NotificationsTable
            isPending={isPending}
            notifications={notifications}
            onDeleteNotification={(notificationId) =>
                handleDelete([notificationId])
            }
            onNotificationSelected={handleNotificationSelected}
            selectedIds={selectedIds}
            showAccountColumn={showAccountColumn}
        />
    );

    const bulkDeleteButton =
        selectedIds.size > 0 ? (
            <IconButton
                type="button"
                title="Obriši odabrane obavijesti"
                size="sm"
                variant="plain"
                color="danger"
                loading={isPending}
                onClick={() => handleDelete(Array.from(selectedIds))}
            >
                <Delete className="size-5" />
            </IconButton>
        ) : null;

    if (!showCard) {
        return (
            <div>
                {bulkDeleteButton && (
                    <Row
                        justifyContent="end"
                        className="border-b px-3 py-2 sm:px-4"
                    >
                        {bulkDeleteButton}
                    </Row>
                )}
                {tableContent}
            </div>
        );
    }

    return (
        <Card className={cx('min-w-0', scroll && scrollableTableCardClassName)}>
            <CardHeader>
                <Row justifyContent="space-between">
                    <CardTitle>Obavijesti</CardTitle>
                    <Row spacing={2}>
                        {bulkDeleteButton}
                        <NotificationCreateModal
                            accountId={accountId}
                            accounts={accounts}
                        />
                    </Row>
                </Row>
            </CardHeader>
            <CardOverflow
                className={cx(scroll && scrollableTableCardOverflowClassName)}
            >
                {tableContent}
            </CardOverflow>
        </Card>
    );
}
