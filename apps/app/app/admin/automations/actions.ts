'use server';

import { slugify } from '@gredice/js/slug';
import {
    type AutomationDefinitionStatus,
    type AutomationGraph,
    type AutomationJsonObject,
    type AutomationModuleKind,
    automationDefinitionStatusValues,
    createAutomationDefinition,
    createAutomationRun,
    executeAutomationRun,
    getAutomationDefinitionById,
    getAutomationRunById,
    getDomainEventById,
    listAutomationRunSteps,
    startAutomationRun,
    updateAutomationDefinition,
    validateAutomationGraph,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';

export type AutomationSaveResult =
    | {
          ok: true;
          automationId: number;
      }
    | {
          ok: false;
          errors: string[];
      };

export type AutomationRunActionResult =
    | {
          ok: true;
          runId: number;
          status: string;
      }
    | {
          ok: false;
          errors: string[];
      };

export type SaveAutomationDefinitionPayload = {
    id?: number;
    key: string;
    name: string;
    description?: string | null;
    status: AutomationDefinitionStatus;
    graph: AutomationGraph;
};

export type RunAutomationTestPayload = {
    automationId: number;
    eventId?: number | null;
    aggregateId?: string;
    eventDataJson?: string;
    dryRun: boolean;
};

function isRecord(value: unknown): value is AutomationJsonObject {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStatus(status: unknown): AutomationDefinitionStatus | null {
    return (
        automationDefinitionStatusValues.find((value) => value === status) ??
        null
    );
}

function normalizeModuleKind(kind: unknown): AutomationModuleKind | null {
    if (
        kind === 'trigger' ||
        kind === 'filter' ||
        kind === 'condition' ||
        kind === 'action'
    ) {
        return kind;
    }

    return null;
}

function normalizeGraph(graph: AutomationGraph): AutomationGraph {
    return {
        nodes: graph.nodes.map((node) => {
            const kind = normalizeModuleKind(node.kind);
            if (!kind) {
                throw new Error(
                    `Unsupported automation node kind: ${node.kind}`,
                );
            }

            return {
                id: node.id.trim(),
                moduleKey: node.moduleKey.trim(),
                kind,
                position: {
                    x: Number.isFinite(node.position.x) ? node.position.x : 0,
                    y: Number.isFinite(node.position.y) ? node.position.y : 0,
                },
                config: isRecord(node.config) ? node.config : {},
            };
        }),
        edges: graph.edges.map((edge) => ({
            id: edge.id.trim(),
            source: edge.source.trim(),
            target: edge.target.trim(),
        })),
    };
}

function getTriggerEventType(graph: AutomationGraph) {
    const trigger = graph.nodes.find((node) => node.kind === 'trigger');
    const eventType = trigger?.config.eventType;

    return typeof eventType === 'string' && eventType.trim().length > 0
        ? eventType.trim()
        : null;
}

function parseEventDataJson(value: string | undefined) {
    if (!value?.trim()) {
        return {};
    }

    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) {
        throw new Error('Event data must be a JSON object.');
    }

    return parsed;
}

function revalidateAutomationPages(automationId?: number) {
    revalidatePath(KnownPages.Automations);
    if (automationId) {
        revalidatePath(KnownPages.Automation(automationId));
    }
}

export async function saveAutomationDefinitionAction(
    payload: SaveAutomationDefinitionPayload,
): Promise<AutomationSaveResult> {
    const { userId } = await auth(['admin']);
    const status = normalizeStatus(payload.status);
    const errors: string[] = [];
    const graph = normalizeGraph(payload.graph);
    const key = payload.key.trim() || slugify(payload.name);
    const name = payload.name.trim();

    if (!key) {
        errors.push('Automation key is required.');
    }
    if (!name) {
        errors.push('Automation name is required.');
    }
    if (!status) {
        errors.push('Automation status is invalid.');
    }

    const validation = validateAutomationGraph(graph);
    if (!validation.ok) {
        errors.push(...validation.errors);
    }

    if (errors.length > 0 || !status) {
        return { ok: false, errors };
    }

    const input = {
        key,
        name,
        description: payload.description?.trim() || null,
        status,
        graph,
        updatedByUserId: userId,
    };

    const definition = payload.id
        ? await updateAutomationDefinition(payload.id, input)
        : await createAutomationDefinition({
              ...input,
              createdByUserId: userId,
          });

    if (!definition) {
        return {
            ok: false,
            errors: ['Automation definition was not found.'],
        };
    }

    revalidateAutomationPages(definition.id);
    return { ok: true, automationId: definition.id };
}

export async function updateAutomationStatusAction(
    automationId: number,
    status: AutomationDefinitionStatus,
): Promise<AutomationSaveResult> {
    const { userId } = await auth(['admin']);
    const definition = await getAutomationDefinitionById(automationId);
    if (!definition) {
        return { ok: false, errors: ['Automation definition was not found.'] };
    }

    if (status === 'enabled') {
        const validation = validateAutomationGraph(definition.graph);
        if (!validation.ok) {
            return { ok: false, errors: validation.errors };
        }
    }

    const updated = await updateAutomationDefinition(automationId, {
        status,
        updatedByUserId: userId,
    });

    if (!updated) {
        return { ok: false, errors: ['Automation definition was not found.'] };
    }

    revalidateAutomationPages(automationId);
    return { ok: true, automationId };
}

export async function runAutomationTestAction(
    payload: RunAutomationTestPayload,
): Promise<AutomationRunActionResult> {
    const { userId } = await auth(['admin']);
    const definition = await getAutomationDefinitionById(payload.automationId);
    if (!definition) {
        return { ok: false, errors: ['Automation definition was not found.'] };
    }

    const validation = validateAutomationGraph(definition.graph);
    if (!validation.ok) {
        return { ok: false, errors: validation.errors };
    }

    const eventType = getTriggerEventType(definition.graph);
    if (!eventType) {
        return {
            ok: false,
            errors: ['Automation trigger event type is missing.'],
        };
    }

    try {
        const sourceEvent = payload.eventId
            ? await getDomainEventById(payload.eventId)
            : null;

        if (payload.eventId && !sourceEvent) {
            return { ok: false, errors: ['Source event was not found.'] };
        }

        const input = sourceEvent
            ? {
                  eventId: sourceEvent.id,
                  eventType: sourceEvent.type,
                  aggregateId: sourceEvent.aggregateId,
                  data: isRecord(sourceEvent.data) ? sourceEvent.data : {},
                  createdAt: sourceEvent.createdAt.toISOString(),
              }
            : {
                  eventType,
                  aggregateId: payload.aggregateId?.trim() || 'manual-test',
                  data: parseEventDataJson(payload.eventDataJson),
                  createdAt: new Date().toISOString(),
              };

        const run = await createAutomationRun({
            automationDefinition: definition,
            source: 'test',
            sourceEvent,
            input,
            dryRun: payload.dryRun,
            manualRequestedByUserId: userId,
        });

        if (!run) {
            return {
                ok: false,
                errors: ['Automation test run was not created.'],
            };
        }

        const started =
            (await startAutomationRun(run.id, {
                lockedBy: `app-admin-test:${userId}`,
            })) ?? run;
        const result = await executeAutomationRun(started);

        revalidateAutomationPages(definition.id);
        return { ok: true, runId: run.id, status: result.status };
    } catch (error) {
        return {
            ok: false,
            errors: [
                error instanceof Error ? error.message : 'Unknown test error.',
            ],
        };
    }
}

export async function replayAutomationRunAction(
    runId: number,
    dryRun = true,
): Promise<AutomationRunActionResult> {
    const { userId } = await auth(['admin']);
    const originalRun = await getAutomationRunById(runId);
    if (!originalRun) {
        return { ok: false, errors: ['Automation run was not found.'] };
    }

    const definition = await getAutomationDefinitionById(
        originalRun.automationDefinitionId,
    );
    if (!definition) {
        return { ok: false, errors: ['Automation definition was not found.'] };
    }

    const sourceEvent = originalRun.sourceEventId
        ? await getDomainEventById(originalRun.sourceEventId)
        : null;
    const run = await createAutomationRun({
        automationDefinition: definition,
        source: 'replay',
        sourceEvent,
        parentRunId: originalRun.id,
        input: originalRun.input,
        dryRun,
        manualRequestedByUserId: userId,
    });

    if (!run) {
        return {
            ok: false,
            errors: ['Automation replay run was not created.'],
        };
    }

    const started =
        (await startAutomationRun(run.id, {
            lockedBy: `app-admin-replay:${userId}`,
        })) ?? run;
    const result = await executeAutomationRun(started);

    revalidateAutomationPages(definition.id);
    return { ok: true, runId: run.id, status: result.status };
}

export async function getAutomationRunStepsAction(runId: number) {
    await auth(['admin']);
    return listAutomationRunSteps(runId);
}
