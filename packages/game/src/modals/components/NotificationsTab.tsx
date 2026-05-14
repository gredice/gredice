import { Approved, Bell, Close, Empty } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { useGameAnalytics } from '../../analytics/GameAnalyticsContext';
import { useMarkAllNotificationsRead } from '../../hooks/useMarkAllNotificationsRead';
import { usePushPermissionOnboarding } from '../../hooks/usePushPermissionOnboarding';
import { NotificationList } from '../../hud/NotificationList';

export function NotificationsTab() {
    const [notificationsFilter, setNotificationsFilter] = useState('unread');
    const markAllNotificationsRead = useMarkAllNotificationsRead();
    const { track } = useGameAnalytics();
    const pushOnboarding = usePushPermissionOnboarding();

    const handleEnablePush = async () => {
        track('game_push_enable_clicked', {
            source: 'overview_notifications_tab',
            status: pushOnboarding.status,
        });

        const result = await pushOnboarding.requestPermission();
        track('game_push_permission_result', {
            source: 'overview_notifications_tab',
            result,
        });
    };

    const handleDismissPushPrompt = () => {
        track('game_push_prompt_dismissed', {
            source: 'overview_notifications_tab',
        });
        pushOnboarding.dismissPrompt();
    };

    const handleMarkAllNotificationsRead = () => {
        track('game_notifications_mark_all_read', {
            source: 'overview_tab',
        });
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
                {pushOnboarding.canPrompt && (
                    <Card className="bg-card p-2">
                        <Stack spacing={1}>
                            <Row
                                justifyContent="space-between"
                                alignItems="start"
                            >
                                <Row spacing={1}>
                                    <Bell className="size-5 text-warning" />
                                    <Stack spacing={0.5}>
                                        <Typography level="body1" semiBold>
                                            Uključi push obavijesti
                                        </Typography>
                                        <Typography level="body2" secondary>
                                            Primaj obavijesti o novim
                                            aktivnostima vrta i narudžbama odmah
                                            nakon objave.
                                        </Typography>
                                    </Stack>
                                </Row>
                                <Button
                                    variant="plain"
                                    size="sm"
                                    onClick={handleDismissPushPrompt}
                                    title="Sakrij"
                                    startDecorator={
                                        <Close className="size-4" />
                                    }
                                >
                                    Kasnije
                                </Button>
                            </Row>
                            <Row justifyContent="end">
                                <Button
                                    size="sm"
                                    onClick={handleEnablePush}
                                    startDecorator={<Bell className="size-4" />}
                                >
                                    Uključi push
                                </Button>
                            </Row>
                        </Stack>
                    </Card>
                )}
                <Card className="bg-card p-1">
                    <Row justifyContent="space-between">
                        <SelectItems
                            value={notificationsFilter}
                            onValueChange={(value) => {
                                track('game_notifications_filter_changed', {
                                    filter: value,
                                });
                                setNotificationsFilter(value);
                            }}
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
