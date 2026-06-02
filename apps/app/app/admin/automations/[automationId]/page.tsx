import {
    type AutomationGraph,
    automationModuleKeys,
    getAutomationDefinitionById,
    getAutomationModuleMetadata,
    listAutomationRunSteps,
    listAutomationRuns,
    listRecentDomainEvents,
} from '@gredice/storage';
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
import { notFound } from 'next/navigation';
import {
    AdminPageHeader,
    AdminPageTitle,
} from '../../../../components/admin/navigation';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../../lib/auth/auth';
import { AutomationFlowEditor } from '../AutomationFlowEditor';
import {
    AutomationTestPanel,
    type RecentAutomationEvent,
    ReplayAutomationRunButton,
} from '../AutomationTestPanel';
import { updateAutomationStatusAction } from '../actions';
import {
    automationActionSummary,
    automationRunStatusMeta,
    automationStatusMeta,
    automationTriggerSummary,
    moduleMetadataByKey,
} from '../presentation';

export const dynamic = 'force-dynamic';

function getTriggerEventType(graph: AutomationGraph) {
    const trigger = graph.nodes.find((node) => node.kind === 'trigger');
    const eventType = trigger?.config.eventType;

    return typeof eventType === 'string' && eventType.trim().length > 0
        ? eventType.trim()
        : null;
}

function getTriggerModuleKey(graph: AutomationGraph) {
    return (
        graph.nodes.find((node) => node.kind === 'trigger')?.moduleKey ?? null
    );
}

function formatDuration(startedAt: Date | null, completedAt: Date | null) {
    if (!startedAt || !completedAt) {
        return '-';
    }

    return `${Math.max(0, completedAt.getTime() - startedAt.getTime())} ms`;
}

function JsonPreview({ value }: { value: unknown }) {
    return (
        <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(value, null, 2)}
        </pre>
    );
}

function StatusChip({
    status,
}: {
    status: Parameters<typeof automationStatusMeta>[0];
}) {
    const meta = automationStatusMeta(status);
    return (
        <Chip color={meta.color} size="sm" variant="soft">
            {meta.label}
        </Chip>
    );
}

function RunStatusChip({
    status,
}: {
    status: Parameters<typeof automationRunStatusMeta>[0];
}) {
    const meta = automationRunStatusMeta(status);
    return (
        <Chip color={meta.color} size="sm" variant="soft">
            {meta.label}
        </Chip>
    );
}

export default async function AutomationDetailPage({
    params,
}: {
    params: Promise<{ automationId: string }>;
}) {
    await auth(['admin']);
    const { automationId } = await params;
    const id = Number(automationId);

    if (!Number.isInteger(id) || id <= 0) {
        notFound();
    }

    const definition = await getAutomationDefinitionById(id);
    if (!definition) {
        notFound();
    }

    const modules = getAutomationModuleMetadata();
    const modulesByKey = moduleMetadataByKey(modules);
    const triggerEventType = getTriggerEventType(definition.graph);
    const triggerModuleKey = getTriggerModuleKey(definition.graph);
    const triggerMode =
        triggerModuleKey === automationModuleKeys.triggerDomainEvent
            ? 'domainEvent'
            : triggerModuleKey === automationModuleKeys.triggerScheduleMonthly
              ? 'schedule'
              : 'unsupported';
    const [runs, recentEvents] = await Promise.all([
        listAutomationRuns({
            automationDefinitionId: definition.id,
            limit: 25,
        }),
        triggerMode === 'domainEvent' && triggerEventType
            ? listRecentDomainEvents({
                  eventTypes: [triggerEventType],
                  limit: 20,
              })
            : Promise.resolve([]),
    ]);
    const runsWithSteps = await Promise.all(
        runs.map(async (run) => ({
            run,
            steps: await listAutomationRunSteps(run.id),
        })),
    );
    const recentAutomationEvents: RecentAutomationEvent[] = recentEvents.map(
        (event) => ({
            id: event.id,
            type: event.type,
            aggregateId: event.aggregateId,
            createdAt: event.createdAt.toISOString(),
        }),
    );
    const enableAutomationAction = async () => {
        'use server';
        await updateAutomationStatusAction(definition.id, 'enabled');
    };
    const disableAutomationAction = async () => {
        'use server';
        await updateAutomationStatusAction(definition.id, 'disabled');
    };
    const archiveAutomationAction = async () => {
        'use server';
        await updateAutomationStatusAction(definition.id, 'archived');
    };

    return (
        <Stack spacing={5}>
            <AdminPageTitle title={definition.name} />
            <AdminPageHeader
                actions={
                    <Row spacing={2}>
                        {definition.status === 'enabled' ? (
                            <form action={disableAutomationAction}>
                                <Button type="submit" variant="outlined">
                                    Isključi
                                </Button>
                            </form>
                        ) : (
                            <form action={enableAutomationAction}>
                                <Button type="submit">Uključi</Button>
                            </form>
                        )}
                        {definition.status !== 'archived' ? (
                            <form action={archiveAutomationAction}>
                                <Button
                                    type="submit"
                                    variant="outlined"
                                    color="danger"
                                >
                                    Arhiviraj
                                </Button>
                            </form>
                        ) : null}
                    </Row>
                }
            />

            <Stack spacing={1}>
                <Row spacing={2} className="flex-wrap">
                    <Typography level="h4" component="h1">
                        {definition.name}
                    </Typography>
                    <StatusChip status={definition.status} />
                </Row>
                <Typography level="body2" className="text-muted-foreground">
                    {definition.description || definition.key}
                </Typography>
            </Stack>

            <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                    <CardContent>
                        <Typography level="body3" secondary>
                            Trigger
                        </Typography>
                        <Typography level="body2">
                            {automationTriggerSummary(
                                definition.graph,
                                modulesByKey,
                            )}
                        </Typography>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent>
                        <Typography level="body3" secondary>
                            Akcije
                        </Typography>
                        <Typography level="body2">
                            {automationActionSummary(
                                definition.graph,
                                modulesByKey,
                            )}
                        </Typography>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent>
                        <Typography level="body3" secondary>
                            Zadnji run
                        </Typography>
                        {runs[0] ? (
                            <Row spacing={2}>
                                <RunStatusChip status={runs[0].status} />
                                <LocalDateTime>
                                    {runs[0].createdAt}
                                </LocalDateTime>
                            </Row>
                        ) : (
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                Nema izvođenja
                            </Typography>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <Stack spacing={4}>
                    <AutomationFlowEditor
                        automationId={definition.id}
                        initialKey={definition.key}
                        initialName={definition.name}
                        initialDescription={definition.description}
                        initialStatus={definition.status}
                        initialGraph={definition.graph}
                        modules={modules}
                    />
                </Stack>
                <AutomationTestPanel
                    automationId={definition.id}
                    triggerMode={triggerMode}
                    triggerEventType={triggerEventType}
                    recentEvents={recentAutomationEvents}
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Run log</CardTitle>
                </CardHeader>
                <CardOverflow>
                    <div className="overflow-auto">
                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Head>ID</Table.Head>
                                    <Table.Head>Status</Table.Head>
                                    <Table.Head>Izvor</Table.Head>
                                    <Table.Head>Event</Table.Head>
                                    <Table.Head>Trajanje</Table.Head>
                                    <Table.Head>Greška</Table.Head>
                                    <Table.Head>Vrijeme</Table.Head>
                                    <Table.Head>Detalji</Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {runsWithSteps.length === 0 ? (
                                    <Table.Row>
                                        <Table.Cell colSpan={8}>
                                            <NoDataPlaceholder>
                                                Automatizacija još nema runova.
                                            </NoDataPlaceholder>
                                        </Table.Cell>
                                    </Table.Row>
                                ) : null}
                                {runsWithSteps.map(({ run, steps }) => (
                                    <Table.Row key={run.id}>
                                        <Table.Cell>#{run.id}</Table.Cell>
                                        <Table.Cell>
                                            <Stack spacing={1}>
                                                <RunStatusChip
                                                    status={run.status}
                                                />
                                                {run.dryRun ? (
                                                    <Chip
                                                        size="sm"
                                                        color="info"
                                                        variant="soft"
                                                    >
                                                        Dry-run
                                                    </Chip>
                                                ) : null}
                                            </Stack>
                                        </Table.Cell>
                                        <Table.Cell>{run.source}</Table.Cell>
                                        <Table.Cell>
                                            <Stack spacing={1}>
                                                <Typography level="body3">
                                                    {run.sourceEventType ?? '-'}
                                                </Typography>
                                                <Typography
                                                    level="body3"
                                                    className="text-muted-foreground"
                                                >
                                                    {run.sourceAggregateId ??
                                                        '-'}
                                                </Typography>
                                            </Stack>
                                        </Table.Cell>
                                        <Table.Cell>
                                            {formatDuration(
                                                run.startedAt,
                                                run.completedAt,
                                            )}
                                        </Table.Cell>
                                        <Table.Cell>
                                            {run.errorMessage ? (
                                                <Typography
                                                    level="body3"
                                                    className="text-red-700 dark:text-red-300"
                                                >
                                                    {run.errorMessage}
                                                </Typography>
                                            ) : (
                                                '-'
                                            )}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <LocalDateTime>
                                                {run.createdAt}
                                            </LocalDateTime>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <details className="min-w-80">
                                                <summary className="cursor-pointer text-sm font-medium text-primary">
                                                    {steps.length} koraka
                                                </summary>
                                                <Stack
                                                    spacing={3}
                                                    className="pt-3"
                                                >
                                                    {run.status === 'failed' ? (
                                                        <ReplayAutomationRunButton
                                                            runId={run.id}
                                                        />
                                                    ) : null}
                                                    {steps.map((step) => (
                                                        <Card
                                                            key={step.id}
                                                            variant="secondary"
                                                        >
                                                            <CardContent>
                                                                <Stack
                                                                    spacing={2}
                                                                >
                                                                    <Row
                                                                        spacing={
                                                                            2
                                                                        }
                                                                        className="flex-wrap"
                                                                    >
                                                                        <Typography
                                                                            level="body2"
                                                                            semiBold
                                                                        >
                                                                            {
                                                                                step.nodeId
                                                                            }
                                                                        </Typography>
                                                                        <Chip
                                                                            size="sm"
                                                                            variant="soft"
                                                                        >
                                                                            {
                                                                                step.status
                                                                            }
                                                                        </Chip>
                                                                        <Chip
                                                                            size="sm"
                                                                            variant="soft"
                                                                        >
                                                                            {
                                                                                step.moduleKind
                                                                            }
                                                                        </Chip>
                                                                    </Row>
                                                                    <Typography
                                                                        level="body3"
                                                                        className="text-muted-foreground"
                                                                    >
                                                                        {
                                                                            step.moduleKey
                                                                        }
                                                                    </Typography>
                                                                    {step.errorMessage ? (
                                                                        <Typography
                                                                            level="body3"
                                                                            className="text-red-700 dark:text-red-300"
                                                                        >
                                                                            {
                                                                                step.errorMessage
                                                                            }
                                                                        </Typography>
                                                                    ) : null}
                                                                    <details>
                                                                        <summary className="cursor-pointer text-xs font-medium">
                                                                            Input
                                                                        </summary>
                                                                        <JsonPreview
                                                                            value={
                                                                                step.input
                                                                            }
                                                                        />
                                                                    </details>
                                                                    <details>
                                                                        <summary className="cursor-pointer text-xs font-medium">
                                                                            Output
                                                                        </summary>
                                                                        <JsonPreview
                                                                            value={
                                                                                step.output
                                                                            }
                                                                        />
                                                                    </details>
                                                                </Stack>
                                                            </CardContent>
                                                        </Card>
                                                    ))}
                                                </Stack>
                                            </details>
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table>
                    </div>
                </CardOverflow>
            </Card>
        </Stack>
    );
}
