import { Approved, Empty } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { useMarkAllNotificationsRead } from '../../hooks/useMarkAllNotificationsRead';
import { NotificationList } from '../../hud/NotificationList';

export function NotificationsTab() {
    const [notificationsFilter, setNotificationsFilter] = useState('unread');
    const markAllNotificationsRead = useMarkAllNotificationsRead();

    const handleMarkAllNotificationsRead = () => {
        markAllNotificationsRead.mutate({ readWhere: 'game' });
    };

    return (
        <Stack spacing={1}>
            <Row justifyContent="space-between">
                <Typography level="h4" className="hidden md:block">
                    🔔 Obavijesti
                </Typography>
            </Row>
            <Stack spacing={1}>
                <Card className="bg-card p-1">
                    <Row justifyContent="space-between">
                        <SelectItems
                            value={notificationsFilter}
                            onValueChange={setNotificationsFilter}
                            items={[
                                {
                                    label: 'Nepročitane',
                                    value: 'unread',
                                    icon: <Empty className="size-4" />,
                                },
                                {
                                    label: 'Sve obavijesti',
                                    value: 'all',
                                    icon: <Approved className="size-4" />,
                                },
                            ]}
                        />
                        <Button
                            variant="plain"
                            size="sm"
                            onClick={handleMarkAllNotificationsRead}
                            startDecorator={<Approved className="size-4" />}
                        >
                            Sve pročitano
                        </Button>
                    </Row>
                </Card>
                <div className="overflow-y-auto max-h-[calc(100dvh-18rem)] md:max-h-[calc(100dvh-24rem)] rounded-lg text-card-foreground bg-card shadow-sm p-0">
                    <NotificationList read={notificationsFilter === 'all'} />
                </div>
            </Stack>
        </Stack>
    );
}
