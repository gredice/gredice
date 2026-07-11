import { IconButton } from '@gredice/ui/IconButton';
import {
    Add,
    Check,
    Delete,
    FileText,
    Joystick,
    MapPinHouse,
} from '@gredice/ui/icons';
import {
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from '@gredice/ui/Menu';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useQueryClient } from '@tanstack/react-query';
import { Fragment, useEffect, useState } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { useCreateGarden } from '../hooks/useCreateGarden';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useDeleteSandboxGarden } from '../hooks/useDeleteSandboxGarden';
import { useGardenAccountGroups } from '../hooks/useGardenAccountGroups';
import { useGardens } from '../hooks/useGardens';
import { useSwitchGardenAccount } from '../hooks/useSwitchGardenAccount';
import { useCurrentGardenIdParam } from '../useUrlState';

type GardenAccountMenuItemsProps = {
    onGardenOverviewOpen?: () => void;
};

type SandboxGardenToDelete = {
    id: number;
    name: string;
    accountId: string;
    isCurrentAccount: boolean;
};

export function GardenAccountMenuItems({
    onGardenOverviewOpen,
}: GardenAccountMenuItemsProps) {
    const queryClient = useQueryClient();
    const [sandboxGardenToDelete, setSandboxGardenToDelete] =
        useState<SandboxGardenToDelete | null>(null);
    const [useSandboxSubmenu, setUseSandboxSubmenu] = useState(false);
    const [selectedGardenId, setSelectedGardenId] = useCurrentGardenIdParam();
    const { track } = useGameAnalytics();
    const { data: currentGarden } = useCurrentGarden();
    const { data: currentAccountGardens, isLoading: currentGardensLoading } =
        useGardens();
    const { data: accountGroups, isLoading: accountGroupsLoading } =
        useGardenAccountGroups();
    const switchGardenAccount = useSwitchGardenAccount();
    const createGarden = useCreateGarden();
    const deleteSandboxGarden = useDeleteSandboxGarden();
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
    const normalGardenGroups = gardenGroups
        .map((group) => ({
            ...group,
            gardens: group.gardens.filter((garden) => !garden.isSandbox),
        }))
        .filter((group) => group.gardens.length > 0);
    const sandboxGardenGroups = gardenGroups
        .map((group) => ({
            ...group,
            gardens: group.gardens.filter((garden) => garden.isSandbox),
        }))
        .filter((group) => group.gardens.length > 0);
    const canCreateSandboxGarden = gardenGroups.some(
        (accountGroup) => accountGroup.isCurrent,
    );
    const showSandboxMenu =
        sandboxGardenGroups.length > 0 || canCreateSandboxGarden;
    const hasVisibleGardens =
        normalGardenGroups.length > 0 || sandboxGardenGroups.length > 0;
    const showAccountLabels =
        normalGardenGroups.length > 1 ||
        normalGardenGroups.some((accountGroup) => !accountGroup.isCurrent);
    const showSandboxAccountLabels =
        sandboxGardenGroups.length > 1 ||
        sandboxGardenGroups.some((accountGroup) => !accountGroup.isCurrent);
    const isLoading = currentGardensLoading || accountGroupsLoading;

    useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 768px)');
        const handleChange = (event: MediaQueryListEvent) =>
            setUseSandboxSubmenu(event.matches);

        setUseSandboxSubmenu(mediaQuery.matches);
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    async function handleGardenSelect(
        accountGroup: (typeof gardenGroups)[number],
        garden: (typeof gardenGroups)[number]['gardens'][number],
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
                await setSelectedGardenId(garden.id);
                void queryClient.invalidateQueries();
                return;
            }

            const isDefault = currentAccountGardens?.[0]?.id === garden.id;
            await setSelectedGardenId(isDefault ? null : garden.id);
        } catch (error) {
            console.error('Failed to switch garden account:', error);
        }
    }

    async function handleCreateSandboxGarden() {
        if (createGarden.isPending) {
            return;
        }

        const sandboxCount =
            currentAccountGardens?.filter((garden) => garden.isSandbox)
                .length ?? 0;
        const name = `Vrt za igru ${sandboxCount + 1}`;

        track('game_garden_create_submitted', {
            name_length: name.length,
            is_sandbox: true,
            source: 'garden_switcher',
        });

        try {
            const created = await createGarden.mutateAsync({
                name,
                isSandbox: true,
            });
            if (created?.id != null) {
                await setSelectedGardenId(created.id);
            }
        } catch (error) {
            console.error('Failed to create sandbox garden:', error);
        }
    }

    async function handleDeleteSandboxGarden(target: SandboxGardenToDelete) {
        if (deleteSandboxGarden.isPending) {
            return;
        }

        track('game_garden_delete_submitted', {
            garden_id: target.id,
            garden_name: target.name,
            account_id: target.accountId,
            is_sandbox: true,
            is_current_account: target.isCurrentAccount,
            source: 'garden_switcher',
        });

        try {
            await deleteSandboxGarden.mutateAsync({
                gardenId: target.id,
            });
            if (
                currentGarden?.id === target.id ||
                selectedGardenId === target.id
            ) {
                await setSelectedGardenId(null);
            }
        } catch (error) {
            console.error('Failed to delete sandbox garden:', error);
        }
    }

    if (isLoading) {
        return (
            <DropdownMenuLabel className="text-muted-foreground">
                Učitavanje vrtova...
            </DropdownMenuLabel>
        );
    }

    if (!hasVisibleGardens) {
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
                <DropdownMenuItem className="gap-3" href="/racun/naplata">
                    <FileText className="size-4" />
                    <span>Računi i plaćanja</span>
                </DropdownMenuItem>
            </>
        );
    }

    function renderSandboxGardenItems() {
        return (
            <>
                {sandboxGardenGroups.map((accountGroup, groupIndex) => (
                    <Fragment key={accountGroup.accountId}>
                        {groupIndex > 0 && (
                            <DropdownMenuSeparator className="my-2" />
                        )}
                        {showSandboxAccountLabels && (
                            <DropdownMenuLabel className="text-muted-foreground text-xs px-2 py-1">
                                <Typography noWrap>
                                    {accountGroup.name}
                                </Typography>
                            </DropdownMenuLabel>
                        )}
                        {accountGroup.gardens.map((garden) => (
                            <div
                                className="flex items-center gap-1"
                                key={`${accountGroup.accountId}:${garden.id}`}
                            >
                                <DropdownMenuItem
                                    className="min-w-0 flex-1 gap-3"
                                    onClick={() =>
                                        handleGardenSelect(accountGroup, garden)
                                    }
                                >
                                    <Check
                                        aria-hidden={
                                            garden.id !== currentGarden?.id
                                        }
                                        className={cx(
                                            'size-4 shrink-0 opacity-0',
                                            garden.id === currentGarden?.id &&
                                                'opacity-100',
                                        )}
                                    />
                                    <Typography noWrap>
                                        {garden.name}
                                    </Typography>
                                </DropdownMenuItem>
                                <IconButton
                                    title={`Obriši ${garden.name}`}
                                    type="button"
                                    variant="plain"
                                    size="sm"
                                    disabled={deleteSandboxGarden.isPending}
                                    className="size-7 shrink-0 rounded-full p-0 text-red-600 hover:bg-red-50 hover:text-red-700 focus-visible:ring-red-600"
                                    onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setSandboxGardenToDelete({
                                            id: garden.id,
                                            name: garden.name,
                                            accountId: accountGroup.accountId,
                                            isCurrentAccount:
                                                accountGroup.isCurrent,
                                        });
                                    }}
                                    onPointerDown={(event) => {
                                        event.stopPropagation();
                                    }}
                                >
                                    <Delete className="size-4" />
                                </IconButton>
                            </div>
                        ))}
                    </Fragment>
                ))}
                {sandboxGardenGroups.length > 0 && canCreateSandboxGarden && (
                    <DropdownMenuSeparator className="my-2" />
                )}
                {canCreateSandboxGarden && (
                    <DropdownMenuItem
                        className="gap-3"
                        disabled={createGarden.isPending}
                        onSelect={(event) => {
                            event.preventDefault();
                            void handleCreateSandboxGarden();
                        }}
                    >
                        <Add className="size-4" />
                        <span>Kreiraj vrt za igru</span>
                    </DropdownMenuItem>
                )}
            </>
        );
    }

    return (
        <>
            {normalGardenGroups.map((accountGroup, groupIndex) => (
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
            {normalGardenGroups.length > 0 && (
                <>
                    <DropdownMenuSeparator className="my-2" />
                    <DropdownMenuItem className="gap-3" href="/racun/naplata">
                        <FileText className="size-4" />
                        <span>Računi i plaćanja</span>
                    </DropdownMenuItem>
                </>
            )}
            {normalGardenGroups.length > 0 && showSandboxMenu && (
                <DropdownMenuSeparator className="my-2" />
            )}
            {showSandboxMenu && useSandboxSubmenu && (
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="gap-3">
                        <Joystick className="size-4 shrink-0" />
                        <span>Vrtovi za igru</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent
                        className="w-80 max-w-[calc(100vw-1rem)] p-2"
                        collisionPadding={8}
                    >
                        {renderSandboxGardenItems()}
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
            )}
            {showSandboxMenu && !useSandboxSubmenu && (
                <>
                    <DropdownMenuLabel className="flex items-center gap-3 px-2 py-1.5 text-sm font-normal text-muted-foreground">
                        <Joystick className="size-4 shrink-0" />
                        <span>Vrtovi za igru</span>
                    </DropdownMenuLabel>
                    {renderSandboxGardenItems()}
                </>
            )}
            <ModalConfirm
                open={sandboxGardenToDelete !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setSandboxGardenToDelete(null);
                    }
                }}
                title="Potvrdi brisanje vrta za igru"
                header="Brisanje vrta za igru"
                confirmLabel="Obriši"
                onConfirm={() => {
                    if (sandboxGardenToDelete) {
                        void handleDeleteSandboxGarden(sandboxGardenToDelete);
                    }
                }}
            >
                <Typography>
                    Jeste li sigurni da želite obrisati vrt za igru{' '}
                    <strong>{sandboxGardenToDelete?.name}</strong>? Ova akcija
                    se ne može poništiti.
                </Typography>
            </ModalConfirm>
        </>
    );
}
