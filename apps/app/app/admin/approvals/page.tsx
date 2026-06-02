import { plantFieldStatusLabel } from '@gredice/js/plants';
import { Button } from '@gredice/ui/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../lib/auth/auth';
import {
    type AdminApprovalTask,
    getPendingAdminApprovalTasks,
} from '../../../src/approvalTasks';
import {
    approveApprovalRequestAction,
    approveScheduleOperationTaskAction,
    approveSchedulePlantingTaskAction,
    rejectApprovalRequestAction,
} from '../../(actions)/approvalActions';

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
        <Stack spacing={6}>
            <Stack spacing={2}>
                <Typography level="h4" component="h1">
                    Odobrenja
                </Typography>
                <Typography level="body2" className="text-muted-foreground">
                    Zahtjevi farmera i završeni rasporedni zadaci koji čekaju
                    administrativnu potvrdu.
                </Typography>
            </Stack>
            <Card>
                <CardHeader>
                    <CardTitle>Zahtjevi na čekanju</CardTitle>
                </CardHeader>
                <CardContent>
                    <Typography level="body2">
                        Ukupno {tasks.length} zahtjeva čeka odobrenje.
                    </Typography>
                </CardContent>
                <CardOverflow>
                    <div className="overflow-auto">
                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Head>Vrsta</Table.Head>
                                    <Table.Head>Zahtjev</Table.Head>
                                    <Table.Head>Detalji</Table.Head>
                                    <Table.Head>Zaprimljeno</Table.Head>
                                    <Table.Head>Radnja</Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {tasks.length === 0 && (
                                    <Table.Row>
                                        <Table.Cell colSpan={5}>
                                            <NoDataPlaceholder>
                                                Nema zahtjeva za odobrenje.
                                            </NoDataPlaceholder>
                                        </Table.Cell>
                                    </Table.Row>
                                )}
                                {tasks.map((task) => {
                                    const meta = taskKindMeta(task.kind);
                                    return (
                                        <Table.Row key={task.id}>
                                            <Table.Cell>
                                                <Chip
                                                    color={meta.color}
                                                    size="sm"
                                                    variant="soft"
                                                >
                                                    {taskKindLabel(task.kind)}
                                                </Chip>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <Stack spacing={1}>
                                                    <Typography
                                                        level="body2"
                                                        semiBold
                                                    >
                                                        {task.title}
                                                    </Typography>
                                                    <Typography
                                                        level="body3"
                                                        className="text-muted-foreground"
                                                    >
                                                        {task.description}
                                                    </Typography>
                                                </Stack>
                                            </Table.Cell>
                                            <Table.Cell>
                                                {task.kind ===
                                                'plantStatusRequest' ? (
                                                    <Stack spacing={1}>
                                                        <Typography level="body3">
                                                            Zatražio:{' '}
                                                            {task.requestedBy}
                                                        </Typography>
                                                        <Typography
                                                            level="body3"
                                                            className="text-muted-foreground"
                                                        >
                                                            Novo stanje:{' '}
                                                            {
                                                                plantFieldStatusLabel(
                                                                    task.requestedStatus,
                                                                ).shortLabel
                                                            }
                                                        </Typography>
                                                        {task.note ? (
                                                            <Typography
                                                                level="body3"
                                                                className="max-w-md whitespace-pre-line text-muted-foreground"
                                                            >
                                                                {task.note}
                                                            </Typography>
                                                        ) : null}
                                                    </Stack>
                                                ) : task.kind ===
                                                  'scheduleOperationVerification' ? (
                                                    <Typography level="body3">
                                                        Označio završeno:{' '}
                                                        {task.completedBy ??
                                                            'Nepoznato'}
                                                    </Typography>
                                                ) : (
                                                    <Typography level="body3">
                                                        Čeka verifikaciju
                                                        sijanja.
                                                    </Typography>
                                                )}
                                            </Table.Cell>
                                            <Table.Cell>
                                                <LocalDateTime>
                                                    {task.receivedAt}
                                                </LocalDateTime>
                                            </Table.Cell>
                                            <Table.Cell>
                                                {task.kind ===
                                                'plantStatusRequest' ? (
                                                    <Row spacing={2}>
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
                                                    </Row>
                                                ) : task.kind ===
                                                  'scheduleOperationVerification' ? (
                                                    <form
                                                        action={approveScheduleOperationTaskAction.bind(
                                                            null,
                                                            task.operationId,
                                                        )}
                                                    >
                                                        <Button
                                                            type="submit"
                                                            size="sm"
                                                        >
                                                            Verificiraj
                                                        </Button>
                                                    </form>
                                                ) : (
                                                    <form
                                                        action={approveSchedulePlantingTaskAction.bind(
                                                            null,
                                                            task.raisedBedId,
                                                            task.positionIndex,
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
                                            </Table.Cell>
                                        </Table.Row>
                                    );
                                })}
                            </Table.Body>
                        </Table>
                    </div>
                </CardOverflow>
            </Card>
        </Stack>
    );
}
