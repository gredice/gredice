import { Button } from '@gredice/ui/Button';
import { Divider } from '@gredice/ui/Divider';
import { DotIndicator } from '@gredice/ui/DotIndicator';
import { useSearchParam } from '@gredice/ui/hooks';
import { IconButton } from '@gredice/ui/IconButton';
import {
    Approved,
    Comment,
    Configuration,
    ExternalLink,
    Inbox,
    LogOut,
    Sprout,
    User,
} from '@gredice/ui/icons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';
import { Popper } from '@gredice/ui/Popper';
import { Row } from '@gredice/ui/Row';
import { Skeleton } from '@gredice/ui/Skeleton';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useMarkAllNotificationsRead } from '../hooks/useMarkAllNotificationsRead';
import { useNotifications } from '../hooks/useNotifications';
import { KnownPages } from '../knownPages';
import {
    type NotificationsFilter,
    notificationsFilterSearchParam,
} from '../notificationFilters';
import { ProfileAvatar } from '../shared-ui/ProfileAvatar';
import { ProfileInfo } from '../shared-ui/ProfileInfo';
import { HudCard } from './components/HudCard';
import { GardenAccountMenuItems } from './GardenAccountMenuItems';
import { GardenOperationsHud } from './GardenOperationsHud';
import { NotificationList } from './NotificationList';

function useOpenNotificationsOverview() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    return useCallback(
        (filter: NotificationsFilter = 'unread') => {
            const next = new URLSearchParams(
                Array.from(searchParams.entries()),
            );
            next.set('pregled', 'obavijesti');

            if (filter === 'all') {
                next.set(notificationsFilterSearchParam, filter);
            } else {
                next.delete(notificationsFilterSearchParam);
            }

            const query = next.toString();
            const nextUrl = `${pathname}${query ? `?${query}` : ''}`;
            router.replace(nextUrl as Parameters<typeof router.replace>[0]);
        },
        [pathname, router, searchParams],
    );
}

function NotificationsCard({
    onNotificationSelected,
}: {
    onNotificationSelected: () => void;
}) {
    const openNotificationsOverview = useOpenNotificationsOverview();
    const markAllNotificationsRead = useMarkAllNotificationsRead();
    const { track } = useGameAnalytics();
    const { data: currentUser } = useCurrentUser();
    const { data: notifications } = useNotifications(currentUser?.id, false);
    const hasUnreadNotifications = notifications?.some(
        (notification) => !notification.readAt,
    );

    const handleMarkAllNotificationsRead = () => {
        track('game_notifications_mark_all_read', {
            source: 'quick_panel',
        });
        markAllNotificationsRead.mutate({ readWhere: 'game' });
    };

    return (
        <Stack>
            <Row
                className="bg-background px-4 py-2"
                justifyContent="space-between"
            >
                <Typography level="body2" bold>
                    Obavijesti
                </Typography>
                <IconButton
                    variant="plain"
                    size="sm"
                    title="Označi sve kao pročitane"
                    onClick={handleMarkAllNotificationsRead}
                >
                    <Approved />
                </IconButton>
            </Row>
            <Divider />
            <div className="overflow-y-auto max-h-[50vh]">
                {hasUnreadNotifications || !notifications ? (
                    <NotificationList
                        short
                        unreadOnly
                        onNotificationSelected={onNotificationSelected}
                    />
                ) : (
                    <Stack className="p-4" spacing={2} alignItems="center">
                        <Typography level="body3" className="text-center">
                            Nema nepročitanih obavijesti.
                        </Typography>
                        <Button
                            variant="plain"
                            size="sm"
                            onClick={() => {
                                track('game_notifications_view_all_opened', {
                                    source: 'quick_panel_no_unread',
                                });
                                openNotificationsOverview('all');
                            }}
                        >
                            Prikaži sve pročitane
                        </Button>
                    </Stack>
                )}
            </div>
            <Divider />
            <Stack>
                <Button
                    variant="plain"
                    size="sm"
                    fullWidth
                    className="rounded-t-none"
                    onClick={() => {
                        track('game_notifications_view_all_opened', {
                            source: 'quick_panel',
                        });
                        openNotificationsOverview('all');
                    }}
                >
                    Prikaži sve obavijesti
                </Button>
            </Stack>
        </Stack>
    );
}

function ProfileCard() {
    const [, setProfileModalOpen] = useSearchParam('pregled');
    const openNotificationsOverview = useOpenNotificationsOverview();
    const { track } = useGameAnalytics();
    const { data: currentUser } = useCurrentUser();
    const { data: notifications } = useNotifications(currentUser?.id, false);
    const hasUnreadNotifications = notifications?.some(
        (notification) => !notification.readAt,
    );

    return (
        <DropdownMenuContent className="w-80 p-4" align="end" sideOffset={12}>
            <ProfileInfo />
            <DropdownMenuSeparator className="my-4" />
            <GardenAccountMenuItems
                onGardenOverviewOpen={() => setProfileModalOpen('vrt')}
            />
            <DropdownMenuSeparator className="my-4" />
            <DropdownMenuItem
                className="gap-3"
                onClick={() => setProfileModalOpen('generalno')}
            >
                <User className="size-4" />
                <span>Profil</span>
            </DropdownMenuItem>
            <DropdownMenuItem
                className="gap-3"
                onClick={() => openNotificationsOverview()}
                endDecorator={
                    hasUnreadNotifications && <DotIndicator color={'success'} />
                }
            >
                <Inbox className="size-4" />
                <span>Obavijesti</span>
            </DropdownMenuItem>
            <DropdownMenuItem
                className="gap-3"
                onClick={() => setProfileModalOpen('generalno')}
            >
                <Configuration className="size-4" />
                <span>Postavke</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-4" />
            <DropdownMenuItem
                className="gap-3 justify-between"
                href={KnownPages.GredicePlants}
                onClick={() =>
                    track('game_external_link_opened', {
                        destination: 'plant_database',
                        source: 'profile_menu',
                    })
                }
            >
                <Row spacing={3}>
                    <Sprout className="size-4" />
                    <span>Baza biljaka</span>
                </Row>
                <ExternalLink className="size-4 self-end" />
            </DropdownMenuItem>
            <DropdownMenuItem
                className="gap-3 justify-between"
                href={KnownPages.GrediceContact}
                onClick={() =>
                    track('game_external_link_opened', {
                        destination: 'contact',
                        source: 'profile_menu',
                    })
                }
            >
                <Row spacing={3}>
                    <Comment className="size-4" />
                    <span>Kontaktiraj nas</span>
                </Row>
                <ExternalLink className="size-4 self-end" />
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-4" />
            <DropdownMenuItem className="gap-3" href="/odjava">
                <LogOut className="size-4" />
                <span>Odjava</span>
            </DropdownMenuItem>
        </DropdownMenuContent>
    );
}

export function AccountHud() {
    const { track } = useGameAnalytics();
    const [isNotificationsOpen, setNotificationsOpen] = useState(false);
    const { data: currentUser } = useCurrentUser();
    const { data: currentGarden, isLoading } = useCurrentGarden();
    const { data: notifications } = useNotifications(currentUser?.id, false);
    const hasUnreadNotifications = notifications?.some(
        (notification) => !notification.readAt,
    );

    return (
        <HudCard open position="floating" className="p-0.5 md:px-2 static">
            <Row spacing={2}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <IconButton
                            className="size-10 md:size-auto relative rounded-full p-0.5 aspect-square shrink-0 md:hover:outline outline-offset-2 outline-tertiary-foreground"
                            variant="plain"
                            title="Profil"
                            onClick={() => track('game_profile_menu_opened')}
                        >
                            <ProfileAvatar variant="transparentOnMobile" />
                            {hasUnreadNotifications && (
                                <div className="md:hidden absolute right-0 -top-1">
                                    <DotIndicator size={14} color={'success'} />
                                </div>
                            )}
                        </IconButton>
                    </DropdownMenuTrigger>
                    <ProfileCard />
                </DropdownMenu>
                <div className="md:order-3">
                    <GardenOperationsHud />
                </div>
                <div className="hidden md:block md:order-1">
                    {isLoading ? (
                        <Skeleton className="w-32 h-7" />
                    ) : (
                        currentGarden && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        className="w-32 justify-start overflow-hidden px-2"
                                        variant="plain"
                                        title="Odaberi vrt"
                                    >
                                        <Typography noWrap>
                                            {currentGarden.name}
                                        </Typography>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    className="w-72 p-2"
                                    align="start"
                                    sideOffset={12}
                                >
                                    <GardenAccountMenuItems />
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )
                    )}
                </div>
                <div className="md:order-2">
                    <Popper
                        className="w-[min(24rem,calc(100vw-1rem))] overflow-hidden border-tertiary border-b-4"
                        side="bottom"
                        sideOffset={12}
                        open={isNotificationsOpen}
                        onOpenChange={setNotificationsOpen}
                        trigger={
                            <Button
                                className="relative rounded-full p-0 aspect-square"
                                variant="plain"
                                title="Obavijesti"
                                onClick={() =>
                                    track('game_notifications_opened', {
                                        source: 'quick_panel',
                                    })
                                }
                            >
                                {hasUnreadNotifications && (
                                    <div className="absolute right-1 top-1">
                                        <DotIndicator color={'success'} />
                                    </div>
                                )}
                                <Inbox className="size-5" />
                            </Button>
                        }
                    >
                        <NotificationsCard
                            onNotificationSelected={() =>
                                setNotificationsOpen(false)
                            }
                        />
                    </Popper>
                </div>
            </Row>
        </HudCard>
    );
}
