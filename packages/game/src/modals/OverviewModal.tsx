import { useSearchParam } from '@gredice/ui/hooks';
import { List } from '@gredice/ui/List';
import { ListItem } from '@gredice/ui/ListItem';
import { Modal } from '@gredice/ui/Modal';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { Fragment, useEffect } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import {
    isNotificationsFilter,
    notificationsFilterSearchParam,
} from '../notificationFilters';
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

const navGroups = [
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
    const [settingsMode, setProfileModalOpen] = useSearchParam('pregled');
    const [notificationsFilterParam] = useSearchParam(
        notificationsFilterSearchParam,
    );
    const { track } = useGameAnalytics();
    const notificationsFilter = isNotificationsFilter(notificationsFilterParam)
        ? notificationsFilterParam
        : 'unread';

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

    return (
        <Modal
            open={Boolean(settingsMode)}
            onOpenChange={handleOpenChange}
            className="max-h-[90dvh] overflow-hidden md:min-w-full lg:min-w-[80%] xl:min-w-[60%] md:min-h-[70%] md:max-h-full md:border-tertiary md:border-b-4"
            title="Profil"
        >
            <div className="grid max-h-[calc(90dvh-5rem)] grid-rows-[auto_1fr] gap-4 overflow-y-auto pr-1 md:max-h-none md:gap-0 md:grid-rows-1 md:grid-cols-[minmax(230px,auto)_1fr] md:overflow-hidden md:pr-0">
                <Stack spacing={4} className="md:border-r md:pl-2">
                    <ProfileInfo />
                    <SelectItems
                        className="md:hidden bg-card rounded-lg"
                        value={settingsMode}
                        onValueChange={setProfileModalOpen}
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
                                    <ListItem
                                        key={item.nodeId}
                                        nodeId={item.nodeId}
                                        label={item.label}
                                        startDecorator={
                                            <span>{item.icon}</span>
                                        }
                                        selected={settingsMode === item.value}
                                        onSelected={() =>
                                            setProfileModalOpen(item.value)
                                        }
                                    />
                                ))}
                            </Fragment>
                        ))}
                    </List>
                </Stack>
                <div className="overflow-y-auto md:pl-6">
                    {settingsMode === 'generalno' && <GeneralTab />}
                    {settingsMode === 'vrt' && <GardenTab />}
                    {settingsMode === 'igra' && <GameTab />}
                    {settingsMode === 'sigurnost' && <SecurityTab />}
                    {settingsMode === 'dostava' && <DeliveryTab />}
                    {settingsMode === 'zvuk' && <SoundTab />}
                    {settingsMode === 'obavijesti' && (
                        <NotificationsTab initialFilter={notificationsFilter} />
                    )}
                    {settingsMode === 'suncokreti' && <SunflowersTab />}
                    {settingsMode === 'postignuca' && <AchievementsTab />}
                    {settingsMode === 'korisnici' && <AccountUsersTab />}
                    {settingsMode === 'preporuke' && <ReferralsTab />}
                </div>
            </div>
        </Modal>
    );
}
