import { useSearchParam } from '@gredice/ui/hooks';
import { List } from '@gredice/ui/List';
import { ListItem } from '@gredice/ui/ListItem';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useRef } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { useMarkTutorialChecklistTaskReady } from '../hooks/useTutorialChecklist';
import {
    isNotificationsFilter,
    isNotificationsView,
    notificationsFilterSearchParam,
    notificationsViewSearchParam,
} from '../notificationFilters';
import { GameModal } from '../shared-ui/game-modal';
import { ProfileInfo } from '../shared-ui/ProfileInfo';
import { AccountUsersTab } from './components/AccountUsersTab';
import { AchievementsTab } from './components/AchievementsTab';
import { DeliveryTab } from './components/DeliveryTab';
import { GameTab } from './components/GameTab';
import { GardenTab } from './components/GardenTab';
import { GeneralTab } from './components/GeneralTab';
import { NotificationsTab } from './components/NotificationsTab';
import { ReferralsTab } from './components/ReferralsTab';
import { SecurityTab } from './components/SecurityTab';
import { SoundTab } from './components/SoundTab';
import { SunflowersTab } from './components/SunflowersTab';

type OverviewNavItem = {
    nodeId: string;
    icon: string;
    label: string;
    value: string;
    href?: '/racun/naplata';
};

type OverviewNavGroup = {
    label: string;
    items: OverviewNavItem[];
};

const navGroups: OverviewNavGroup[] = [
    {
        label: 'Profil',
        items: [
            {
                nodeId: 'profile-general',
                icon: '⚙️',
                label: 'Generalno',
                value: 'generalno',
            },
            {
                nodeId: 'profile-achievements',
                icon: '🏆',
                label: 'Postignuća',
                value: 'postignuca',
            },
            {
                nodeId: 'profile-sunflowers',
                icon: '🌻',
                label: 'Suncokreti',
                value: 'suncokreti',
            },
            {
                nodeId: 'profile-delivery',
                icon: '🚚',
                label: 'Dostava',
                value: 'dostava',
            },
            {
                nodeId: 'profile-notifications',
                icon: '🔔',
                label: 'Obavijesti',
                value: 'obavijesti',
            },
            {
                nodeId: 'profile-referrals',
                icon: '💮',
                label: 'Preporuke',
                value: 'preporuke',
            },
        ],
    },
    {
        label: 'Račun',
        items: [
            {
                nodeId: 'account-garden',
                icon: '🏡',
                label: 'Vrt',
                value: 'vrt',
            },
            {
                nodeId: 'account-users',
                icon: '👥',
                label: 'Korisnici',
                value: 'korisnici',
            },
            {
                nodeId: 'account-billing',
                icon: '🧾',
                label: 'Računi i plaćanja',
                value: 'racuni',
                href: '/racun/naplata',
            },
        ],
    },
    {
        label: 'Postavke',
        items: [
            {
                nodeId: 'settings-game',
                icon: '🎮',
                label: 'Igra',
                value: 'igra',
            },
            {
                nodeId: 'profile-security',
                icon: '🔒',
                label: 'Sigurnost',
                value: 'sigurnost',
            },
            {
                nodeId: 'profile-sound',
                icon: '🔊',
                label: 'Zvuk',
                value: 'zvuk',
            },
        ],
    },
];

const allNavItems = navGroups.flatMap((g) => g.items);

export function OverviewModal() {
    const router = useRouter();
    const [settingsMode, setProfileModalOpen] = useSearchParam('pregled');
    const [notificationsFilterParam] = useSearchParam(
        notificationsFilterSearchParam,
    );
    const [notificationsViewParam] = useSearchParam(
        notificationsViewSearchParam,
    );
    const { track } = useGameAnalytics();
    const notificationsFilter = isNotificationsFilter(notificationsFilterParam)
        ? notificationsFilterParam
        : 'unread';
    const notificationsView = isNotificationsView(notificationsViewParam)
        ? notificationsViewParam
        : 'notifications';
    const { mutate: markNotificationsTaskReady } =
        useMarkTutorialChecklistTaskReady();
    const { mutate: markConfigureNotificationsTaskReady } =
        useMarkTutorialChecklistTaskReady();
    const markedNotificationChecklistTasksRef = useRef(false);

    useEffect(() => {
        if (
            settingsMode !== 'obavijesti' ||
            markedNotificationChecklistTasksRef.current
        ) {
            return;
        }

        markedNotificationChecklistTasksRef.current = true;
        markNotificationsTaskReady('open-notifications');
        markConfigureNotificationsTaskReady('configure-notifications');
    }, [
        markConfigureNotificationsTaskReady,
        markNotificationsTaskReady,
        settingsMode,
    ]);

    useEffect(() => {
        if (!settingsMode) {
            return;
        }

        track('game_overview_section_opened', {
            section: settingsMode,
        });
    }, [settingsMode, track]);

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setProfileModalOpen(undefined);
        }
    };

    const handleNavSelection = (value: string) => {
        const selectedItem = allNavItems.find((item) => item.value === value);
        if (selectedItem?.href) {
            router.push(selectedItem.href);
            return;
        }

        setProfileModalOpen(value);
    };

    return (
        <GameModal
            open={Boolean(settingsMode)}
            onOpenChange={handleOpenChange}
            className="max-h-[90dvh] overflow-hidden md:min-w-full lg:min-w-[80%] xl:min-w-[60%] md:min-h-[70%] md:max-h-full"
            title="Profil"
        >
            <div className="grid max-h-[calc(90dvh-5rem)] min-h-0 grid-rows-[auto_1fr] gap-4 overflow-y-auto pr-1 md:gap-0 md:grid-rows-1 md:grid-cols-[minmax(230px,auto)_1fr] md:overflow-hidden md:pr-0">
                <Stack spacing={4} className="md:border-r md:pl-2">
                    <ProfileInfo />
                    <SelectItems
                        className="md:hidden bg-card rounded-lg"
                        value={settingsMode}
                        onValueChange={handleNavSelection}
                        items={allNavItems.map((item) => ({
                            label: `${item.icon} ${item.label}`,
                            value: item.value,
                        }))}
                    />
                    <List className="md:pr-6 hidden md:flex">
                        {navGroups.map((group) => (
                            <Fragment key={group.label}>
                                <Typography
                                    level="body3"
                                    uppercase
                                    bold
                                    className="py-4"
                                >
                                    {group.label}
                                </Typography>
                                {group.items.map((item) => (
                                    <Fragment key={item.nodeId}>
                                        {item.href ? (
                                            <ListItem
                                                href={item.href}
                                                label={item.label}
                                                startDecorator={
                                                    <span>{item.icon}</span>
                                                }
                                            />
                                        ) : (
                                            <ListItem
                                                nodeId={item.nodeId}
                                                label={item.label}
                                                startDecorator={
                                                    <span>{item.icon}</span>
                                                }
                                                selected={
                                                    settingsMode === item.value
                                                }
                                                onSelected={() =>
                                                    handleNavSelection(
                                                        item.value,
                                                    )
                                                }
                                            />
                                        )}
                                    </Fragment>
                                ))}
                            </Fragment>
                        ))}
                    </List>
                </Stack>
                <div className="min-h-0 overflow-visible md:overflow-y-auto md:pl-6">
                    {settingsMode === 'generalno' && <GeneralTab />}
                    {settingsMode === 'vrt' && <GardenTab />}
                    {settingsMode === 'igra' && <GameTab />}
                    {settingsMode === 'sigurnost' && <SecurityTab />}
                    {settingsMode === 'dostava' && <DeliveryTab />}
                    {settingsMode === 'zvuk' && <SoundTab />}
                    {settingsMode === 'obavijesti' && (
                        <NotificationsTab
                            initialFilter={notificationsFilter}
                            initialView={notificationsView}
                        />
                    )}
                    {settingsMode === 'suncokreti' && <SunflowersTab />}
                    {settingsMode === 'postignuca' && <AchievementsTab />}
                    {settingsMode === 'korisnici' && <AccountUsersTab />}
                    {settingsMode === 'preporuke' && <ReferralsTab />}
                </div>
            </div>
        </GameModal>
    );
}
