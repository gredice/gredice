import {
    getAccounts,
    getAllRaisedBeds,
    getGardens,
    getNotifications,
    getNotificationsByAccount,
    getNotificationsByUser,
} from '@gredice/storage';
import { ImageViewer } from '@gredice/ui/ImageViewer';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Markdown } from '@gredice/ui/Markdown';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { Delete } from '@signalco/ui-icons';
import {
    Card,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Chip } from '@signalco/ui-primitives/Chip';
import { cx } from '@signalco/ui-primitives/cx';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { KnownPages } from '../../src/KnownPages';
import { NoDataPlaceholder } from '../shared/placeholders/NoDataPlaceholder';
import { ServerActionIconButton } from '../shared/ServerActionIconButton';
import { deleteNotification } from './(actions)/notificationActions';
import { NotificationCreateModal } from './NotificationCreateModal';

type NotificationTableCardProps = {
    accountId?: string;
    userId?: string;
    gardenId?: number;
    raisedBedId?: number;
    showCard?: boolean;
    showAccountLabels?: boolean;
    limit?: number;
    page?: number;
    scroll?: boolean;
};

export async function NotificationsTableCard({
    accountId,
    userId,
    gardenId,
    raisedBedId,
    showCard = true,
    showAccountLabels = false,
    limit = 10000,
    page = 0,
    scroll = false,
}: NotificationTableCardProps) {
    // Determine what to fetch based on provided filters
    const fetchAll = !accountId && !userId;

    const [
        accountNotifications,
        userNotifications,
        allNotifications,
        gardens,
        raisedBeds,
        accounts,
    ] = await Promise.all([
        accountId
            ? getNotificationsByAccount(accountId, true, page, limit)
            : Promise.resolve([]),
        userId
            ? getNotificationsByUser(userId, true, page, limit)
            : Promise.resolve([]),
        fetchAll ? getNotifications(page, limit) : Promise.resolve([]),
        getGardens(),
        getAllRaisedBeds(),
        getAccounts(),
    ]);

    // Build account labels if needed
    const accountLabels: Record<string, string> = {};
    if (showAccountLabels) {
        for (const account of accounts) {
            const users =
                account.accountUsers
                    ?.map((accountUser) => accountUser.user?.userName)
                    .filter(Boolean) ?? [];
            accountLabels[account.id] = users.join(', ') || account.id;
        }
    }

    // Combine notifications from different sources
    const combinedNotifications = fetchAll
        ? allNotifications
        : [...accountNotifications, ...userNotifications];

    // Filter notifications by gardenId or raisedBedId if provided
    const filteredNotifications = combinedNotifications.filter(
        (notification) => {
            if (gardenId && notification.gardenId !== gardenId) return false;
            if (raisedBedId && notification.raisedBedId !== raisedBedId)
                return false;
            return true;
        },
    );

    const tableContent = (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>Sadržaj</Table.Head>
                    <Table.Head>Link</Table.Head>
                    <Table.Head>Mjesto</Table.Head>
                    <Table.Head>Račun</Table.Head>
                    <Table.Head>Korisnik</Table.Head>
                    <Table.Head>Pročitano</Table.Head>
                    <Table.Head>Datum</Table.Head>
                    <Table.Head>Akcije</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {filteredNotifications.length === 0 && (
                    <Table.Row>
                        <Table.Cell colSpan={8}>
                            <NoDataPlaceholder>
                                Nema obavjesti
                            </NoDataPlaceholder>
                        </Table.Cell>
                    </Table.Row>
                )}
                {filteredNotifications.map((notification) => {
                    const notificationRaisedBed = notification.raisedBedId
                        ? raisedBeds.find(
                              (rb) => rb.id === notification.raisedBedId,
                          )
                        : null;

                    return (
                        <Table.Row key={notification.id}>
                            <Table.Cell className="max-w-xs whitespace-pre-wrap">
                                <Row spacing={2}>
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
                                            {gardens.find(
                                                (garden) =>
                                                    garden.id ===
                                                    notification.gardenId,
                                            )?.name ?? 'N/A'}
                                        </Link>
                                    )}
                                    {notification.raisedBedId && (
                                        <RaisedBedLabel
                                            physicalId={
                                                notificationRaisedBed?.physicalId ??
                                                null
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
                            <Table.Cell>
                                {notification.accountId ? (
                                    <Link
                                        href={KnownPages.Account(
                                            notification.accountId,
                                        )}
                                        className="text-primary underline"
                                    >
                                        {accountLabels[
                                            notification.accountId
                                        ] || notification.accountId}
                                    </Link>
                                ) : (
                                    '-'
                                )}
                            </Table.Cell>
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
                                {Math.abs(
                                    new Date(notification.createdAt).getTime() -
                                        new Date(
                                            notification.timestamp,
                                        ).getTime(),
                                ) > 1000 && (
                                    <Typography level="body3">
                                        <LocalDateTime>
                                            {notification.timestamp}
                                        </LocalDateTime>
                                    </Typography>
                                )}
                            </Table.Cell>
                            <Table.Cell>
                                {accountId && (
                                    <ServerActionIconButton
                                        title="Obriši obavijest"
                                        onClick={deleteNotification.bind(
                                            null,
                                            accountId,
                                            null,
                                            notification.id,
                                        )}
                                    >
                                        <Delete className="size-5" />
                                    </ServerActionIconButton>
                                )}
                            </Table.Cell>
                        </Table.Row>
                    );
                })}
            </Table.Body>
        </Table>
    );

    if (!showCard) {
        return tableContent;
    }

    return (
        <Card>
            <CardHeader>
                <Row justifyContent="space-between">
                    <CardTitle>Obavijesti</CardTitle>
                    <NotificationCreateModal
                        accountId={accountId}
                        accounts={accounts.map((account) => ({
                            id: account.id,
                            label: accountLabels[account.id] || account.id,
                        }))}
                    />
                </Row>
            </CardHeader>
            <CardOverflow className={cx(scroll && 'max-h-96 overflow-auto')}>
                {tableContent}
            </CardOverflow>
        </Card>
    );
}
