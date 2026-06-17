'use client';

import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { DotIndicator } from '@gredice/ui/DotIndicator';
import { IconButton } from '@gredice/ui/IconButton';
import { Check, ExpandDown } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { parseAsString, useQueryState } from 'nuqs';
import { useMemo, useState } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import {
    type TutorialChecklistGroup,
    type TutorialChecklistTask,
    tutorialChecklistKeys,
    useClaimTutorialChecklistTask,
    useMarkTutorialChecklistTaskReady,
    useTutorialChecklist,
} from '../hooks/useTutorialChecklist';
import { KnownPages } from '../knownPages';
import { useBackpackOpenParam, useShoppingCartOpenParam } from '../useUrlState';
import { formatSunflowers } from '../utils/sunflowerPricing';
import { HudCard } from './components/HudCard';
import { RAISED_BED_ONBOARDING_OPEN_EVENT } from './RaisedBedOnboardingModal';
import styles from './TutorialChecklistHud.module.css';

const tutorialTaskListIconSrc = '/assets/hud/tutorial-task-list.png';

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

function isTaskRewardSettled(task: TutorialChecklistTask) {
    if (task.claimable) {
        return false;
    }

    return (
        task.completed ||
        task.status === 'claimed' ||
        task.status === 'completed'
    );
}

function isGroupComplete(group: TutorialChecklistGroup) {
    return (
        group.totalCount > 0 &&
        group.completedCount >= group.totalCount &&
        group.claimableCount === 0
    );
}

function ClaimButtonContent({ task }: { task: TutorialChecklistTask }) {
    if (task.rewardLabel) {
        return <span className="text-sm font-bold">{task.rewardLabel}</span>;
    }
    if (task.rewardSunflowers <= 0) {
        return <span className="text-sm font-bold">Označi</span>;
    }
    return (
        <span className="text-sm font-bold leading-none">
            +{formatSunflowers(task.rewardSunflowers)}{' '}
            <span aria-hidden="true">🌻</span>
        </span>
    );
}

function sortChecklistGroups(groups: TutorialChecklistGroup[]) {
    return groups
        .map((group, index) => ({ group, index }))
        .sort((a, b) => {
            const completionSort =
                Number(isGroupComplete(a.group)) -
                Number(isGroupComplete(b.group));
            if (completionSort !== 0) {
                return completionSort;
            }
            return a.index - b.index;
        })
        .map(({ group }) => group);
}

function getChecklistTaskSortRank(task: TutorialChecklistTask) {
    if (task.claimable) {
        return 0;
    }
    if (!isTaskRewardSettled(task)) {
        return 1;
    }
    return 2;
}

function sortChecklistTasks(tasks: TutorialChecklistTask[]) {
    return tasks
        .map((task, index) => ({ index, task }))
        .sort((a, b) => {
            const rankSort =
                getChecklistTaskSortRank(a.task) -
                getChecklistTaskSortRank(b.task);
            if (rankSort !== 0) {
                return rankSort;
            }
            return a.index - b.index;
        })
        .map(({ task }) => task);
}

function isTaskReadyAfterOpen(task: TutorialChecklistTask) {
    return (
        task.completion === 'manual' &&
        task.actionTarget !== 'raisedBedOnboarding'
    );
}

function clickHudButton(title: string) {
    const button = document.querySelector<HTMLButtonElement>(
        `button[title="${title}"]`,
    );
    button?.click();
    return Boolean(button);
}

function waitForChecklistClose() {
    return new Promise<void>((resolve) => {
        window.setTimeout(() => {
            window.requestAnimationFrame(() => resolve());
        }, 0);
    });
}

function openExternalTaskTarget(task: TutorialChecklistTask) {
    switch (task.actionTarget) {
        case 'contact':
            window.open(
                KnownPages.GrediceContact,
                '_blank',
                'noopener,noreferrer',
            );
            return true;
        case 'plantDatabase':
            window.open(
                KnownPages.GredicePlants,
                '_blank',
                'noopener,noreferrer',
            );
            return true;
        default:
            return false;
    }
}

function shouldCloseChecklistBeforeOpen(task: TutorialChecklistTask) {
    return (
        task.actionTarget !== 'contact' && task.actionTarget !== 'plantDatabase'
    );
}

function useOpenTaskTarget(onChecklistOpenChange: (open: boolean) => void) {
    const [, setBackpackOpen] = useBackpackOpenParam();
    const [, setCartOpen] = useShoppingCartOpenParam();
    const [, setOverviewTab] = useQueryState('pregled', parseAsString);

    return async (task: TutorialChecklistTask) => {
        const target = task.actionTarget;
        if (!target) {
            return;
        }

        if (openExternalTaskTarget(task)) {
            return;
        }

        if (shouldCloseChecklistBeforeOpen(task)) {
            onChecklistOpenChange(false);
            await waitForChecklistClose();
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
            case 'profile':
                await setOverviewTab('generalno');
                break;
            case 'raisedBedOnboarding':
                window.dispatchEvent(
                    new Event(RAISED_BED_ONBOARDING_OPEN_EVENT),
                );
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
    onClaim,
    onOpen,
    pending,
    task,
}: {
    onClaim: (task: TutorialChecklistTask) => void;
    onOpen: (task: TutorialChecklistTask) => void;
    pending: boolean;
    task: TutorialChecklistTask;
}) {
    const rewardSettled = isTaskRewardSettled(task);
    const readyToClaim = task.claimable;
    const disabled = pending || rewardSettled;
    const canOpen =
        !rewardSettled &&
        !readyToClaim &&
        task.status !== 'blocked' &&
        Boolean(task.actionTarget);

    return (
        <div
            className={cx(
                'grid grid-cols-[auto_1fr] gap-3 rounded-md border border-border/70 bg-background p-3 text-foreground shadow-sm transition-colors sm:grid-cols-[auto_1fr_auto] sm:items-center',
                rewardSettled && 'bg-muted/30',
                task.status === 'blocked' && 'opacity-70',
                readyToClaim && 'border-green-500/60 shadow-md',
                readyToClaim && styles.claimableTask,
            )}
            data-tutorial-checklist-claimable={readyToClaim ? 'true' : 'false'}
            data-tutorial-checklist-completed={rewardSettled ? 'true' : 'false'}
            data-tutorial-checklist-task={task.key}
        >
            <span
                aria-hidden="true"
                className={cx(
                    'grid size-7 place-items-center rounded-full border-2 bg-background',
                    rewardSettled &&
                        'border-green-600 bg-green-600 text-white shadow-sm',
                    !rewardSettled &&
                        readyToClaim &&
                        'border-green-600 text-green-700 dark:text-green-300',
                    !rewardSettled &&
                        !readyToClaim &&
                        'border-muted-foreground/35 text-muted-foreground',
                )}
                data-tutorial-checklist-marker={
                    rewardSettled ? 'completed' : 'pending'
                }
            >
                {rewardSettled ? <Check className="size-4" /> : null}
            </span>
            <Stack spacing={1} className="min-w-0">
                <Typography
                    level="body2"
                    semiBold
                    className="min-w-0 text-foreground"
                >
                    {task.title}
                </Typography>
                <Typography level="body3" className="text-muted-foreground">
                    {task.status === 'blocked' && task.blockedReason
                        ? task.blockedReason
                        : task.description}
                </Typography>
                {!readyToClaim ? (
                    <Typography
                        level="body3"
                        className="text-amber-700 dark:text-amber-300"
                    >
                        <RewardText task={task} />
                    </Typography>
                ) : null}
            </Stack>
            {readyToClaim ? (
                <Button
                    className="col-span-2 w-full shrink-0 whitespace-nowrap px-4 font-bold sm:col-span-1 sm:w-auto sm:min-w-24"
                    color="success"
                    disabled={disabled || task.status === 'blocked'}
                    loading={pending}
                    onClick={() => onClaim(task)}
                    size="sm"
                    variant="solid"
                >
                    <ClaimButtonContent task={task} />
                </Button>
            ) : canOpen ? (
                <Button
                    className="col-span-2 w-full shrink-0 sm:col-span-1 sm:w-24"
                    color="neutral"
                    onClick={() => onOpen(task)}
                    size="sm"
                    variant="outlined"
                >
                    Otvori
                </Button>
            ) : null}
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
    const markTaskReady = useMarkTutorialChecklistTaskReady();
    const openTarget = useOpenTaskTarget(onOpenChange);
    const [expandedGroups, setExpandedGroups] = useState<
        Record<string, boolean>
    >({});
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
    }

    async function handleTaskOpen(task: TutorialChecklistTask) {
        track('game_tutorial_checklist_task_opened', {
            task_key: task.key,
            status: task.status,
            claimable: task.claimable,
        });

        await openTarget(task);

        if (isTaskReadyAfterOpen(task)) {
            await markTaskReady.mutateAsync(task.key);
        }
    }

    if (checklistQuery.isLoading) {
        return (
            <Stack spacing={3}>
                <Typography level="h3">Zadaci za novi vrt</Typography>
                <Typography level="body2" secondary>
                    Učitavanje zadataka...
                </Typography>
            </Stack>
        );
    }

    if (!checklistQuery.data) {
        return (
            <Stack spacing={3}>
                <Typography level="h3">Zadaci za novi vrt</Typography>
                <Typography level="body2" color="danger">
                    Zadaci se trenutno ne mogu učitati.
                </Typography>
            </Stack>
        );
    }

    const { groups } = checklistQuery.data;
    const sortedGroups = sortChecklistGroups(groups);

    return (
        <Stack spacing={4}>
            <Stack
                alignItems="center"
                spacing={2}
                className="mt-4 rounded-md border bg-card px-5 py-5 text-center text-card-foreground shadow-sm sm:mx-8"
            >
                <span className="grid size-12 place-items-center rounded-full border bg-background text-foreground shadow-sm">
                    <Image
                        alt=""
                        aria-hidden="true"
                        className="size-11 object-contain drop-shadow-[0_2px_4px_rgb(15_23_42_/_0.25)]"
                        height={48}
                        loading="eager"
                        src={tutorialTaskListIconSrc}
                        unoptimized
                        width={48}
                    />
                </span>
                <Typography
                    className="text-2xl leading-tight font-semibold tracking-tight text-foreground"
                    component="h2"
                    data-tutorial-checklist-modal-title="true"
                    level="h3"
                    style={{
                        fontFamily: 'var(--font-montserrat), sans-serif',
                    }}
                >
                    Zadaci za novi vrt
                </Typography>
            </Stack>
            <Stack spacing={4}>
                {sortedGroups.map((group) => {
                    const complete = isGroupComplete(group);
                    const expanded = expandedGroups[group.id] ?? !complete;
                    const sortedTasks = sortChecklistTasks(group.tasks);

                    return (
                        <Stack
                            className="overflow-hidden rounded-md border bg-card text-card-foreground shadow-sm"
                            data-group-complete={complete ? 'true' : 'false'}
                            data-tutorial-checklist-group={group.id}
                            key={group.id}
                            spacing={0}
                        >
                            <button
                                aria-expanded={expanded}
                                className="-mx-px flex w-[calc(100%+2px)] items-start justify-between gap-4 px-4 py-3 text-left outline-hidden transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                                onClick={() =>
                                    setExpandedGroups((current) => ({
                                        ...current,
                                        [group.id]: !expanded,
                                    }))
                                }
                                type="button"
                            >
                                <Stack spacing={0.5} className="min-w-0">
                                    <Row
                                        alignItems="center"
                                        className="min-w-0"
                                        spacing={2}
                                    >
                                        <ExpandDown
                                            aria-hidden
                                            className={cx(
                                                'size-4 shrink-0 text-muted-foreground transition-transform',
                                                !expanded && '-rotate-90',
                                            )}
                                        />
                                        <Typography
                                            level="h6"
                                            className="min-w-0"
                                        >
                                            {group.title}
                                        </Typography>
                                    </Row>
                                    <Typography
                                        level="body3"
                                        className="pl-5 text-muted-foreground"
                                    >
                                        {group.description}
                                    </Typography>
                                </Stack>
                                <Chip
                                    color={
                                        group.claimableCount > 0
                                            ? 'success'
                                            : 'neutral'
                                    }
                                    size="sm"
                                    className="min-h-8 px-3 text-sm"
                                    variant="soft"
                                >
                                    {group.completedCount}/{group.totalCount}
                                </Chip>
                            </button>
                            {expanded ? (
                                <Stack
                                    className="px-4 pb-4 pt-2"
                                    data-tutorial-checklist-group-tasks={
                                        group.id
                                    }
                                    spacing={2}
                                >
                                    {sortedTasks.map((task) => (
                                        <TutorialChecklistTaskRow
                                            key={task.key}
                                            onClaim={handleTaskAction}
                                            onOpen={handleTaskOpen}
                                            pending={
                                                (claimTask.isPending &&
                                                    claimTask.variables ===
                                                        task.key) ||
                                                (markTaskReady.isPending &&
                                                    markTaskReady.variables ===
                                                        task.key)
                                            }
                                            task={task}
                                        />
                                    ))}
                                </Stack>
                            ) : null}
                        </Stack>
                    );
                })}
            </Stack>
        </Stack>
    );
}

export function TutorialChecklistHud() {
    const [isOpen, setIsOpen] = useState(false);
    const queryClient = useQueryClient();
    const { data } = useTutorialChecklist();
    const { track } = useGameAnalytics();
    const claimableCount = data?.totals.claimableCount ?? 0;
    const progressLabel = useMemo(() => {
        if (!data) return null;
        const firstActiveGroup = data.groups.find(
            (group) => !isGroupComplete(group),
        );
        if (!firstActiveGroup) return null;
        return `${firstActiveGroup.completedCount}/${firstActiveGroup.totalCount}`;
    }, [data]);

    return (
        <HudCard open position="floating" className="relative grid">
            {claimableCount > 0 && (
                <div
                    className="pointer-events-none absolute right-0 top-0 z-20 grid size-4 place-items-center"
                    data-tutorial-checklist-claim-dot="true"
                >
                    <div className="absolute inset-0 -z-10 rounded-full bg-green-500 animate-ping" />
                    <DotIndicator color="success" size={16} />
                </div>
            )}
            <Modal
                className="z-[46] border-tertiary border-b-4 md:max-w-3xl"
                onOpenChange={(open) => {
                    if (open) {
                        track('game_tutorial_checklist_opened', {
                            claimable_count: claimableCount,
                        });
                        void queryClient.invalidateQueries({
                            queryKey: tutorialChecklistKeys,
                        });
                    }
                    setIsOpen(open);
                }}
                open={isOpen}
                overlayClassName="z-[46]"
                title="Zadaci za novi vrt"
                trigger={
                    <IconButton
                        aria-label={
                            progressLabel ? `Zadaci ${progressLabel}` : 'Zadaci'
                        }
                        className="relative rounded-full w-10 h-10"
                        data-tutorial-checklist-trigger="true"
                        title="Zadaci"
                        variant="plain"
                    >
                        <Image
                            alt=""
                            aria-hidden="true"
                            className="pointer-events-none absolute left-1/2 top-0 size-9 shrink-0 -translate-x-1/2 -translate-y-3.5 object-contain drop-shadow-[0_2px_3px_rgb(15_23_42_/_0.35)]"
                            data-tutorial-checklist-trigger-icon="true"
                            height={36}
                            loading="eager"
                            src={tutorialTaskListIconSrc}
                            unoptimized
                            width={36}
                        />
                        <Typography
                            aria-hidden="true"
                            bold
                            className="pointer-events-none text-foreground mt-5"
                            data-tutorial-checklist-progress="true"
                            level="body3"
                        >
                            {progressLabel ?? '0/0'}
                        </Typography>
                    </IconButton>
                }
            >
                <TutorialChecklistContent onOpenChange={setIsOpen} />
            </Modal>
        </HudCard>
    );
}
