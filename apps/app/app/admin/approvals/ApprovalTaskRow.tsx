import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import {
    Check,
    Clear,
    Edit,
    Leaf,
    Replace,
    Sprout,
    Verified,
} from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { OperationImage } from '@gredice/ui/OperationImage';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Typography } from '@gredice/ui/Typography';
import type { AdminApprovalTask } from '../../../src/approvalTasks';
import { KnownPages } from '../../../src/KnownPages';
import { ApprovalStatusTransition } from './ApprovalStatusTransition';
import { RaisedBedTaskLink } from './RaisedBedTaskLink';

const taskKinds = {
    plantStatusRequest: { label: 'Stanje biljke', Icon: Replace },
    scheduleOperationVerification: { label: 'Radnja', Icon: Verified },
    schedulePlantingVerification: { label: 'Sijanje', Icon: Sprout },
};

export function ApprovalTaskRow({
    task,
    error,
    onApprove,
    onReject,
}: {
    task: AdminApprovalTask;
    error?: string;
    onApprove: () => void;
    onReject?: () => void;
}) {
    const { label, Icon } = taskKinds[task.kind];

    return (
        <li className="transition-colors hover:bg-muted/40">
            <div className="flex min-w-0 flex-col gap-3 px-3 py-3 sm:px-4 xl:flex-row xl:items-start">
                <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.8fr)]">
                    <div className="flex min-w-0 items-start gap-3">
                        {task.kind === 'scheduleOperationVerification' ? (
                            <OperationImage
                                operation={task.operationDefinition}
                                size={40}
                                className="rounded-md"
                            />
                        ) : task.plantImageUrl ? (
                            <PlantOrSortImage
                                coverUrl={task.plantImageUrl}
                                alt={task.description}
                                width={40}
                                height={40}
                                className="size-10 shrink-0 rounded-md object-contain"
                            />
                        ) : (
                            <span
                                className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                                aria-hidden="true"
                            >
                                <Leaf className="size-5" />
                            </span>
                        )}
                        <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <Chip
                                    color={
                                        task.kind === 'plantStatusRequest'
                                            ? 'info'
                                            : 'warning'
                                    }
                                    size="sm"
                                    variant="soft"
                                    startDecorator={<Icon aria-hidden="true" />}
                                >
                                    {label}
                                </Chip>
                                {task.raisedBedId != null ? (
                                    <RaisedBedTaskLink
                                        raisedBedId={task.raisedBedId}
                                        physicalId={task.raisedBedPhysicalId}
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
                            {task.kind === 'plantStatusRequest' ? (
                                <ApprovalStatusTransition
                                    currentStatus={task.currentStatus}
                                    requestedStatus={task.requestedStatus}
                                />
                            ) : null}
                        </div>
                    </div>
                    <div className="min-w-0 space-y-1">
                        {task.kind === 'plantStatusRequest' ? (
                            <>
                                <Typography level="body3">
                                    Zatražio: {task.requestedBy}
                                </Typography>
                                {task.note ? (
                                    <Typography
                                        level="body3"
                                        className="max-w-md whitespace-pre-line break-words text-muted-foreground"
                                    >
                                        {task.note}
                                    </Typography>
                                ) : null}
                            </>
                        ) : task.kind === 'scheduleOperationVerification' ? (
                            <Typography level="body3">
                                Označio završeno:{' '}
                                {task.completedBy ?? 'Nepoznato'}
                            </Typography>
                        ) : (
                            <Typography level="body3">
                                Čeka verifikaciju sijanja.
                            </Typography>
                        )}
                        {error ? (
                            <p
                                role="alert"
                                className="text-xs text-red-700 dark:text-red-300"
                            >
                                {error}
                            </p>
                        ) : null}
                    </div>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:w-64 xl:flex-col xl:items-end">
                    <Typography
                        level="body3"
                        className="whitespace-nowrap text-muted-foreground"
                    >
                        Zaprimljeno:{' '}
                        <LocalDateTime>{task.receivedAt}</LocalDateTime>
                    </Typography>
                    <div className="flex items-center gap-1">
                        {task.kind === 'scheduleOperationVerification' ? (
                            <Button
                                href={KnownPages.Operation(task.operationId)}
                                size="sm"
                                variant="outlined"
                                startDecorator={
                                    <Edit
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                }
                            >
                                Uredi
                            </Button>
                        ) : null}
                        <Button
                            type="button"
                            size="sm"
                            onClick={onApprove}
                            startDecorator={
                                <Check
                                    className="size-3.5"
                                    aria-hidden="true"
                                />
                            }
                        >
                            {task.kind === 'plantStatusRequest'
                                ? 'Odobri'
                                : 'Verificiraj'}
                        </Button>
                        {onReject ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="plain"
                                color="neutral"
                                onClick={onReject}
                                startDecorator={
                                    <Clear
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                }
                            >
                                Odbij
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>
        </li>
    );
}
