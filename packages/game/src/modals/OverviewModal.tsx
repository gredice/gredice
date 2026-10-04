import { useSearchParam } from '@gredice/ui/hooks';
import { Stack } from '@gredice/ui/Stack';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
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
import { OverviewNavigation } from './OverviewNavigation';
import { overviewNavItems } from './overviewNavigationItems';

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
        const selectedItem = overviewNavItems.find(
            (item) => item.value === value,
        );
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
                    <OverviewNavigation
                        value={settingsMode}
                        onValueChange={handleNavSelection}
                    />
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
