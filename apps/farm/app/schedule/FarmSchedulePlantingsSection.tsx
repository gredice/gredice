import { calculatePlantsPerField } from '@gredice/js/plants';
import type {
    EntityStandardized,
    RaisedBedFieldAssignableFarmUser,
} from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { CompletePlantingModal } from './CompletePlantingModal';
import type { FarmScheduleDayData } from './scheduleData';
import {
    formatMinutes,
    groupRaisedBedsForSchedule,
    isFieldApproved,
    isFieldCompleted,
    PLANTING_TASK_DURATION_MINUTES,
} from './scheduleShared';

type FarmRaisedBedField = FarmScheduleDayData['scheduledFields'][number];

interface FarmSchedulePlantingsSectionProps {
    raisedBeds: FarmScheduleDayData['raisedBeds'];
    scheduledFields: FarmScheduleDayData['scheduledFields'];
    plantSorts: EntityStandardized[] | null | undefined;
    userId: string;
    assignedUserByFieldId: Map<number, RaisedBedFieldAssignableFarmUser>;
}

function buildFieldLabel(
    field: FarmRaisedBedField,
    plantSortById: Map<number, EntityStandardized>,
) {
    const sort = field.plantSortId
        ? plantSortById.get(field.plantSortId)
        : null;
    if (!field.plantSortId || !sort) {
        return `${field.positionIndex + 1} - sijanje: ? Nepoznato`;
    }

    const seedingDistance =
        sort.information?.plant?.attributes?.seedingDistance;
    const totalPlants = seedingDistance
        ? calculatePlantsPerField(seedingDistance).totalPlants
        : null;
    return `${field.positionIndex + 1} - sijanje: ${totalPlants ?? '?'} ${sort.information?.name ?? 'Nepoznato'}`;
}

export function FarmSchedulePlantingsSection({
    raisedBeds,
    scheduledFields,
    plantSorts,
    userId,
    assignedUserByFieldId,
}: FarmSchedulePlantingsSectionProps) {
    if (scheduledFields.length === 0) {
        return null;
    }

    const plantSortById = new Map<number, EntityStandardized>();
    if (plantSorts) {
        for (const plantSort of plantSorts) {
            plantSortById.set(plantSort.id, plantSort);
        }
    }

    const affectedRaisedBedIds = [
        ...new Set(scheduledFields.map((field) => field.raisedBedId)),
    ];
    const raisedBedGroups = groupRaisedBedsForSchedule(
        raisedBeds,
        affectedRaisedBedIds,
    );

    return (
        <Stack spacing={2}>
            {raisedBedGroups.map(
                ({ key, physicalId, raisedBeds: groupedRaisedBeds }) => {
                    const dayFields = scheduledFields
                        .filter((field) =>
                            groupedRaisedBeds.some(
                                (raisedBed) =>
                                    raisedBed.id === field.raisedBedId,
                            ),
                        )
                        .sort(
                            (left, right) =>
                                left.positionIndex - right.positionIndex,
                        )
                        .map((field) => ({
                            ...field,
                            label: buildFieldLabel(field, plantSortById),
                        }));

                    const totalDuration =
                        dayFields.length * PLANTING_TASK_DURATION_MINUTES;

                    return (
                        <Stack key={key} spacing={1}>
                            <Row
                                spacing={1}
                                className="items-center flex-wrap gap-y-1"
                            >
                                {physicalId ? (
                                    <RaisedBedLabel physicalId={physicalId} />
                                ) : (
                                    <Typography semiBold>
                                        Gredica bez fizičkog ID-a
                                    </Typography>
                                )}
                                <Typography
                                    level="body2"
                                    className="text-muted-foreground"
                                >
                                    {dayFields.length} sijanja
                                </Typography>
                                {totalDuration > 0 && (
                                    <Typography
                                        level="body2"
                                        className="text-muted-foreground"
                                    >
                                        Vrijeme: {formatMinutes(totalDuration)}
                                    </Typography>
                                )}
                            </Row>
                            <Stack spacing={1}>
                                {dayFields.map((field) => {
                                    const completed = isFieldCompleted(
                                        field.plantStatus,
                                    );
                                    const approved = isFieldApproved(
                                        field.plantStatus,
                                    );
                                    const lockedByAssignment =
                                        !completed &&
                                        !!field.assignedUserId &&
                                        field.assignedUserId !== userId;
                                    const canComplete =
                                        !completed && !lockedByAssignment;
                                    const assignedUser =
                                        assignedUserByFieldId.get(field.id);

                                    return (
                                        <div
                                            key={field.id}
                                            className={`rounded-lg border bg-white px-3 py-2 ${lockedByAssignment ? 'opacity-70' : ''}`}
                                        >
                                            <Row
                                                spacing={1}
                                                className="items-start justify-between gap-3"
                                            >
                                                <Row
                                                    spacing={1}
                                                    className="min-w-0 grow items-start"
                                                >
                                                    {completed ? (
                                                        <Checkbox
                                                            className="size-5"
                                                            checked
                                                            disabled
                                                        />
                                                    ) : canComplete ? (
                                                        <CompletePlantingModal
                                                            label={field.label}
                                                            raisedBedId={
                                                                field.raisedBedId
                                                            }
                                                            positionIndex={
                                                                field.positionIndex
                                                            }
                                                        />
                                                    ) : (
                                                        <div title="Sijanje je dodijeljeno drugom korisniku.">
                                                            <Checkbox
                                                                className="size-5"
                                                                disabled
                                                            />
                                                        </div>
                                                    )}
                                                    <Stack
                                                        spacing={0.5}
                                                        className="min-w-0 grow"
                                                    >
                                                        <Typography
                                                            className={
                                                                completed
                                                                    ? 'line-through text-muted-foreground'
                                                                    : undefined
                                                            }
                                                        >
                                                            {field.label}
                                                        </Typography>
                                                        <Row
                                                            spacing={1}
                                                            className="items-center flex-wrap gap-y-1"
                                                        >
                                                            <Typography
                                                                level="body2"
                                                                className={
                                                                    completed ||
                                                                    approved
                                                                        ? 'text-green-600'
                                                                        : 'text-muted-foreground'
                                                                }
                                                            >
                                                                {completed
                                                                    ? 'Završeno'
                                                                    : approved
                                                                      ? 'Potvrđeno'
                                                                      : 'Nije potvrđeno'}
                                                            </Typography>
                                                            <Typography
                                                                level="body2"
                                                                className="text-muted-foreground"
                                                            >
                                                                {formatMinutes(
                                                                    PLANTING_TASK_DURATION_MINUTES,
                                                                )}
                                                            </Typography>
                                                            <Typography
                                                                level="body2"
                                                                className="text-muted-foreground"
                                                            >
                                                                {field.plantScheduledDate ? (
                                                                    <>
                                                                        Planirano:{' '}
                                                                        <LocalDateTime
                                                                            time={
                                                                                false
                                                                            }
                                                                        >
                                                                            {
                                                                                field.plantScheduledDate
                                                                            }
                                                                        </LocalDateTime>
                                                                    </>
                                                                ) : (
                                                                    'Danas'
                                                                )}
                                                            </Typography>
                                                        </Row>
                                                    </Stack>
                                                </Row>
                                                {assignedUser && (
                                                    <div
                                                        className="shrink-0"
                                                        title={`Dodijeljeno: ${assignedUser.displayName ?? assignedUser.userName}`}
                                                    >
                                                        <UserAvatar
                                                            avatarUrl={
                                                                assignedUser.avatarUrl
                                                            }
                                                            displayName={
                                                                assignedUser.displayName ??
                                                                assignedUser.userName
                                                            }
                                                            className="size-7"
                                                        />
                                                    </div>
                                                )}
                                            </Row>
                                        </div>
                                    );
                                })}
                            </Stack>
                        </Stack>
                    );
                },
            )}
        </Stack>
    );
}

export default FarmSchedulePlantingsSection;
