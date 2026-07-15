import { plantFieldStatusLabel } from '@gredice/js/plants';
import { Button } from '@gredice/ui/Button';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../lib/auth/auth';
import {
    type AdminApprovalTask,
    getPendingAdminApprovalTasks,
} from '../../../src/approvalTasks';
import { KnownPages } from '../../../src/KnownPages';
import {
    approveApprovalRequestAction,
    approveScheduleOperationTaskAction,
    approveSchedulePlantingTaskAction,
    rejectApprovalRequestAction,
} from '../../(actions)/approvalActions';
import { RaisedBedTaskLink } from './RaisedBedTaskLink';

export const dynamic = 'force-dynamic';

function taskKindLabel(kind: AdminApprovalTask['kind']) {
    switch (kind) {
        case 'plantStatusRequest':
            return 'Stanje biljke';
        case 'scheduleOperationVerification':
            return 'Radnja';
        case 'schedulePlantingVerification':
            return 'Sijanje';
    }
}

function taskKindMeta(kind: AdminApprovalTask['kind']) {
    if (kind === 'plantStatusRequest') {
        return { color: 'info' as const };
    }

    return { color: 'warning' as const };
}

export default async function AdminApprovalsPage() {
    await auth(['admin']);
    const tasks = await getPendingAdminApprovalTasks();

    return (
        <Stack spacing={4}>
            <Card>
                <CardOverflow>
                    {tasks.length === 0 ? (
                        <div className="p-4">
                            <NoDataPlaceholder>
                                Nema zahtjeva za odobrenje.
                            </NoDataPlaceholder>
                        </div>
                    ) : (
                        <ul className="divide-y">
                            {tasks.map((task) => {
                                const meta = taskKindMeta(task.kind);

                                return (
                                    <li
                                        key={task.id}
                                        className="transition-colors hover:bg-muted/40"
                                    >
                                        <div className="flex min-w-0 flex-col gap-3 px-3 py-3 sm:px-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-start">
                                                <div className="flex shrink-0 items-center">
                                                    <Chip
                                                        color={meta.color}
                                                        size="sm"
                                                        variant="soft"
                                                    >
                                                        {taskKindLabel(
                                                            task.kind,
                                                        )}
                                                    </Chip>
                                                </div>
                                                <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.8fr)]">
                                                    <Stack
                                                        spacing={1}
                                                        className="min-w-0"
                                                    >
                                                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                            {task.raisedBedId !=
                                                            null ? (
                                                                <RaisedBedTaskLink
                                                                    raisedBedId={
                                                                        task.raisedBedId
                                                                    }
                                                                    physicalId={
                                                                        task.raisedBedPhysicalId
                                                                    }
                                                                />
                                                            ) : null}
                                                            <Typography
                                                                level="body2"
                                                                component="h3"
                                                                semiBold
                                                                className="min-w-0 break-words"
                                                            >
                                                                {task.title}
                                                            </Typography>
                                                        </div>
                                                        <Typography
                                                            level="body3"
                                                            className="min-w-0 break-words text-muted-foreground"
                                                        >
                                                            {task.description}
                                                        </Typography>
                                                    </Stack>
                                                    <Stack
                                                        spacing={1}
                                                        className="min-w-0"
                                                    >
                                                        <Typography
                                                            level="body3"
                                                            semiBold
                                                            className="text-muted-foreground"
                                                        >
                                                            Detalji
                                                        </Typography>
                                                        {task.kind ===
                                                        'plantStatusRequest' ? (
                                                            <>
                                                                <Typography level="body3">
                                                                    Zatražio:{' '}
                                                                    {
                                                                        task.requestedBy
                                                                    }
                                                                </Typography>
                                                                <Typography
                                                                    level="body3"
                                                                    className="text-muted-foreground"
                                                                >
                                                                    Novo stanje:{' '}
                                                                    {
                                                                        plantFieldStatusLabel(
                                                                            task.requestedStatus,
                                                                        )
                                                                            .shortLabel
                                                                    }
                                                                </Typography>
                                                                {task.note ? (
                                                                    <Typography
                                                                        level="body3"
                                                                        className="max-w-md whitespace-pre-line break-words text-muted-foreground"
                                                                    >
                                                                        {
                                                                            task.note
                                                                        }
                                                                    </Typography>
                                                                ) : null}
                                                            </>
                                                        ) : task.kind ===
                                                          'scheduleOperationVerification' ? (
                                                            <Typography level="body3">
                                                                Označio
                                                                završeno:{' '}
                                                                {task.completedBy ??
                                                                    'Nepoznato'}
                                                            </Typography>
                                                        ) : (
                                                            <Typography level="body3">
                                                                Čeka
                                                                verifikaciju
                                                                sijanja.
                                                            </Typography>
                                                        )}
                                                    </Stack>
                                                </div>
                                            </div>
                                            <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 lg:max-w-[22rem] lg:justify-end">
                                                <Typography
                                                    level="body3"
                                                    className="whitespace-nowrap text-muted-foreground"
                                                >
                                                    Zaprimljeno:{' '}
                                                    <LocalDateTime>
                                                        {task.receivedAt}
                                                    </LocalDateTime>
                                                </Typography>
                                                {task.kind ===
                                                'plantStatusRequest' ? (
                                                    <>
                                                        <form
                                                            action={approveApprovalRequestAction.bind(
                                                                null,
                                                                task.requestId,
                                                            )}
                                                        >
                                                            <Button
                                                                type="submit"
                                                                size="sm"
                                                            >
                                                                Odobri
                                                            </Button>
                                                        </form>
                                                        <form
                                                            action={rejectApprovalRequestAction.bind(
                                                                null,
                                                                task.requestId,
                                                            )}
                                                        >
                                                            <Button
                                                                type="submit"
                                                                size="sm"
                                                                variant="outlined"
                                                            >
                                                                Odbij
                                                            </Button>
                                                        </form>
                                                    </>
                                                ) : task.kind ===
                                                  'scheduleOperationVerification' ? (
                                                    <>
                                                        <Button
                                                            href={KnownPages.Operation(
                                                                task.operationId,
                                                            )}
                                                            size="sm"
                                                            variant="outlined"
                                                        >
                                                            Uredi
                                                        </Button>
                                                        <form
                                                            action={approveScheduleOperationTaskAction.bind(
                                                                null,
                                                                task.operationId,
                                                                task.expectedEntityId,
                                                                task.expectedTaskVersionEventId,
                                                            )}
                                                        >
                                                            <Button
                                                                type="submit"
                                                                size="sm"
                                                            >
                                                                Verificiraj
                                                            </Button>
                                                        </form>
                                                    </>
                                                ) : (
                                                    <form
                                                        action={approveSchedulePlantingTaskAction.bind(
                                                            null,
                                                            task.raisedBedId,
                                                            task.positionIndex,
                                                            task.expectedPlantCycleEventId,
                                                            task.expectedPlantSortId,
                                                            task.expectedPlantCycleVersionEventId,
                                                        )}
                                                    >
                                                        <Button
                                                            type="submit"
                                                            size="sm"
                                                        >
                                                            Verificiraj
                                                        </Button>
                                                    </form>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </CardOverflow>
            </Card>
        </Stack>
    );
}
