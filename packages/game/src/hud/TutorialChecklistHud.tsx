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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import {
    type TutorialChecklistGroup,
    type TutorialChecklistState,
    type TutorialChecklistTask,
    tutorialChecklistKeys,
    useClaimTutorialChecklistTask,
    useMarkTutorialChecklistTaskReady,
    useTutorialChecklist,
} from '../hooks/useTutorialChecklist';
import { KnownPages } from '../knownPages';
import { useSetRaisedBedCloseupParam } from '../useRaisedBedCloseup';
import { useBackpackOpenParam, useShoppingCartOpenParam } from '../useUrlState';
import { getRaisedBedBlockIds } from '../utils/raisedBedBlocks';
import { isRaisedBedFieldOccupied } from '../utils/raisedBedFields';
import { formatSunflowers } from '../utils/sunflowerPricing';
import { HudCard } from './components/HudCard';
import { RAISED_BED_ONBOARDING_OPEN_EVENT } from './RaisedBedOnboardingModal';
import styles from './TutorialChecklistHud.module.css';

const tutorialTaskListIconSrc = '/assets/hud/tutorial-task-list.png';
const completedChecklistDismissedStorageKey =
    'game:tutorial-checklist:completed-dismissed-v1';

type CurrentGardenData = NonNullable<
    ReturnType<typeof useCurrentGarden>['data']
>;

type EmptyRaisedBedFieldTarget = {
    positionIndex: number;
    raisedBedId: number;
    raisedBedName: string;
};

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

function isChecklistComplete(
    checklist: TutorialChecklistState | null | undefined,
) {
    return Boolean(
        checklist &&
            checklist.totals.totalCount > 0 &&
            checklist.totals.completedCount >= checklist.totals.totalCount &&
            checklist.totals.claimableCount === 0,
    );
}

function getChecklistTaskFingerprint(checklist: TutorialChecklistState) {
    return checklist.groups
        .flatMap((group) =>
            group.tasks.map((task) => `${group.id}:${task.key}`),
        )
        .sort()
        .join('|');
}

function readCompletedChecklistDismissedFingerprint() {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        return window.localStorage.getItem(
            completedChecklistDismissedStorageKey,
        );
    } catch {
        return null;
    }
}

function writeCompletedChecklistDismissedFingerprint(fingerprint: string) {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(
            completedChecklistDismissedStorageKey,
            fingerprint,
        );
    } catch {
        // Ignore storage failures; the current session state still dismisses it.
    }
}

function useCompletedChecklistDismissal(
    checklist: TutorialChecklistState | null | undefined,
) {
    const allTasksFinished = isChecklistComplete(checklist);
    const taskFingerprint = useMemo(
        () => (checklist ? getChecklistTaskFingerprint(checklist) : null),
        [checklist],
    );
    const [dismissedFingerprint, setDismissedFingerprint] = useState<
        string | null
    >(null);
    const [readyFingerprint, setReadyFingerprint] = useState<string | null>(
        null,
    );

    useEffect(() => {
        if (!taskFingerprint) {
            setDismissedFingerprint(null);
            setReadyFingerprint(null);
            return;
        }

        setDismissedFingerprint(readCompletedChecklistDismissedFingerprint());
        setReadyFingerprint(taskFingerprint);
    }, [taskFingerprint]);

    const dismissalReady =
        taskFingerprint !== null && readyFingerprint === taskFingerprint;
    const isDismissed =
        allTasksFinished &&
        dismissalReady &&
        dismissedFingerprint === taskFingerprint;
    const dismiss = useCallback(() => {
        if (!allTasksFinished || !taskFingerprint) {
            return;
        }

        writeCompletedChecklistDismissedFingerprint(taskFingerprint);
        setDismissedFingerprint(taskFingerprint);
        setReadyFingerprint(taskFingerprint);
    }, [allTasksFinished, taskFingerprint]);

    return {
        allTasksFinished,
        dismissalReady,
        dismiss,
        isDismissed,
    };
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

function checklistProgressProperties(
    state: TutorialChecklistState | null | undefined,
) {
    const groups = state?.groups ?? [];
    const activeGroupIndex = groups.findIndex(
        (group) => !isGroupComplete(group),
    );
    const activeGroup =
        activeGroupIndex >= 0 ? groups[activeGroupIndex] : undefined;
    const completedCount = state?.totals.completedCount;
    const totalCount = state?.totals.totalCount;

    return {
        completed_count: completedCount,
        total_count: totalCount,
        claimable_count: state?.totals.claimableCount,
        available_sunflowers: state?.totals.availableSunflowers,
        earned_sunflowers: state?.totals.earnedSunflowers,
        completion_percent:
            totalCount && completedCount !== undefined
                ? Math.round((completedCount / totalCount) * 100)
                : undefined,
        group_count: groups.length || undefined,
        active_group_id: activeGroup?.id,
        active_group_index:
            activeGroupIndex >= 0 ? activeGroupIndex + 1 : undefined,
        active_group_completed_count: activeGroup?.completedCount,
        active_group_total_count: activeGroup?.totalCount,
    };
}

function checklistGroupProperties(
    group: TutorialChecklistGroup,
    groupIndex: number,
) {
    return {
        group_id: group.id,
        group_index: groupIndex + 1,
        group_completed: isGroupComplete(group),
        group_completed_count: group.completedCount,
        group_total_count: group.totalCount,
        group_claimable_count: group.claimableCount,
    };
}

function checklistTaskProperties(task: TutorialChecklistTask) {
    return {
        task_key: task.key,
        group_id: task.groupId,
        status: task.status,
        claimable: task.claimable,
        completed: task.completed,
        action_target: task.actionTarget,
        completion_type: task.completion,
        reward_sunflowers: task.rewardSunflowers,
    };
}

function findChecklistTask(
    state: TutorialChecklistState,
    taskKey: string,
): TutorialChecklistTask | undefined {
    for (const group of state.groups) {
        const task = group.tasks.find((item) => item.key === taskKey);
        if (task) {
            return task;
        }
    }

    return undefined;
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

function waitForPlantPickerTrigger({
    positionIndex,
    raisedBedId,
}: EmptyRaisedBedFieldTarget) {
    if (typeof document === 'undefined') {
        return Promise.resolve(null);
    }

    const selector = [
        'button[data-raised-bed-plant-picker-trigger="true"]',
        `[data-raised-bed-id="${raisedBedId.toString()}"]`,
        `[data-position-index="${positionIndex.toString()}"]`,
    ].join('');

    return new Promise<HTMLButtonElement | null>((resolve) => {
        const deadline = Date.now() + 2500;

        function check() {
            const button = document.querySelector<HTMLButtonElement>(selector);
            if (button) {
                resolve(button);
                return;
            }

            if (Date.now() >= deadline) {
                resolve(null);
                return;
            }

            window.requestAnimationFrame(check);
        }

        check();
    });
}

function findFirstEmptyRaisedBedField(
    garden: CurrentGardenData | null | undefined,
): EmptyRaisedBedFieldTarget | null {
    if (!garden || garden.isSandbox) {
        return null;
    }

    for (const raisedBed of garden.raisedBeds) {
        const raisedBedName = raisedBed.name?.trim();
        if (
            !raisedBedName ||
            raisedBed.status !== 'active' ||
            !raisedBed.isValid
        ) {
            continue;
        }

        const blockCount = Math.max(
            getRaisedBedBlockIds(garden, raisedBed.id).length,
            1,
        );
        const occupiedPositionIndices = new Set(
            raisedBed.fields
                .filter(isRaisedBedFieldOccupied)
                .map((field) => field.positionIndex),
        );

        for (
            let positionIndex = 0;
            positionIndex < blockCount * 9;
            positionIndex += 1
        ) {
            if (!occupiedPositionIndices.has(positionIndex)) {
                return {
                    positionIndex,
                    raisedBedId: raisedBed.id,
                    raisedBedName,
                };
            }
        }
    }

    return null;
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
    const { data: currentGarden } = useCurrentGarden();
    const [, setBackpackOpen] = useBackpackOpenParam();
    const [, setCartOpen] = useShoppingCartOpenParam();
    const [, setOverviewTab] = useQueryState('pregled', parseAsString);
    const { mutate: setRaisedBedCloseupParam } = useSetRaisedBedCloseupParam();

    async function openFirstEmptyRaisedBedPlantPicker() {
        const target = findFirstEmptyRaisedBedField(currentGarden);
        if (!target) {
            return false;
        }

        await Promise.resolve(
            setRaisedBedCloseupParam(
                target.raisedBedName,
                target.positionIndex,
            ),
        );
        const trigger = await waitForPlantPickerTrigger(target);
        trigger?.click();
        return Boolean(trigger);
    }

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
            case 'plantPicker':
                if (!(await openFirstEmptyRaisedBedPlantPicker())) {
                    clickHudButton('Status radnji');
                }
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
    allTasksFinished,
    onDismissCompleted,
    onOpenChange,
}: {
    allTasksFinished: boolean;
    onDismissCompleted: () => void;
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
            ...checklistProgressProperties(checklistQuery.data),
            ...checklistTaskProperties(task),
        });

        if (task.claimable) {
            const nextState = await claimTask.mutateAsync(task.key);
            const claimedTask = findChecklistTask(nextState, task.key) ?? task;
            track('game_tutorial_checklist_task_claimed', {
                ...checklistProgressProperties(nextState),
                ...checklistTaskProperties(claimedTask),
            });
        }
    }

    async function handleTaskOpen(task: TutorialChecklistTask) {
        track('game_tutorial_checklist_task_opened', {
            ...checklistProgressProperties(checklistQuery.data),
            ...checklistTaskProperties(task),
        });

        await openTarget(task);

        if (isTaskReadyAfterOpen(task)) {
            const nextState = await markTaskReady.mutateAsync(task.key);
            const readyTask = findChecklistTask(nextState, task.key) ?? task;
            track('game_tutorial_checklist_task_ready_marked', {
                ...checklistProgressProperties(nextState),
                ...checklistTaskProperties(readyTask),
            });
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
                className={cx(
                    'mt-4 rounded-md border px-5 py-5 text-center shadow-sm sm:mx-8',
                    allTasksFinished
                        ? 'border-green-700 bg-green-600 text-white dark:border-green-500/70 dark:bg-green-700'
                        : 'bg-card text-card-foreground',
                )}
                data-tutorial-checklist-complete-banner={
                    allTasksFinished ? 'true' : 'false'
                }
            >
                <span
                    className={cx(
                        'grid size-12 place-items-center rounded-full border shadow-sm',
                        allTasksFinished
                            ? 'border-white/30 bg-white/15 text-white'
                            : 'bg-background text-foreground',
                    )}
                >
                    {allTasksFinished ? (
                        <Check className="size-7" />
                    ) : (
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
                    )}
                </span>
                <Typography
                    className={cx(
                        'text-2xl leading-tight font-semibold tracking-tight',
                        allTasksFinished ? 'text-white' : 'text-foreground',
                    )}
                    component="h2"
                    data-tutorial-checklist-modal-title="true"
                    level="h3"
                    style={{
                        fontFamily: 'var(--font-montserrat), sans-serif',
                    }}
                >
                    Zadaci za novi vrt
                </Typography>
                {allTasksFinished ? (
                    <>
                        <Typography
                            className="max-w-lg text-green-50"
                            data-tutorial-checklist-complete-text="true"
                            level="body2"
                        >
                            Svi zadaci su dovršeni.
                        </Typography>
                        <Button
                            className="bg-white px-4 font-bold text-green-800 hover:bg-green-50 dark:bg-white dark:text-green-900 dark:hover:bg-green-50"
                            color="success"
                            data-tutorial-checklist-hide-completed="true"
                            onClick={onDismissCompleted}
                            size="sm"
                            type="button"
                            variant="solid"
                        >
                            Sakrij popis
                        </Button>
                    </>
                ) : null}
            </Stack>
            <Stack spacing={4}>
                {sortedGroups.map((group, groupIndex) => {
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
                                onClick={() => {
                                    const nextExpanded = !expanded;
                                    setExpandedGroups((current) => ({
                                        ...current,
                                        [group.id]: nextExpanded,
                                    }));
                                    track(
                                        'game_tutorial_checklist_group_toggled',
                                        {
                                            ...checklistProgressProperties(
                                                checklistQuery.data,
                                            ),
                                            ...checklistGroupProperties(
                                                group,
                                                groupIndex,
                                            ),
                                            expanded: nextExpanded,
                                        },
                                    );
                                }}
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
    const {
        allTasksFinished,
        dismissalReady,
        dismiss: dismissCompletedChecklist,
        isDismissed,
    } = useCompletedChecklistDismissal(data);
    const progressLabel = useMemo(() => {
        if (!data || allTasksFinished) return null;
        const firstActiveGroup = data.groups.find(
            (group) => !isGroupComplete(group),
        );
        if (!firstActiveGroup) return null;
        return `${firstActiveGroup.completedCount}/${firstActiveGroup.totalCount}`;
    }, [allTasksFinished, data]);

    const handleDismissCompleted = useCallback(() => {
        dismissCompletedChecklist();
        setIsOpen(false);
        track('game_tutorial_checklist_completed_dismissed', {
            total_count: data?.totals.totalCount ?? 0,
        });
    }, [data?.totals.totalCount, dismissCompletedChecklist, track]);

    if ((allTasksFinished && !dismissalReady) || isDismissed) {
        return null;
    }

    function handleOpenChange(open: boolean) {
        if (open) {
            track('game_tutorial_checklist_opened', {
                ...checklistProgressProperties(data),
            });
            void queryClient.invalidateQueries({
                queryKey: tutorialChecklistKeys,
            });
        } else if (isOpen) {
            track('game_tutorial_checklist_closed', {
                ...checklistProgressProperties(data),
            });
        }

        setIsOpen(open);
    }

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
                onOpenChange={handleOpenChange}
                open={isOpen}
                overlayClassName="z-[46]"
                title="Zadaci za novi vrt"
                trigger={
                    <IconButton
                        aria-label={
                            allTasksFinished
                                ? 'Svi zadaci su dovršeni'
                                : progressLabel
                                  ? `Zadaci ${progressLabel}`
                                  : 'Zadaci'
                        }
                        className={cx(
                            'relative rounded-full w-10 h-10',
                            allTasksFinished &&
                                'bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600',
                        )}
                        data-tutorial-checklist-complete={
                            allTasksFinished ? 'true' : 'false'
                        }
                        data-tutorial-checklist-trigger="true"
                        title="Zadaci"
                        variant="plain"
                    >
                        {allTasksFinished ? (
                            <Check
                                aria-hidden="true"
                                className="pointer-events-none size-6"
                                data-tutorial-checklist-complete-icon="true"
                            />
                        ) : (
                            <>
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
                            </>
                        )}
                    </IconButton>
                }
            >
                <TutorialChecklistContent
                    allTasksFinished={allTasksFinished}
                    onDismissCompleted={handleDismissCompleted}
                    onOpenChange={handleOpenChange}
                />
            </Modal>
        </HudCard>
    );
}
