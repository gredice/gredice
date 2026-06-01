import { calculatePlantsPerField } from '@gredice/js/plants';
import type {
    EntityStandardized,
    RaisedBedFieldAssignableFarmUser,
} from '@gredice/storage';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { CompletePlantingModal } from './CompletePlantingModal';
import { ScheduleTaskAgeIndicatorChip } from './ScheduleTaskAgeIndicatorChip';
import type { FarmScheduleDayData } from './scheduleData';
import {
    formatMinutes,
    getFieldPhysicalPositionIndex,
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
    physicalPositionIndex: number,
) {
    const taskName =
        field.sowingLocation === 'greenhouse'
            ? 'sijanje u stakleniku'
            : 'sijanje';
    const sort = field.plantSortId
        ? plantSortById.get(field.plantSortId)
        : null;
    if (!field.plantSortId || !sort) {
        return `${physicalPositionIndex} - ${taskName}: ? Nepoznato`;
    }

    const totalPlants = getPlantsPerFieldCount(sort);
    return `${physicalPositionIndex} - ${taskName}: ${totalPlants ?? '?'} ${sort.information?.name ?? 'Nepoznato'}`;
}

function getPlantsPerFieldCount(
    plantSort: EntityStandardized | null | undefined,
) {
    const seedingDistance =
        plantSort?.information?.plant?.attributes?.seedingDistance;
    return typeof seedingDistance === 'number'
        ? calculatePlantsPerField(seedingDistance).totalPlants
        : null;
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
        <Stack spacing={4}>
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
                        .map((field) => {
                            const physicalPositionIndex =
                                getFieldPhysicalPositionIndex(
                                    field,
                                    groupedRaisedBeds,
                                );

                            return {
                                ...field,
                                physicalPositionIndex,
                                label: buildFieldLabel(
                                    field,
                                    plantSortById,
                                    physicalPositionIndex,
                                ),
                            };
                        });
                    const totalDuration =
                        dayFields.length * PLANTING_TASK_DURATION_MINUTES;

                    return (
                        <Stack key={key} spacing={2}>
                            <Row
                                spacing={2}
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
                            <Stack spacing={2}>
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
                                    const greenhouseSowing =
                                        field.sowingLocation === 'greenhouse';

                                    return (
                                        <div
                                            key={field.id}
                                            className={`rounded-lg border bg-white px-3 py-2 ${lockedByAssignment ? 'opacity-70' : ''}`}
                                        >
                                            <Row
                                                spacing={2}
                                                className="min-w-0 items-start justify-between gap-3"
                                            >
                                                <Row
                                                    spacing={2}
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
                                                        spacing={1}
                                                        className="min-w-0 grow"
                                                    >
                                                        <Typography
                                                            className={
                                                                completed
                                                                    ? 'line-through text-muted-foreground [overflow-wrap:anywhere]'
                                                                    : '[overflow-wrap:anywhere]'
                                                            }
                                                        >
                                                            {field.label}
                                                        </Typography>
                                                        <Row
                                                            spacing={2}
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
                                                            {greenhouseSowing && (
                                                                <Chip
                                                                    size="sm"
                                                                    color="success"
                                                                    variant="soft"
                                                                >
                                                                    Staklenik
                                                                </Chip>
                                                            )}
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
                                                            {!completed && (
                                                                <ScheduleTaskAgeIndicatorChip
                                                                    scheduledDate={
                                                                        field.plantScheduledDate
                                                                    }
                                                                />
                                                            )}
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
                                                            className="size-7 rounded-full"
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
