import { Check, MapPinHouse } from '@gredice/ui/icons';
import {
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@gredice/ui/Menu';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useQueryClient } from '@tanstack/react-query';
import { Fragment } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useGardenAccountGroups } from '../hooks/useGardenAccountGroups';
import { useGardens } from '../hooks/useGardens';
import { useSwitchGardenAccount } from '../hooks/useSwitchGardenAccount';
import { useCurrentGardenIdParam } from '../useUrlState';

type GardenAccountMenuItemsProps = {
    onGardenOverviewOpen?: () => void;
};

export function GardenAccountMenuItems({
    onGardenOverviewOpen,
}: GardenAccountMenuItemsProps) {
    const queryClient = useQueryClient();
    const [, setSelectedGardenId] = useCurrentGardenIdParam();
    const { track } = useGameAnalytics();
    const { data: currentGarden } = useCurrentGarden();
    const { data: currentAccountGardens, isLoading: currentGardensLoading } =
        useGardens();
    const { data: accountGroups, isLoading: accountGroupsLoading } =
        useGardenAccountGroups();
    const switchGardenAccount = useSwitchGardenAccount();
    const fallbackGroups =
        currentAccountGardens && currentAccountGardens.length > 0
            ? [
                  {
                      accountId: 'current',
                      name: 'Trenutni račun',
                      isCurrent: true,
                      gardens: currentAccountGardens,
                  },
              ]
            : [];
    const gardenGroups =
        accountGroups && accountGroups.length > 0
            ? accountGroups
            : fallbackGroups;
    const visibleGroups = gardenGroups.filter(
        (group) => group.gardens.length > 0,
    );
    const showAccountLabels =
        visibleGroups.length > 1 ||
        visibleGroups.some((accountGroup) => !accountGroup.isCurrent);
    const isLoading = currentGardensLoading || accountGroupsLoading;

    async function handleGardenSelect(
        accountGroup: (typeof visibleGroups)[number],
        garden: (typeof visibleGroups)[number]['gardens'][number],
    ) {
        if (switchGardenAccount.isPending) {
            return;
        }

        track('game_garden_switched', {
            from_garden_id: currentGarden?.id,
            to_garden_id: garden.id,
            to_garden_name: garden.name,
            to_account_id: accountGroup.accountId,
            switched_account: !accountGroup.isCurrent,
        });

        try {
            if (!accountGroup.isCurrent) {
                await switchGardenAccount.mutateAsync({
                    accountId: accountGroup.accountId,
                });
                await queryClient.invalidateQueries();
                await setSelectedGardenId(garden.id);
                return;
            }

            const isDefault = currentAccountGardens?.[0]?.id === garden.id;
            await setSelectedGardenId(isDefault ? null : garden.id);
        } catch (error) {
            console.error('Failed to switch garden account:', error);
        }
    }

    if (isLoading) {
        return (
            <DropdownMenuLabel className="text-muted-foreground">
                Učitavanje vrtova...
            </DropdownMenuLabel>
        );
    }

    if (visibleGroups.length <= 0) {
        return (
            <>
                <DropdownMenuLabel className="text-muted-foreground text-center">
                    Još nemaš svoj vrt
                </DropdownMenuLabel>
                {onGardenOverviewOpen && (
                    <DropdownMenuItem
                        className="gap-3"
                        onClick={onGardenOverviewOpen}
                    >
                        <MapPinHouse className="size-4" />
                        <span>Pregled tvojih vrtovima</span>
                    </DropdownMenuItem>
                )}
            </>
        );
    }

    return (
        <>
            {visibleGroups.map((accountGroup, groupIndex) => (
                <Fragment key={accountGroup.accountId}>
                    {groupIndex > 0 && (
                        <DropdownMenuSeparator className="my-2" />
                    )}
                    {showAccountLabels && (
                        <DropdownMenuLabel className="text-muted-foreground text-xs px-2 py-1">
                            <Typography noWrap>{accountGroup.name}</Typography>
                        </DropdownMenuLabel>
                    )}
                    {accountGroup.gardens.map((garden) => (
                        <DropdownMenuItem
                            key={`${accountGroup.accountId}:${garden.id}`}
                            className="gap-3"
                            onClick={() =>
                                handleGardenSelect(accountGroup, garden)
                            }
                        >
                            <Check
                                aria-hidden={garden.id !== currentGarden?.id}
                                className={cx(
                                    'size-4 shrink-0 opacity-0',
                                    garden.id === currentGarden?.id &&
                                        'opacity-100',
                                )}
                            />
                            <Typography noWrap>{garden.name}</Typography>
                        </DropdownMenuItem>
                    ))}
                </Fragment>
            ))}
        </>
    );
}
