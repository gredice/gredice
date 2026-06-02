import {
    type AutomationGraph,
    type AutomationRunStatus,
    automationModuleKeys,
    automationRunStatusValues,
    getAutomationDefinitionById,
    getAutomationModuleMetadata,
    listAutomationRunSteps,
    listAutomationRuns,
    listRecentDomainEvents,
    maxAutomationMaxConcurrentRuns,
} from '@gredice/storage';
import { Stack } from '@gredice/ui/Stack';
import { notFound } from 'next/navigation';
import { AdminPageTitle } from '../../../../components/admin/navigation';
import { auth } from '../../../../lib/auth/auth';
import { AutomationFlowEditor } from '../AutomationFlowEditor';
import {
    type AutomationRunStatusFilter,
    AutomationRunsTable,
    type AutomationRunsTableRun,
} from '../AutomationRunsTable';
import {
    AutomationTestPanel,
    type RecentAutomationEvent,
} from '../AutomationTestPanel';

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

function firstSearchParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

function normalizeRunStatusFilter(
    value: string | undefined,
): AutomationRunStatusFilter {
    if (value === 'all') {
        return 'all';
    }

    const status = automationRunStatusValues.find(
        (candidate) => candidate === value,
    );

    return status ?? 'withoutSkipped';
}

function statusesForRunFilter(
    filter: AutomationRunStatusFilter,
): AutomationRunStatus | AutomationRunStatus[] | undefined {
    if (filter === 'all') {
        return undefined;
    }

    if (filter === 'withoutSkipped') {
        return automationRunStatusValues.filter(
            (status) => status !== 'skipped',
        );
    }

    return filter;
}

function dateToIso(value: Date | null) {
    return value ? value.toISOString() : null;
}

export default async function AutomationDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ automationId: string }>;
    searchParams?: Promise<{ runStatus?: string | string[] }>;
}) {
    await auth(['admin']);
    const { automationId } = await params;
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const id = Number(automationId);

    if (!Number.isInteger(id) || id <= 0) {
        notFound();
    }

    const definition = await getAutomationDefinitionById(id);
    if (!definition) {
        notFound();
    }

    const modules = getAutomationModuleMetadata();
    const triggerEventType = getTriggerEventType(definition.graph);
    const triggerModuleKey = getTriggerModuleKey(definition.graph);
    const triggerMode =
        triggerModuleKey === automationModuleKeys.triggerDomainEvent
            ? 'domainEvent'
            : triggerModuleKey === automationModuleKeys.triggerScheduleMonthly
              ? 'schedule'
              : 'unsupported';
    const currentRunStatusFilter = normalizeRunStatusFilter(
        firstSearchParam(resolvedSearchParams.runStatus),
    );
    const runStatusFilter = statusesForRunFilter(currentRunStatusFilter);
    const [runs, recentEvents] = await Promise.all([
        listAutomationRuns({
            automationDefinitionId: definition.id,
            status: runStatusFilter,
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
    const tableRuns: AutomationRunsTableRun[] = runsWithSteps.map(
        ({ run, steps }) => ({
            run: {
                id: run.id,
                status: run.status,
                dryRun: run.dryRun,
                attempt: run.attempt,
                maxAttempts: run.maxAttempts,
                sourceEventType: run.sourceEventType,
                sourceAggregateId: run.sourceAggregateId,
                input: run.input,
                output: run.output,
                errorMessage: run.errorMessage,
                startedAt: dateToIso(run.startedAt),
                completedAt: dateToIso(run.completedAt),
                createdAt: run.createdAt.toISOString(),
            },
            steps: steps.map((step) => ({
                id: step.id,
                nodeId: step.nodeId,
                moduleKey: step.moduleKey,
                moduleKind: step.moduleKind,
                status: step.status,
                input: step.input,
                output: step.output,
                errorMessage: step.errorMessage,
                startedAt: dateToIso(step.startedAt),
                completedAt: dateToIso(step.completedAt),
                createdAt: step.createdAt.toISOString(),
            })),
        }),
    );
    const recentAutomationEvents: RecentAutomationEvent[] = recentEvents.map(
        (event) => ({
            id: event.id,
            type: event.type,
            aggregateId: event.aggregateId,
            createdAt: event.createdAt.toISOString(),
        }),
    );

    return (
        <Stack spacing={5}>
            <AdminPageTitle title={definition.name} />
            <AutomationFlowEditor
                automationId={definition.id}
                initialKey={definition.key}
                initialName={definition.name}
                initialDescription={definition.description}
                initialStatus={definition.status}
                initialMaxConcurrentRuns={definition.maxConcurrentRuns}
                maxConcurrentRunsLimit={maxAutomationMaxConcurrentRuns}
                initialGraph={definition.graph}
                modules={modules}
                testPanel={
                    <AutomationTestPanel
                        automationId={definition.id}
                        triggerMode={triggerMode}
                        triggerEventType={triggerEventType}
                        recentEvents={recentAutomationEvents}
                    />
                }
            />

            <AutomationRunsTable
                currentStatusFilter={currentRunStatusFilter}
                runs={tableRuns}
                statusOptions={[...automationRunStatusValues]}
            />
        </Stack>
    );
}
