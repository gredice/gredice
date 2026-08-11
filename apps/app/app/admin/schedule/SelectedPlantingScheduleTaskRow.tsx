'use client';

import {
    getImageObservablePlantStatusTargets,
    plantFieldStatusLabel,
} from '@gredice/js/plants';
import type {
    RaisedBedFieldAssignableFarmUser,
    RaisedBedPlantingLifecycleStatus,
    ScheduleTaskBlockReasonCode,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Chip } from '@gredice/ui/Chip';
import { IconButton } from '@gredice/ui/IconButton';
import {
    Calendar,
    Close,
    ToggleLeft,
    ToggleRight,
    User,
    Warning,
} from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { useMemo, useRef, useState } from 'react';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import {
    assignSelectedPlantingTaskAction,
    blockSelectedPlantingTaskAction,
    cancelSelectedPlantingTaskAction,
    completeSelectedPlantingTaskAction,
    rescheduleSelectedPlantingTaskAction,
    updateSelectedPlantingLifecycleStatusAction,
    verifySelectedPlantingTaskAction,
} from '../../(actions)/selectedRaisedBedPlantingActions';
import { CancelRequestModal } from './CancelRequestModal';
import { CompletePlantingModal } from './CompletePlantingModal';
import { RescheduleModal } from './RescheduleModal';
import { SchedulePlantVisual } from './ScheduleTaskVisual';
import {
    formatMinutes,
    PLANTING_TASK_DURATION_MINUTES,
} from './scheduleShared';
import type { AdminSelectedPlantingScheduleItem } from './selectedPlantingSchedulePresentation';

type AssignableUser = Pick<
    RaisedBedFieldAssignableFarmUser,
    'avatarUrl' | 'displayName' | 'id' | 'userName'
>;

type MutableLifecycleStatus = Exclude<
    RaisedBedPlantingLifecycleStatus,
    'cancelled' | 'pendingVerification'
>;

const selectedTaskBlockerReasons = [
    {
        code: 'unsafe_conditions',
        label: 'Vrijeme ili uvjeti nisu sigurni',
    },
    {
        code: 'missing_materials',
        label: 'Nedostaje materijal ili oprema',
    },
    {
        code: 'location_not_ready',
        label: 'Biljka, gredica ili lokacija nije spremna',
    },
    {
        code: 'location_inaccessible',
        label: 'Ne mogu pristupiti lokaciji',
    },
    {
        code: 'task_not_applicable',
        label: 'Zadatak ili upute nisu primjenjivi',
    },
    {
        code: 'other',
        label: 'Drugi razlog',
    },
] as const satisfies readonly {
    code: ScheduleTaskBlockReasonCode;
    label: string;
}[];

function parseSelectedTaskBlockReason(value: string) {
    return selectedTaskBlockerReasons.find((reason) => reason.code === value);
}

function isMutableLifecycleStatus(
    value: unknown,
): value is MutableLifecycleStatus {
    return (
        typeof value === 'string' &&
        value !== 'cancelled' &&
        value !== 'pendingVerification' &&
        [
            'planned',
            'sowed',
            'sprouted',
            'firstFlowers',
            'firstFruitSet',
            'notSprouted',
            'died',
            'ready',
            'harvested',
            'removed',
        ].some((status) => status === value)
    );
}

function SelectedPlantingAssignmentModal({
    assignedUserIds,
    disabled,
    farmUsers,
    item,
}: {
    assignedUserIds: readonly string[];
    disabled: boolean;
    farmUsers: readonly AssignableUser[];
    item: AdminSelectedPlantingScheduleItem;
}) {
    const [open, setOpen] = useState(false);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([
        ...assignedUserIds,
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>();
    const commandIdRef = useRef(crypto.randomUUID());
    const users = useMemo(() => {
        const usersById = new Map(farmUsers.map((user) => [user.id, user]));
        for (const assignedUserId of assignedUserIds) {
            if (!usersById.has(assignedUserId)) {
                usersById.set(assignedUserId, {
                    avatarUrl: null,
                    displayName: null,
                    id: assignedUserId,
                    userName: 'Trenutno dodijeljeni korisnik',
                });
            }
        }
        return [...usersById.values()];
    }, [assignedUserIds, farmUsers]);
    const assignedUsers = users.filter((user) =>
        assignedUserIds.includes(user.id),
    );

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen) {
            setSelectedUserIds([...assignedUserIds]);
            setErrorMessage(undefined);
        }
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        setErrorMessage(undefined);
        try {
            await assignSelectedPlantingTaskAction(
                item.identity,
                selectedUserIds,
                commandIdRef.current,
            );
            commandIdRef.current = crypto.randomUUID();
            setOpen(false);
        } catch (error) {
            console.error('Error assigning selected planting:', error);
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Dodjela sijanja nije uspjela.',
            );
        } finally {
            setIsLoading(false);
        }
    };

    const trigger =
        assignedUsers.length > 0 ? (
            <button
                aria-label={`Dodijeljeno korisnika: ${assignedUsers.length.toString()}`}
                className="inline-flex h-7 min-w-7 items-center justify-center rounded-full transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disabled}
                title={`Dodijeljeno korisnika: ${assignedUsers.length.toString()}`}
                type="button"
            >
                <Row spacing={-2}>
                    {assignedUsers.slice(0, 2).map((user) => (
                        <UserAvatar
                            avatarUrl={user.avatarUrl}
                            className="size-6 ring-1 ring-background"
                            displayName={user.displayName ?? user.userName}
                            key={user.id}
                        />
                    ))}
                    {assignedUsers.length > 2 ? (
                        <Typography level="body3">
                            +{assignedUsers.length - 2}
                        </Typography>
                    ) : null}
                </Row>
            </button>
        ) : (
            <IconButton
                aria-label="Dodijeli korisnika"
                color="warning"
                disabled={disabled || users.length === 0}
                size="xs"
                title="Dodijeli korisnika"
                variant="soft"
            >
                <User className="size-4 shrink-0" />
            </IconButton>
        );

    return (
        <Modal
            onOpenChange={handleOpenChange}
            open={open}
            title={`Dodjela: ${item.label}`}
            trigger={trigger}
        >
            <Stack spacing={4}>
                <Typography level="h5">Dodjela sijanja</Typography>
                <Stack spacing={2}>
                    <Button
                        disabled={selectedUserIds.length === 0}
                        onClick={() => setSelectedUserIds([])}
                        variant="plain"
                    >
                        Ukloni sve dodjele
                    </Button>
                    {users.map((user) => (
                        <Checkbox
                            checked={selectedUserIds.includes(user.id)}
                            key={user.id}
                            label={
                                user.displayName
                                    ? `${user.displayName} (${user.userName})`
                                    : user.userName
                            }
                            onCheckedChange={(checked: boolean) =>
                                setSelectedUserIds((current) =>
                                    checked
                                        ? [...new Set([...current, user.id])]
                                        : current.filter(
                                              (userId) => userId !== user.id,
                                          ),
                                )
                            }
                        />
                    ))}
                </Stack>
                {errorMessage ? (
                    <Typography className="text-red-600" level="body2">
                        {errorMessage}
                    </Typography>
                ) : null}
                <Row justifyContent="end" spacing={2}>
                    <Button
                        disabled={isLoading}
                        onClick={() => handleOpenChange(false)}
                        variant="outlined"
                    >
                        Odustani
                    </Button>
                    <Button
                        disabled={isLoading}
                        loading={isLoading}
                        onClick={handleSubmit}
                        variant="solid"
                    >
                        Spremi dodjelu
                    </Button>
                </Row>
            </Stack>
        </Modal>
    );
}

function SelectedPlantingBlockModal({
    item,
}: {
    item: AdminSelectedPlantingScheduleItem;
}) {
    const [open, setOpen] = useState(false);
    const [reasonCode, setReasonCode] =
        useState<ScheduleTaskBlockReasonCode>('unsafe_conditions');
    const [note, setNote] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>();
    const commandIdRef = useRef(crypto.randomUUID());

    const handleSubmit = async () => {
        setIsLoading(true);
        setErrorMessage(undefined);
        try {
            await blockSelectedPlantingTaskAction(
                item.identity,
                reasonCode,
                commandIdRef.current,
                note.trim() || undefined,
            );
            commandIdRef.current = crypto.randomUUID();
            setOpen(false);
        } catch (error) {
            console.error('Error blocking selected planting:', error);
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Prijava prepreke nije uspjela.',
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            onOpenChange={setOpen}
            open={open}
            title={`Prijavi prepreku: ${item.label}`}
            trigger={
                <IconButton
                    aria-label={`Prijavi prepreku: ${item.label}`}
                    color="warning"
                    size="xs"
                    title="Prijavi prepreku"
                    variant="plain"
                >
                    <Warning className="size-4 shrink-0" />
                </IconButton>
            }
        >
            <Stack spacing={4}>
                <label className="grid gap-1 text-sm font-medium">
                    Razlog
                    <select
                        className="min-h-11 rounded-md border bg-card px-3"
                        disabled={isLoading}
                        onChange={(event) => {
                            const reason = parseSelectedTaskBlockReason(
                                event.target.value,
                            );
                            if (reason) {
                                setReasonCode(reason.code);
                            }
                        }}
                        value={reasonCode}
                    >
                        {selectedTaskBlockerReasons.map((reason) => (
                            <option key={reason.code} value={reason.code}>
                                {reason.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="grid gap-1 text-sm font-medium">
                    Napomena
                    <textarea
                        className="min-h-24 rounded-md border bg-card px-3 py-2"
                        disabled={isLoading}
                        maxLength={2000}
                        onChange={(event) => setNote(event.target.value)}
                        value={note}
                    />
                </label>
                {errorMessage ? (
                    <Typography className="text-red-600" level="body2">
                        {errorMessage}
                    </Typography>
                ) : null}
                <Row justifyContent="end" spacing={2}>
                    <Button
                        disabled={isLoading}
                        onClick={() => setOpen(false)}
                        variant="outlined"
                    >
                        Odustani
                    </Button>
                    <Button
                        color="warning"
                        disabled={isLoading}
                        loading={isLoading}
                        onClick={handleSubmit}
                        variant="solid"
                    >
                        Spremi prepreku
                    </Button>
                </Row>
            </Stack>
        </Modal>
    );
}

function SelectedPlantingVerifyModal({
    item,
}: {
    item: AdminSelectedPlantingScheduleItem;
}) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>();
    const commandIdRef = useRef(crypto.randomUUID());

    const handleConfirm = async () => {
        setIsLoading(true);
        setErrorMessage(undefined);
        try {
            await verifySelectedPlantingTaskAction(
                item.identity,
                commandIdRef.current,
            );
            commandIdRef.current = crypto.randomUUID();
            setOpen(false);
        } catch (error) {
            console.error('Error verifying selected planting:', error);
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Verifikacija sijanja nije uspjela.',
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            onOpenChange={setOpen}
            open={open}
            title="Verifikacija sijanja"
            trigger={
                <Button color="success" size="xs" variant="solid">
                    Potvrdi
                </Button>
            }
        >
            <Stack spacing={4}>
                <Typography>
                    Potvrditi predano sijanje: <strong>{item.label}</strong>?
                </Typography>
                {errorMessage ? (
                    <Typography className="text-red-600" level="body2">
                        {errorMessage}
                    </Typography>
                ) : null}
                <Row justifyContent="end" spacing={2}>
                    <Button
                        disabled={isLoading}
                        onClick={() => setOpen(false)}
                        variant="outlined"
                    >
                        Odustani
                    </Button>
                    <Button
                        disabled={isLoading}
                        loading={isLoading}
                        onClick={handleConfirm}
                        variant="solid"
                    >
                        Verificiraj
                    </Button>
                </Row>
            </Stack>
        </Modal>
    );
}

export function SelectedPlantingScheduleTaskRow({
    farmUsers,
    item,
    physicalId,
    plantSort,
    timeZone,
}: {
    farmUsers: readonly RaisedBedFieldAssignableFarmUser[];
    item: AdminSelectedPlantingScheduleItem;
    physicalId: string;
    plantSort: EntityStandardized | undefined;
    timeZone: string;
}) {
    const completed = item.status === 'completed';
    const pendingVerification = item.status === 'pendingVerification';
    const blocked = item.status === 'blocked';
    const planned = item.status === 'planned';
    const taskLocked = pendingVerification || completed;
    const positionLabel = item.physicalPositionNumbers.join(', ');
    const scheduledDate = item.scheduledDate
        ? new Date(item.scheduledDate)
        : undefined;
    const lifecycleTargets = item.lifecycleStatus
        ? getImageObservablePlantStatusTargets(item.lifecycleStatus).filter(
              isMutableLifecycleStatus,
          )
        : [];

    const complete = () =>
        completeSelectedPlantingTaskAction(
            item.identity,
            crypto.randomUUID(),
        ).then(() => undefined);

    return (
        <div
            className="border-t py-2"
            data-selected-planting-task-id={item.plantingId}
        >
            <Row className="min-w-0 flex-wrap gap-y-2" spacing={1}>
                <Row className="min-w-0 flex-1 flex-nowrap gap-1 md:gap-2">
                    {completed ? (
                        <Checkbox checked disabled />
                    ) : pendingVerification ? (
                        <SelectedPlantingVerifyModal item={item} />
                    ) : planned ? (
                        <CompletePlantingModal
                            label={item.label}
                            onConfirm={complete}
                            raisedBedPhysicalId={physicalId}
                        />
                    ) : (
                        <Checkbox disabled />
                    )}
                    <SchedulePlantVisual
                        label={item.label}
                        plantSort={plantSort}
                    />
                    <div className="min-w-0 flex-1">
                        <Typography
                            className={
                                completed
                                    ? 'line-through text-muted-foreground'
                                    : undefined
                            }
                            level="body1"
                        >
                            {item.label}
                        </Typography>
                        <Row className="mt-1 flex-wrap gap-y-1" spacing={1}>
                            <Chip color="neutral" size="sm" variant="soft">
                                Polja {positionLabel}
                            </Chip>
                            <Chip color="neutral" size="sm" variant="soft">
                                {formatMinutes(PLANTING_TASK_DURATION_MINUTES)}
                            </Chip>
                            {item.sowingLocation === 'greenhouse' ? (
                                <Chip color="success" size="sm" variant="soft">
                                    Staklenik
                                </Chip>
                            ) : null}
                            {blocked ? (
                                <Chip color="error" size="sm" variant="soft">
                                    Blokirano
                                </Chip>
                            ) : pendingVerification ? (
                                <Chip color="warning" size="sm" variant="soft">
                                    Čeka verifikaciju
                                </Chip>
                            ) : completed ? (
                                <Chip color="success" size="sm" variant="soft">
                                    Posijano
                                </Chip>
                            ) : null}
                            {item.scheduledDate ? (
                                <LocalDateTime
                                    format={{
                                        day: 'numeric',
                                        month: 'numeric',
                                        timeZone,
                                        year: 'numeric',
                                    }}
                                    time={false}
                                >
                                    {item.scheduledDate}
                                </LocalDateTime>
                            ) : (
                                <Chip color="warning" size="sm">
                                    Nije planirano
                                </Chip>
                            )}
                        </Row>
                    </div>
                </Row>
                <Row className="ml-auto shrink-0" spacing={0}>
                    <SelectedPlantingAssignmentModal
                        assignedUserIds={item.assignedUserIds}
                        disabled={taskLocked}
                        farmUsers={farmUsers}
                        item={item}
                    />
                    <RescheduleModal
                        hiddenFields={null}
                        label={item.plantName}
                        onSubmit={async (formData) => {
                            const value = formData.get('scheduledDate');
                            await rescheduleSelectedPlantingTaskAction(
                                item.identity,
                                typeof value === 'string' ? value : null,
                                item.sowingLocation,
                                crypto.randomUUID(),
                            );
                        }}
                        scheduledDate={scheduledDate}
                        trigger={
                            <IconButton
                                disabled={taskLocked}
                                size="xs"
                                title={
                                    item.scheduledDate
                                        ? 'Prerasporedi sijanje'
                                        : 'Zakaži sijanje'
                                }
                                variant="plain"
                            >
                                <Calendar className="size-4 shrink-0" />
                            </IconButton>
                        }
                    />
                    <Button
                        color={
                            item.sowingLocation === 'greenhouse'
                                ? 'success'
                                : 'neutral'
                        }
                        disabled={!planned && !blocked}
                        onClick={() =>
                            rescheduleSelectedPlantingTaskAction(
                                item.identity,
                                item.scheduledDate,
                                item.sowingLocation === 'greenhouse'
                                    ? 'direct'
                                    : 'greenhouse',
                                crypto.randomUUID(),
                            )
                        }
                        size="xs"
                        startDecorator={
                            item.sowingLocation === 'greenhouse' ? (
                                <ToggleRight className="size-4 shrink-0" />
                            ) : (
                                <ToggleLeft className="size-4 shrink-0" />
                            )
                        }
                        title="Promijeni lokaciju sijanja"
                        variant="plain"
                    >
                        {item.sowingLocation === 'greenhouse'
                            ? 'Staklenik'
                            : 'Direktno'}
                    </Button>
                    {planned ? (
                        <SelectedPlantingBlockModal item={item} />
                    ) : null}
                    <CancelRequestModal
                        confirmLabel="Otkaži sijanje"
                        description="Otkazuje se jedno sijanje koje obuhvaća sva navedena polja."
                        hiddenFields={null}
                        label={item.label}
                        onSubmit={async (formData) => {
                            const reason = formData.get('reason');
                            await cancelSelectedPlantingTaskAction(
                                item.identity,
                                typeof reason === 'string' ? reason : '',
                                crypto.randomUUID(),
                            );
                        }}
                        trigger={
                            <IconButton
                                disabled={!planned && !blocked}
                                size="xs"
                                title="Otkaži sijanje"
                                variant="plain"
                            >
                                <Close className="size-4 shrink-0" />
                            </IconButton>
                        }
                    />
                </Row>
            </Row>
            {item.block ? (
                <div className="mx-1 mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    <strong>{item.block.reasonLabel}</strong>
                    {item.block.note ? ` · ${item.block.note}` : ''}
                    {item.block.images.length > 0
                        ? ` · ${item.block.images.length.toString()} fotografija`
                        : ''}
                </div>
            ) : null}
            {item.completion &&
            (item.completion.notes || item.completion.images.length > 0) ? (
                <div className="mx-1 mt-2 rounded-md bg-muted px-3 py-2 text-sm">
                    {item.completion.notes ?? 'Predano bez napomene'}
                    {item.completion.images.length > 0
                        ? ` · ${item.completion.images.length.toString()} fotografija`
                        : ''}
                </div>
            ) : null}
            {completed &&
            item.lifecycleStatus &&
            lifecycleTargets.length > 0 ? (
                <div className="mx-1 mt-2 flex max-w-sm items-center gap-2">
                    <Typography className="shrink-0" level="body2">
                        Stanje biljke
                    </Typography>
                    <SelectItems
                        className="min-w-0"
                        items={[item.lifecycleStatus, ...lifecycleTargets].map(
                            (status) => ({
                                label: plantFieldStatusLabel(status).shortLabel,
                                value: status,
                            }),
                        )}
                        onValueChange={async (status) => {
                            if (!isMutableLifecycleStatus(status)) {
                                return;
                            }
                            await updateSelectedPlantingLifecycleStatusAction(
                                item.identity,
                                status,
                                crypto.randomUUID(),
                            );
                        }}
                        value={item.lifecycleStatus}
                        variant="outlined"
                    />
                </div>
            ) : null}
        </div>
    );
}
