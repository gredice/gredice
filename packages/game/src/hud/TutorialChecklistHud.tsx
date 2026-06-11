'use client';

import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { Divider } from '@gredice/ui/Divider';
import { DotIndicator } from '@gredice/ui/DotIndicator';
import { useSearchParam } from '@gredice/ui/hooks';
import { Approved, ListTodo, Navigate } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useMemo, useState } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import {
    type TutorialChecklistTask,
    useClaimTutorialChecklistTask,
    useTutorialChecklist,
} from '../hooks/useTutorialChecklist';
import { KnownPages } from '../knownPages';
import { useBackpackOpenParam, useShoppingCartOpenParam } from '../useUrlState';
import { formatSunflowers } from '../utils/sunflowerPricing';
import { HudCard } from './components/HudCard';

function RewardText({ task }: { task: TutorialChecklistTask }) {
    if (task.rewardLabel) {
        return <>{task.rewardLabel}</>;
    }
    if (task.rewardSunflowers <= 0) {
        return <>Bez dodatne nagrade</>;
    }
    return (
        <>
            +{formatSunflowers(task.rewardSunflowers)}{' '}
            <span aria-hidden="true">🌻</span>
        </>
    );
}

function TaskStatusChip({ task }: { task: TutorialChecklistTask }) {
    if (task.status === 'claimed' || task.status === 'completed') {
        return (
            <Chip
                color="success"
                size="sm"
                startDecorator={<Approved className="size-3.5" />}
            >
                Gotovo
            </Chip>
        );
    }
    if (task.status === 'blocked') {
        return (
            <Chip color="neutral" size="sm" variant="soft">
                Zaključano
            </Chip>
        );
    }
    if (task.status === 'ready') {
        return (
            <Chip color="warning" size="sm" variant="soft">
                Spremno
            </Chip>
        );
    }
    return (
        <Chip color="info" size="sm" variant="soft">
            Otvoreno
        </Chip>
    );
}

function actionButtonLabel(task: TutorialChecklistTask) {
    if (task.status === 'claimed' || task.status === 'completed') {
        return 'Gotovo';
    }
    if (task.status === 'blocked') {
        return 'Zaključano';
    }
    if (task.claimable) {
        return task.rewardSunflowers > 0 ? 'Preuzmi' : 'Označi';
    }
    return 'Otvori';
}

function clickHudButton(title: string) {
    const button = document.querySelector<HTMLButtonElement>(
        `button[title="${title}"]`,
    );
    button?.click();
    return Boolean(button);
}

function useOpenTaskTarget(onChecklistOpenChange: (open: boolean) => void) {
    const [, setBackpackOpen] = useBackpackOpenParam();
    const [, setCartOpen] = useShoppingCartOpenParam();
    const [, setOverviewTab] = useSearchParam('pregled');

    return async (task: TutorialChecklistTask) => {
        const target = task.actionTarget;
        if (!target) {
            return;
        }

        if (
            target === 'field' ||
            target === 'diary' ||
            target === 'operations' ||
            target === 'weather' ||
            target === 'forecast'
        ) {
            onChecklistOpenChange(false);
        }

        switch (target) {
            case 'accountUsers':
                await setOverviewTab('korisnici');
                break;
            case 'achievements':
                await setOverviewTab('postignuca');
                break;
            case 'cart':
                await setCartOpen(true);
                break;
            case 'contact':
                window.open(
                    KnownPages.GrediceContact,
                    '_blank',
                    'noopener,noreferrer',
                );
                break;
            case 'delivery':
                await setOverviewTab('dostava');
                break;
            case 'forecast':
                clickHudButton('Prognoza vremena');
                break;
            case 'garden':
                await setOverviewTab('vrt');
                break;
            case 'inventory':
                await setBackpackOpen(true);
                break;
            case 'notifications':
                await setOverviewTab('obavijesti');
                break;
            case 'operations':
                clickHudButton('Status radnji');
                break;
            case 'plantDatabase':
                window.open(
                    KnownPages.GredicePlants,
                    '_blank',
                    'noopener,noreferrer',
                );
                break;
            case 'profile':
                await setOverviewTab('generalno');
                break;
            case 'referrals':
                await setOverviewTab('preporuke');
                break;
            case 'sunflowers':
                await setOverviewTab('suncokreti');
                break;
            case 'weather':
                clickHudButton('Trenutno vrijeme');
                break;
            case 'diary':
            case 'field':
                break;
        }
    };
}

function TutorialChecklistTaskRow({
    onAction,
    pending,
    task,
}: {
    onAction: (task: TutorialChecklistTask) => void;
    pending: boolean;
    task: TutorialChecklistTask;
}) {
    const disabled =
        pending || task.status === 'claimed' || task.status === 'completed';

    return (
        <div
            className={cx(
                'grid gap-3 rounded-md border bg-background p-3 sm:grid-cols-[1fr_auto] sm:items-center',
                task.claimable && 'border-primary/50 bg-primary/5',
            )}
        >
            <Stack spacing={1}>
                <Row spacing={2} className="flex-wrap">
                    <TaskStatusChip task={task} />
                    <Typography
                        level="body2"
                        semiBold
                        className="min-w-0 text-foreground"
                    >
                        {task.title}
                    </Typography>
                </Row>
                <Typography level="body3" className="text-muted-foreground">
                    {task.status === 'blocked' && task.blockedReason
                        ? task.blockedReason
                        : task.description}
                </Typography>
                <Typography level="body3" className="text-amber-700">
                    <RewardText task={task} />
                </Typography>
            </Stack>
            <Button
                className="w-full shrink-0 sm:w-28"
                color={task.claimable ? 'primary' : 'neutral'}
                disabled={disabled || task.status === 'blocked'}
                endDecorator={
                    task.status === 'claimed' ||
                    task.status === 'completed' ? undefined : (
                        <Navigate className="size-4 shrink-0" />
                    )
                }
                loading={pending}
                onClick={() => onAction(task)}
                size="sm"
                variant={task.claimable ? 'solid' : 'soft'}
            >
                {actionButtonLabel(task)}
            </Button>
        </div>
    );
}

function TutorialChecklistContent({
    onOpenChange,
}: {
    onOpenChange: (open: boolean) => void;
}) {
    const checklistQuery = useTutorialChecklist();
    const claimTask = useClaimTutorialChecklistTask();
    const openTarget = useOpenTaskTarget(onOpenChange);
    const { track } = useGameAnalytics();

    async function handleTaskAction(task: TutorialChecklistTask) {
        track('game_tutorial_checklist_task_clicked', {
            task_key: task.key,
            status: task.status,
            claimable: task.claimable,
        });

        if (task.claimable) {
            await claimTask.mutateAsync(task.key);
        }
        await openTarget(task);
    }

    if (checklistQuery.isLoading) {
        return (
            <Stack spacing={3}>
                <Typography level="h3">Zadaci</Typography>
                <Typography level="body2" secondary>
                    Učitavanje zadataka...
                </Typography>
            </Stack>
        );
    }

    if (checklistQuery.isError || !checklistQuery.data) {
        return (
            <Stack spacing={3}>
                <Typography level="h3">Zadaci</Typography>
                <Typography level="body2" color="danger">
                    Zadaci se trenutno ne mogu učitati.
                </Typography>
            </Stack>
        );
    }

    const { groups, totals } = checklistQuery.data;
    const progress =
        totals.totalCount > 0
            ? Math.round((totals.completedCount / totals.totalCount) * 100)
            : 0;

    return (
        <Stack spacing={4}>
            <Row
                alignItems="start"
                className="flex-wrap pr-8"
                justifyContent="space-between"
                spacing={4}
            >
                <Stack spacing={1}>
                    <Typography level="h3">Zadaci</Typography>
                    <Typography level="body2" secondary>
                        {totals.completedCount}/{totals.totalCount} gotovo
                    </Typography>
                </Stack>
                <Stack spacing={1} className="items-start sm:items-end">
                    <Chip color="success" variant="soft">
                        {progress}%
                    </Chip>
                    <Typography level="body3" className="text-amber-700">
                        Dostupno: {formatSunflowers(totals.availableSunflowers)}{' '}
                        <span aria-hidden="true">🌻</span>
                    </Typography>
                </Stack>
            </Row>
            <Divider />
            <Stack spacing={4}>
                {groups.map((group) => (
                    <Stack key={group.id} spacing={2}>
                        <Row
                            alignItems="start"
                            className="flex-wrap"
                            justifyContent="space-between"
                            spacing={3}
                        >
                            <Stack spacing={0.5}>
                                <Typography level="h6">
                                    {group.title}
                                </Typography>
                                <Typography
                                    level="body3"
                                    className="text-muted-foreground"
                                >
                                    {group.description}
                                </Typography>
                            </Stack>
                            <Chip
                                color={
                                    group.claimableCount > 0
                                        ? 'warning'
                                        : 'neutral'
                                }
                                size="sm"
                                variant="soft"
                            >
                                {group.completedCount}/{group.totalCount}
                            </Chip>
                        </Row>
                        <Stack spacing={2}>
                            {group.tasks.map((task) => (
                                <TutorialChecklistTaskRow
                                    key={task.key}
                                    onAction={handleTaskAction}
                                    pending={
                                        claimTask.isPending &&
                                        claimTask.variables === task.key
                                    }
                                    task={task}
                                />
                            ))}
                        </Stack>
                    </Stack>
                ))}
            </Stack>
        </Stack>
    );
}

export function TutorialChecklistHud() {
    const [isOpen, setIsOpen] = useState(false);
    const { data } = useTutorialChecklist();
    const { track } = useGameAnalytics();
    const claimableCount = data?.totals.claimableCount ?? 0;
    const progressLabel = useMemo(() => {
        if (!data) return null;
        return `${data.totals.completedCount}/${data.totals.totalCount}`;
    }, [data]);

    return (
        <HudCard open position="floating" className="static p-0.5">
            <Modal
                className="z-[46] border-tertiary border-b-4 md:max-w-3xl"
                onOpenChange={(open) => {
                    if (open) {
                        track('game_tutorial_checklist_opened', {
                            claimable_count: claimableCount,
                        });
                    }
                    setIsOpen(open);
                }}
                open={isOpen}
                overlayClassName="z-[46]"
                title="Zadaci"
                trigger={
                    <Button
                        className="relative rounded-full p-2 gap-2"
                        title="Zadaci"
                        variant="plain"
                    >
                        <ListTodo className="size-5 shrink-0" />
                        <Typography
                            level="body2"
                            semiBold
                            className="hidden text-foreground md:block"
                        >
                            Zadaci
                        </Typography>
                        {progressLabel ? (
                            <Typography
                                level="body3"
                                className="hidden text-muted-foreground md:block"
                            >
                                {progressLabel}
                            </Typography>
                        ) : null}
                        {claimableCount > 0 && (
                            <span className="absolute -right-1 -top-1">
                                <DotIndicator
                                    color="success"
                                    content={
                                        <span className="text-[11px] font-semibold leading-none text-white">
                                            {claimableCount}
                                        </span>
                                    }
                                    size={22}
                                />
                            </span>
                        )}
                    </Button>
                }
            >
                <TutorialChecklistContent onOpenChange={setIsOpen} />
            </Modal>
        </HudCard>
    );
}
