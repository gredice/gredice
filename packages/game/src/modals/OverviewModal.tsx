import { useSearchParam } from '@signalco/hooks/useSearchParam';
import { List } from '@signalco/ui-primitives/List';
import { ListItem } from '@signalco/ui-primitives/ListItem';
import { Modal } from '@signalco/ui-primitives/Modal';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useEffect } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { ProfileInfo } from '../shared-ui/ProfileInfo';
import { AccountUsersTab } from './components/AccountUsersTab';
import { AchievementsTab } from './components/AchievementsTab';
import { DeliveryTab } from './components/DeliveryTab';
import { GameTab } from './components/GameTab';
import { GardenTab } from './components/GardenTab';
import { GeneralTab } from './components/GeneralTab';
import { NotificationsTab } from './components/NotificationsTab';
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
    const { track } = useGameAnalytics();

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
            className="md:min-w-full lg:min-w-[80%] xl:min-w-[60%] md:min-h-[70%] md:max-h-full md:border-tertiary md:border-b-4"
            title="Profil"
        >
            <div className="grid grid-rows-[auto_1fr] gap-4 md:gap-0 md:grid-rows-1 md:grid-cols-[minmax(230px,auto)_1fr]">
                <Stack spacing={2} className="md:border-r md:pl-2">
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
                            <>
                                <Typography
                                    key={`group-${group.label}`}
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
                            </>
                        ))}
                    </List>
                </Stack>
                <div className="md:pl-6">
                    {settingsMode === 'generalno' && <GeneralTab />}
                    {settingsMode === 'vrt' && <GardenTab />}
                    {settingsMode === 'igra' && <GameTab />}
                    {settingsMode === 'sigurnost' && <SecurityTab />}
                    {settingsMode === 'dostava' && <DeliveryTab />}
                    {settingsMode === 'zvuk' && <SoundTab />}
                    {settingsMode === 'obavijesti' && <NotificationsTab />}
                    {settingsMode === 'suncokreti' && <SunflowersTab />}
                    {settingsMode === 'postignuca' && <AchievementsTab />}
                    {settingsMode === 'korisnici' && <AccountUsersTab />}
                </div>
            </div>
        </Modal>
    );
}
