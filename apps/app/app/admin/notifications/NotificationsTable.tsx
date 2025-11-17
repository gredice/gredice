import type { SelectNotification } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Table } from '@signalco/ui-primitives/Table';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';

type NotificationsTableProps = {
    notifications: SelectNotification[];
    accountLabels: Record<string, string>;
};

export function NotificationsTable({
    notifications,
    accountLabels,
}: NotificationsTableProps) {
    if (notifications.length === 0) {
        return (
            <div className="py-8">
                <NoDataPlaceholder>Nema obavijesti</NoDataPlaceholder>
            </div>
        );
    }

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>Naslov</Table.Head>
                    <Table.Head>Sadržaj</Table.Head>
                    <Table.Head>Link</Table.Head>
                    <Table.Head>Račun</Table.Head>
                    <Table.Head>Korisnik</Table.Head>
                    <Table.Head>Vrt</Table.Head>
                    <Table.Head>Gredica</Table.Head>
                    <Table.Head>Datum</Table.Head>
                    <Table.Head>Stvoreno</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {notifications.map((notification) => (
                    <Table.Row key={notification.id}>
                        <Table.Cell>{notification.header}</Table.Cell>
                        <Table.Cell className="max-w-xs whitespace-pre-wrap">
                            {notification.content}
                        </Table.Cell>
                        <Table.Cell>
                            {notification.linkUrl ? (
                                <a
                                    href={notification.linkUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary underline"
                                >
                                    Otvori
                                </a>
                            ) : (
                                '-'
                            )}
                        </Table.Cell>
                        <Table.Cell>
                            {accountLabels[notification.accountId] ||
                                notification.accountId}
                        </Table.Cell>
                        <Table.Cell>{notification.userId || '-'}</Table.Cell>
                        <Table.Cell>{notification.gardenId || '-'}</Table.Cell>
                        <Table.Cell>
                            {notification.raisedBedId || '-'}
                        </Table.Cell>
                        <Table.Cell>
                            <LocalDateTime>
                                {notification.timestamp}
                            </LocalDateTime>
                        </Table.Cell>
                        <Table.Cell>
                            <LocalDateTime>
                                {notification.createdAt}
                            </LocalDateTime>
                        </Table.Cell>
                    </Table.Row>
                ))}
            </Table.Body>
        </Table>
    );
}
