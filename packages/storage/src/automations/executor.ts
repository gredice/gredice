import {
    completeAutomationRun,
    getDomainEventById,
    recordAutomationRunStep,
} from '../repositories/automationsRepo';
import type {
    AutomationGraph,
    AutomationGraphNode,
    AutomationJsonObject,
    SelectAutomationRun,
} from '../schema';
import { getAutomationModule, validateAutomationNodeConfig } from './modules';
import {
    type AutomationExecutionContext,
    type AutomationGraphValidationResult,
    AutomationModuleExecutionError,
    type AutomationModuleResult,
    type AutomationSourceEvent,
} from './types';

const maxErrorMessageLength = 1000;

function isRecord(value: unknown): value is AutomationJsonObject {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sourceEventFromInput(input: AutomationJsonObject) {
    const eventType = input.eventType;
    const aggregateId = input.aggregateId;
    if (typeof eventType !== 'string' || typeof aggregateId !== 'string') {
        return undefined;
    }

    return {
        id: typeof input.eventId === 'number' ? input.eventId : undefined,
        type: eventType,
        aggregateId,
        data: isRecord(input.data) ? input.data : {},
        createdAt:
            typeof input.createdAt === 'string'
                ? new Date(input.createdAt)
                : undefined,
    } satisfies AutomationSourceEvent;
}

function truncateErrorMessage(message: string) {
    return message.length > maxErrorMessageLength
        ? `${message.slice(0, maxErrorMessageLength)}...`
        : message;
}

function getNodeIncomingEdges(graph: AutomationGraph, nodeId: string) {
    return graph.edges.filter((edge) => edge.target === nodeId);
}

function getNodeOutgoingEdges(graph: AutomationGraph, nodeId: string) {
    return graph.edges.filter((edge) => edge.source === nodeId);
}

function orderReachableNodes(
    graph: AutomationGraph,
    triggerNode: AutomationGraphNode,
) {
    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const ordered: AutomationGraphNode[] = [];
    const errors: string[] = [];

    function visit(node: AutomationGraphNode) {
        if (visiting.has(node.id)) {
            errors.push(`Cycle detected at node ${node.id}.`);
            return;
        }
        if (visited.has(node.id)) {
            return;
        }

        visiting.add(node.id);
        visited.add(node.id);
        ordered.push(node);

        for (const edge of getNodeOutgoingEdges(graph, node.id)) {
            const target = nodesById.get(edge.target);
            if (!target) {
                errors.push(
                    `Edge ${edge.id} points to missing node ${edge.target}.`,
                );
                continue;
            }
            visit(target);
        }

        visiting.delete(node.id);
    }

    visit(triggerNode);

    return {
        ordered,
        reachableIds: visited,
        errors,
    };
}

export function validateAutomationGraph(
    graph: AutomationGraph,
): AutomationGraphValidationResult {
    const errors: string[] = [];
    const nodeIds = new Set<string>();

    for (const node of graph.nodes) {
        if (!node.id.trim()) {
            errors.push('Every node must have an id.');
        }
        if (nodeIds.has(node.id)) {
            errors.push(`Duplicate node id: ${node.id}.`);
        }
        nodeIds.add(node.id);

        errors.push(...validateAutomationNodeConfig(node));
    }

    for (const edge of graph.edges) {
        if (!nodeIds.has(edge.source)) {
            errors.push(`Edge ${edge.id} has missing source ${edge.source}.`);
        }
        if (!nodeIds.has(edge.target)) {
            errors.push(`Edge ${edge.id} has missing target ${edge.target}.`);
        }
    }

    const triggerNodes = graph.nodes.filter((node) => node.kind === 'trigger');
    if (triggerNodes.length !== 1) {
        errors.push('Automation graph must have exactly one trigger.');
    }

    const triggerNode = triggerNodes[0];
    if (!triggerNode) {
        return { ok: false, errors };
    }

    if (getNodeIncomingEdges(graph, triggerNode.id).length > 0) {
        errors.push('Trigger node cannot have incoming edges.');
    }

    const {
        ordered,
        reachableIds,
        errors: reachabilityErrors,
    } = orderReachableNodes(graph, triggerNode);
    errors.push(...reachabilityErrors);

    const unreachableActions = graph.nodes.filter(
        (node) => node.kind === 'action' && !reachableIds.has(node.id),
    );
    for (const node of unreachableActions) {
        errors.push(
            `Action node ${node.id} is not reachable from the trigger.`,
        );
    }

    if (!graph.nodes.some((node) => node.kind === 'action')) {
        errors.push('Automation graph must include at least one action.');
    }

    if (errors.length > 0) {
        return { ok: false, errors };
    }

    return { ok: true, orderedNodes: ordered };
}

async function getAutomationRunEvent(
    run: SelectAutomationRun,
): Promise<AutomationSourceEvent | undefined> {
    if (run.sourceEventId) {
        const event = await getDomainEventById(run.sourceEventId);
        if (event) {
            return {
                id: event.id,
                type: event.type,
                version: event.version,
                aggregateId: event.aggregateId,
                data: isRecord(event.data) ? event.data : {},
                createdAt: event.createdAt,
            };
        }
    }

    return sourceEventFromInput(run.input);
}

async function recordStepResult({
    run,
    node,
    status,
    input,
    output,
    errorCode,
    errorMessage,
    startedAt,
}: {
    run: SelectAutomationRun;
    node: AutomationGraphNode;
    status: 'succeeded' | 'skipped' | 'failed';
    input: AutomationJsonObject;
    output?: AutomationJsonObject;
    errorCode?: string | null;
    errorMessage?: string | null;
    startedAt: Date;
}) {
    await recordAutomationRunStep({
        runId: run.id,
        nodeId: node.id,
        moduleKey: node.moduleKey,
        moduleKind: node.kind,
        status,
        input,
        output: output ?? {},
        errorCode,
        errorMessage,
        startedAt,
        completedAt: new Date(),
    });
}

function shouldSkipForIncomingNode(
    graph: AutomationGraph,
    node: AutomationGraphNode,
    statusesByNodeId: Map<string, AutomationModuleResult['status']>,
) {
    return getNodeIncomingEdges(graph, node.id).some(
        (edge) => statusesByNodeId.get(edge.source) === 'skipped',
    );
}

export async function executeAutomationRun(run: SelectAutomationRun) {
    const graph = run.graphSnapshot;
    const validation = validateAutomationGraph(graph);
    if (!validation.ok) {
        await completeAutomationRun({
            id: run.id,
            status: 'failed',
            errorCode: 'invalid_graph',
            errorMessage: validation.errors.join(' '),
        });

        return {
            status: 'failed' as const,
            errorCode: 'invalid_graph',
            errorMessage: validation.errors.join(' '),
        };
    }

    const context: AutomationExecutionContext = {
        run,
        graph,
        dryRun: run.dryRun,
        event: await getAutomationRunEvent(run),
        values: new Map(),
    };
    const statusesByNodeId = new Map<
        string,
        AutomationModuleResult['status']
    >();
    let actionSucceeded = false;
    let skipped = false;

    for (const node of validation.orderedNodes) {
        const startedAt = new Date();
        const module = getAutomationModule(node.moduleKey);
        const stepInput = {
            config: node.config,
            event: context.event
                ? {
                      id: context.event.id ?? null,
                      type: context.event.type,
                      aggregateId: context.event.aggregateId,
                  }
                : null,
            dryRun: context.dryRun,
        };

        if (!module) {
            const message = `Unknown automation module ${node.moduleKey}.`;
            await recordStepResult({
                run,
                node,
                status: 'failed',
                input: stepInput,
                errorCode: 'unknown_module',
                errorMessage: message,
                startedAt,
            });
            await completeAutomationRun({
                id: run.id,
                status: 'failed',
                errorCode: 'unknown_module',
                errorMessage: message,
            });
            return {
                status: 'failed' as const,
                errorCode: 'unknown_module',
                errorMessage: message,
            };
        }

        if (shouldSkipForIncomingNode(graph, node, statusesByNodeId)) {
            skipped = true;
            statusesByNodeId.set(node.id, 'skipped');
            await recordStepResult({
                run,
                node,
                status: 'skipped',
                input: stepInput,
                output: { reason: 'Incoming dependency was skipped.' },
                startedAt,
            });
            continue;
        }

        try {
            const result = await module.execute(context, node);
            statusesByNodeId.set(node.id, result.status);
            context.values.set(node.id, result.output ?? {});
            if (result.status === 'skipped') {
                skipped = true;
            }
            if (node.kind === 'action' && result.status === 'succeeded') {
                actionSucceeded = true;
            }

            await recordStepResult({
                run,
                node,
                status: result.status,
                input: stepInput,
                output: result.output ?? {},
                startedAt,
            });
        } catch (error) {
            const retryable =
                error instanceof AutomationModuleExecutionError
                    ? error.retryable
                    : module.retryable;
            const errorCode =
                error instanceof AutomationModuleExecutionError
                    ? error.code
                    : 'module_execution_failed';
            const errorMessage = truncateErrorMessage(
                error instanceof Error ? error.message : 'Unknown error',
            );
            const retryAt =
                retryable && run.attempt < run.maxAttempts
                    ? new Date(
                          Date.now() + Math.min(run.attempt + 1, 5) * 60_000,
                      )
                    : null;

            await recordStepResult({
                run,
                node,
                status: 'failed',
                input: stepInput,
                errorCode,
                errorMessage,
                startedAt,
            });
            await completeAutomationRun({
                id: run.id,
                status: 'failed',
                errorCode,
                errorMessage,
                retryAt,
            });

            return {
                status: retryAt ? ('retrying' as const) : ('failed' as const),
                errorCode,
                errorMessage,
                retryAt,
            };
        }
    }

    const finalStatus = actionSucceeded
        ? 'succeeded'
        : skipped
          ? 'skipped'
          : 'succeeded';
    await completeAutomationRun({
        id: run.id,
        status: finalStatus,
        output: {
            actionSucceeded,
            skipped,
            dryRun: run.dryRun,
        },
    });

    return {
        status: finalStatus,
        actionSucceeded,
        skipped,
    };
}
