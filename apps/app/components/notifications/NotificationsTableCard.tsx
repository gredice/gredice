import { Card, CardHeader, CardTitle, CardOverflow } from "@signalco/ui-primitives/Card";
import { getNotificationsByAccount, getNotificationsByUser } from "@gredice/storage";
import { Table } from "@signalco/ui-primitives/Table";
import { LocaleDateTime } from "../shared/LocaleDateTime";
import { NotificationCreateModal } from "./NotificationCreateModal";
import { Row } from "@signalco/ui-primitives/Row";
import { ServerActionIconButton } from "../shared/ServerActionIconButton";
import { Delete } from "@signalco/ui-icons";
import { deleteNotification } from "./(actions)/notificationActions";

export async function NotificationsTableCard({ accountId, userId }: { accountId?: string; userId?: string, gardenId?: number }) {
    const accountNotificaitons = accountId
        ? await getNotificationsByAccount(accountId, true, 0, 10000)
        : [];

    const userNotifications = userId
        ? await getNotificationsByUser(userId, true, 0, 10000)
        : [];

    return (
        <Card>
            <CardHeader>
                <Row justifyContent="space-between">
                    <CardTitle>Obavijesti</CardTitle>
                    <NotificationCreateModal accountId={accountId} />
                </Row>
            </CardHeader>
            <CardOverflow>
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
                            <Table.Head>Stvoreno</Table.Head>
                            <Table.Head>Pročitano</Table.Head>
                            <Table.Head>ID</Table.Head>
                            <Table.Head>Akcije</Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {[...accountNotificaitons, ...userNotifications].map(notification => (
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
                                <Table.Cell><LocaleDateTime>{notification.createdAt}</LocaleDateTime></Table.Cell>
                                <Table.Cell>{notification.readAt ? "Da" : "Ne"}</Table.Cell>
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
                            </Table.Row>
                        ))}
                        {accountNotificaitons.length === 0 && userNotifications.length === 0 && (
                            <Table.Row>
                                <Table.Cell colSpan={3}>
                                    <div className="text-center text-gray-500">Nema obavijesti</div>
                                </Table.Cell>
                            </Table.Row>
                        )}
                    </Table.Body>
                </Table>
            </CardOverflow>
        </Card>
    );
}