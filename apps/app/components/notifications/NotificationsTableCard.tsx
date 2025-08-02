import { Card, CardHeader, CardTitle, CardOverflow } from "@signalco/ui-primitives/Card";
import { getNotificationsByAccount, getNotificationsByUser } from "@gredice/storage";
import { Table } from "@signalco/ui-primitives/Table";
import { LocaleDateTime } from "../shared/LocaleDateTime";
import { NotificationCreateModal } from "./NotificationCreateModal";
import { Row } from "@signalco/ui-primitives/Row";
import { ServerActionIconButton } from "../shared/ServerActionIconButton";
import { Delete } from "@signalco/ui-icons";
import { deleteNotification } from "./(actions)/notificationActions";
import { NoDataPlaceholder } from "../shared/placeholders/NoDataPlaceholder";

type NotificationTableCardProps = {
    accountId?: string;
    userId?: string;
    gardenId?: number;
    raisedBedId?: number;
};

export async function NotificationsTableCard({ accountId, userId, gardenId, raisedBedId }: NotificationTableCardProps) {
    const accountNotifications = accountId
        ? await getNotificationsByAccount(accountId, true, 0, 10000)
        : [];

    const userNotifications = userId
        ? await getNotificationsByUser(userId, true, 0, 10000)
        : [];

    // Filter notifications by gardenId or raisedBedId if provided
    const filteredNotifications = [...accountNotifications, ...userNotifications].filter(notification => {
        if (gardenId && notification.gardenId !== gardenId) return false;
        if (raisedBedId && notification.raisedBedId !== raisedBedId) return false;
        return true;
    });

    return (
        <Card>
            <CardHeader>
                <Row justifyContent="space-between">
                    <CardTitle>Obavijesti</CardTitle>
                    <NotificationCreateModal
                        userId={userId}
                        gardenId={gardenId}
                        raisedBedId={raisedBedId}
                        accountId={accountId}
                    />
                </Row>
            </CardHeader>
            <CardOverflow className="max-h-96 overflow-auto">
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>Naslov</Table.Head>
                            <Table.Head>Sadržaj</Table.Head>
                            <Table.Head>Link</Table.Head>
                            <Table.Head>Slika</Table.Head>
                            <Table.Head>Blok ID</Table.Head>
                            <Table.Head>Račun ID</Table.Head>
                            <Table.Head>Korisnik ID</Table.Head>
                            <Table.Head>Vrt ID</Table.Head>
                            <Table.Head>Pročitano</Table.Head>
                            <Table.Head>Datum obavijesti</Table.Head>
                            <Table.Head>ID</Table.Head>
                            <Table.Head>Akcije</Table.Head>
                            <Table.Head>Stvoreno</Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {filteredNotifications.map(notification => (
                            <Table.Row key={notification.id}>
                                <Table.Cell>{notification.header}</Table.Cell>
                                <Table.Cell>{notification.content}</Table.Cell>
                                <Table.Cell>
                                    {notification.linkUrl ? (
                                        <a href={notification.linkUrl} target="_blank" rel="noopener noreferrer">
                                            {notification.linkUrl}
                                        </a>
                                    ) : (
                                        "-"
                                    )}
                                </Table.Cell>
                                <Table.Cell>
                                    {notification.imageUrl ? (
                                        <a href={notification.imageUrl} target="_blank" rel="noopener noreferrer">
                                            Pogledaj sliku
                                        </a>
                                    ) : (
                                        "-"
                                    )}
                                </Table.Cell>
                                <Table.Cell>{notification.blockId || "-"}</Table.Cell>
                                <Table.Cell>{notification.accountId || "-"}</Table.Cell>
                                <Table.Cell>{notification.userId || "-"}</Table.Cell>
                                <Table.Cell>{notification.gardenId || "-"}</Table.Cell>
                                <Table.Cell>{notification.readAt ? "Da" : "Ne"}</Table.Cell>
                                <Table.Cell>
                                    <LocaleDateTime>{notification.timestamp}</LocaleDateTime>
                                </Table.Cell>
                                <Table.Cell>{notification.id}</Table.Cell>
                                <Table.Cell>
                                    {accountId && (
                                        <ServerActionIconButton
                                            title="Obriši obavijest"
                                            onClick={deleteNotification.bind(null, accountId, null, notification.id)}
                                        >
                                            <Delete className="size-5" />
                                        </ServerActionIconButton>
                                    )}
                                </Table.Cell>
                                <Table.Cell><LocaleDateTime>{notification.createdAt}</LocaleDateTime></Table.Cell>
                            </Table.Row>
                        ))}
                        {accountNotifications.length === 0 && userNotifications.length === 0 && (
                            <Table.Row>
                                <Table.Cell colSpan={12}>
                                    <NoDataPlaceholder>Nema obavjesti</NoDataPlaceholder>
                                </Table.Cell>
                            </Table.Row>
                        )}
                    </Table.Body>
                </Table>
            </CardOverflow>
        </Card>
    );
}