'use server';

import { slugify } from '@gredice/js/slug';
import {
    type AutomationDefinitionStatus,
    type AutomationGraph,
    type AutomationJsonObject,
    type AutomationModuleKind,
    automationDefinitionStatusValues,
    automationModuleKeys,
    createAutomationDefinition,
    createAutomationRun,
    getAutomationDefinitionById,
    getAutomationDefinitionByKey,
    getAutomationRunById,
    getDomainEventById,
    listAutomationRunSteps,
    maxAutomationMaxConcurrentRuns,
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
    maxConcurrentRuns: number;
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

function normalizeMaxConcurrentRuns(value: unknown) {
    return typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 1 &&
        value <= maxAutomationMaxConcurrentRuns
        ? value
        : null;
}

function normalizeGraph(graph: AutomationGraph): AutomationGraph {
    return {
        nodes: graph.nodes.map((node) => {
            const kind = normalizeModuleKind(node.kind);
            if (!kind) {
                throw new Error(
                    `Nepodržana vrsta čvora automatizacije: ${node.kind}`,
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

function getTriggerModuleKey(graph: AutomationGraph) {
    return (
        graph.nodes.find((node) => node.kind === 'trigger')?.moduleKey ?? null
    );
}

function parseEventDataJson(value: string | undefined) {
    if (!value?.trim()) {
        return {};
    }

    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) {
        throw new Error('Podaci eventa moraju biti JSON objekt.');
    }

    return parsed;
}

function revalidateAutomationPages(automationId?: number) {
    revalidatePath(KnownPages.Automations);
    if (automationId) {
        revalidatePath(KnownPages.Automation(automationId));
    }
}

function automationKeyExistsMessage(key: string) {
    return `Ključ automatizacije "${key}" već postoji.`;
}

function isAutomationKeyUniqueConstraintError(error: unknown) {
    if (!isRecord(error)) {
        return false;
    }

    const candidate = isRecord(error.cause) ? error.cause : error;

    return (
        candidate.code === '23505' &&
        candidate.constraint === 'automation_definitions_key_idx'
    );
}

const requiredFieldLabels: Record<string, string> = {
    dayOfMonth: 'Dan u mjesecu',
    entityId: 'ID entiteta radnje',
    eventType: 'Tip eventa',
    minConfidence: 'Minimalna pouzdanost',
    operator: 'Operator',
    operations: 'Radnje',
    path: 'Putanja podataka',
    status: 'Status',
    targetSowingLocation: 'Ciljana lokacija sijanja',
    targetStatus: 'Ciljani status',
    timeZone: 'Vremenska zona',
};

function localizeAutomationValidationError(error: string) {
    if (error === 'Every node must have an id.') {
        return 'Svaki čvor mora imati ID.';
    }
    if (error === 'Automation graph must have exactly one trigger.') {
        return 'Graf automatizacije mora imati točno jedan okidač.';
    }
    if (error === 'Trigger node cannot have incoming edges.') {
        return 'Okidač ne može imati ulazne veze.';
    }
    if (error === 'Automation graph must include at least one action.') {
        return 'Graf automatizacije mora imati barem jednu akciju.';
    }
    if (error === 'dayOfMonth must be an integer from 1 to 31.') {
        return 'Dan u mjesecu mora biti cijeli broj od 1 do 31.';
    }
    if (error === 'timeZone must be a valid IANA time zone.') {
        return 'Vremenska zona mora biti valjana IANA vremenska zona.';
    }
    if (error === 'operations must be a non-empty JSON array.') {
        return 'Radnje moraju biti neprazan JSON niz.';
    }
    if (
        error ===
        'Each operation must include a positive integer entityId. Optional fields: entityTypeName, integer scheduledInDays.'
    ) {
        return 'Svaka radnja mora imati pozitivan cijeli broj entityId. Neobavezna polja su entityTypeName i scheduledInDays.';
    }
    if (error === 'minConfidence must be a number from 0 to 1.') {
        return 'Minimalna pouzdanost mora biti broj od 0 do 1.';
    }
    if (
        error ===
        'At least one of targetStatus or targetSowingLocation is required.'
    ) {
        return 'Unesite ciljani status ili ciljanu lokaciju sijanja.';
    }
    if (error === 'targetSowingLocation must be direct or greenhouse.') {
        return 'Ciljana lokacija sijanja mora biti direct ili greenhouse.';
    }

    const requiredMatch = /^(.+) is required\.$/.exec(error);
    if (requiredMatch) {
        const key = requiredMatch[1] ?? '';
        return `${requiredFieldLabels[key] ?? key} je obavezan.`;
    }

    const duplicateMatch = /^Duplicate node id: (.+)\.$/.exec(error);
    if (duplicateMatch) {
        return `Dupli ID čvora: ${duplicateMatch[1]}.`;
    }

    const unknownModuleMatch = /^Unknown automation module: (.+)\.$/.exec(
        error,
    );
    if (unknownModuleMatch) {
        return `Nepoznat modul automatizacije: ${unknownModuleMatch[1]}.`;
    }

    const wrongKindMatch = /^Module (.+) is a (.+), not a (.+)\.$/.exec(error);
    if (wrongKindMatch) {
        return `Modul ${wrongKindMatch[1]} je tipa ${wrongKindMatch[2]}, a ne ${wrongKindMatch[3]}.`;
    }

    const missingSourceMatch = /^Edge (.+) has missing source (.+)\.$/.exec(
        error,
    );
    if (missingSourceMatch) {
        return `Veza ${missingSourceMatch[1]} nema izvor ${missingSourceMatch[2]}.`;
    }

    const missingTargetMatch = /^Edge (.+) has missing target (.+)\.$/.exec(
        error,
    );
    if (missingTargetMatch) {
        return `Veza ${missingTargetMatch[1]} nema odredište ${missingTargetMatch[2]}.`;
    }

    const missingReachableMatch = /^Reachable node (.+) is missing\.$/.exec(
        error,
    );
    if (missingReachableMatch) {
        return `Dohvatljiv čvor ${missingReachableMatch[1]} nedostaje.`;
    }

    const pointsToMissingMatch =
        /^Edge (.+) points to missing node (.+)\.$/.exec(error);
    if (pointsToMissingMatch) {
        return `Veza ${pointsToMissingMatch[1]} pokazuje na čvor koji nedostaje: ${pointsToMissingMatch[2]}.`;
    }

    const unreachableActionMatch =
        /^Action node (.+) is not reachable from the trigger\.$/.exec(error);
    if (unreachableActionMatch) {
        return `Akcijski čvor ${unreachableActionMatch[1]} nije dohvatljiv iz okidača.`;
    }

    return error;
}

function localizeAutomationValidationErrors(errors: string[]) {
    return errors.map(localizeAutomationValidationError);
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
    const maxConcurrentRuns = normalizeMaxConcurrentRuns(
        payload.maxConcurrentRuns,
    );

    if (!key) {
        errors.push('Ključ automatizacije je obavezan.');
    }
    if (!name) {
        errors.push('Naziv automatizacije je obavezan.');
    }
    if (!status) {
        errors.push('Status automatizacije nije valjan.');
    }
    if (!maxConcurrentRuns) {
        errors.push(
            `Paralelna izvođenja moraju biti između 1 i ${maxAutomationMaxConcurrentRuns}.`,
        );
    }

    const validation = validateAutomationGraph(graph);
    if (!validation.ok) {
        errors.push(...localizeAutomationValidationErrors(validation.errors));
    }

    if (errors.length > 0 || !status || !maxConcurrentRuns) {
        return { ok: false, errors };
    }

    const existingDefinition = await getAutomationDefinitionByKey(key);
    if (
        existingDefinition &&
        (!payload.id || existingDefinition.id !== payload.id)
    ) {
        return {
            ok: false,
            errors: [automationKeyExistsMessage(key)],
        };
    }

    const input = {
        key,
        name,
        description: payload.description?.trim() || null,
        status,
        maxConcurrentRuns,
        graph,
        updatedByUserId: userId,
    };

    let definition: Awaited<ReturnType<typeof updateAutomationDefinition>>;
    try {
        definition = payload.id
            ? await updateAutomationDefinition(payload.id, input)
            : await createAutomationDefinition({
                  ...input,
                  createdByUserId: userId,
              });
    } catch (error) {
        if (isAutomationKeyUniqueConstraintError(error)) {
            return {
                ok: false,
                errors: [automationKeyExistsMessage(key)],
            };
        }

        throw error;
    }

    if (!definition) {
        return {
            ok: false,
            errors: ['Definicija automatizacije nije pronađena.'],
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
        return {
            ok: false,
            errors: ['Definicija automatizacije nije pronađena.'],
        };
    }

    if (status === 'enabled') {
        const validation = validateAutomationGraph(definition.graph);
        if (!validation.ok) {
            return {
                ok: false,
                errors: localizeAutomationValidationErrors(validation.errors),
            };
        }
    }

    const updated = await updateAutomationDefinition(automationId, {
        status,
        updatedByUserId: userId,
    });

    if (!updated) {
        return {
            ok: false,
            errors: ['Definicija automatizacije nije pronađena.'],
        };
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
        return {
            ok: false,
            errors: ['Definicija automatizacije nije pronađena.'],
        };
    }

    const validation = validateAutomationGraph(definition.graph);
    if (!validation.ok) {
        return {
            ok: false,
            errors: localizeAutomationValidationErrors(validation.errors),
        };
    }

    const triggerModuleKey = getTriggerModuleKey(definition.graph);
    const eventType = getTriggerEventType(definition.graph);
    const isDomainEventTrigger =
        triggerModuleKey === automationModuleKeys.triggerDomainEvent;
    const isMonthlyScheduleTrigger =
        triggerModuleKey === automationModuleKeys.triggerScheduleMonthly;

    if (isDomainEventTrigger && !eventType) {
        return {
            ok: false,
            errors: ['Okidač automatizacije nema tip eventa.'],
        };
    }

    try {
        const sourceEvent =
            isDomainEventTrigger && payload.eventId
                ? await getDomainEventById(payload.eventId)
                : null;

        if (isDomainEventTrigger && payload.eventId && !sourceEvent) {
            return { ok: false, errors: ['Izvorni event nije pronađen.'] };
        }

        let input: AutomationJsonObject;
        let sourceEventType: string | null = eventType;
        let sourceAggregateId: string | null = null;

        if (isMonthlyScheduleTrigger) {
            const now = new Date();
            const trigger = definition.graph.nodes.find(
                (node) => node.kind === 'trigger',
            );
            const dayOfMonth = trigger?.config.dayOfMonth;
            const timeZone = trigger?.config.timeZone;
            const occurrenceKey = `test:${definition.id}:${now.getTime()}`;

            sourceEventType = 'automation.schedule.monthly';
            sourceAggregateId = occurrenceKey;
            input = {
                scheduleType: 'monthly',
                triggerModuleKey: automationModuleKeys.triggerScheduleMonthly,
                occurrenceKey,
                period: now.toISOString().slice(0, 7),
                occurrenceDate: now.toISOString().slice(0, 10),
                dayOfMonth: typeof dayOfMonth === 'number' ? dayOfMonth : null,
                timeZone:
                    typeof timeZone === 'string' && timeZone.trim().length > 0
                        ? timeZone.trim()
                        : 'Europe/Zagreb',
                enqueuedAt: now.toISOString(),
            };
        } else if (isDomainEventTrigger) {
            input = sourceEvent
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
            sourceAggregateId =
                typeof input.aggregateId === 'string'
                    ? input.aggregateId
                    : null;
        } else {
            return {
                ok: false,
                errors: ['Ovaj tip okidača još se ne može testirati.'],
            };
        }

        const run = await createAutomationRun({
            automationDefinition: definition,
            source: 'test',
            sourceEvent,
            sourceEventType,
            sourceAggregateId,
            input,
            dryRun: payload.dryRun,
            manualRequestedByUserId: userId,
        });

        if (!run) {
            return {
                ok: false,
                errors: ['Testno izvođenje automatizacije nije kreirano.'],
            };
        }

        revalidateAutomationPages(definition.id);
        return { ok: true, runId: run.id, status: run.status };
    } catch (error) {
        return {
            ok: false,
            errors: [
                error instanceof Error
                    ? error.message
                    : 'Nepoznata greška testiranja.',
            ],
        };
    }
}

async function runAutomationRunAgain({
    runId,
    dryRun,
    actionName,
}: {
    runId: number;
    dryRun: boolean;
    actionName: 'replay' | 'retry';
}): Promise<AutomationRunActionResult> {
    const { userId } = await auth(['admin']);
    const originalRun = await getAutomationRunById(runId);
    if (!originalRun) {
        return {
            ok: false,
            errors: ['Izvođenje automatizacije nije pronađeno.'],
        };
    }

    if (actionName === 'retry' && originalRun.status !== 'failed') {
        return {
            ok: false,
            errors: ['Samo neuspjela izvođenja mogu se ponovno pokrenuti.'],
        };
    }

    const definition = await getAutomationDefinitionById(
        originalRun.automationDefinitionId,
    );
    if (!definition) {
        return {
            ok: false,
            errors: ['Definicija automatizacije nije pronađena.'],
        };
    }

    const sourceEvent = originalRun.sourceEventId
        ? await getDomainEventById(originalRun.sourceEventId)
        : null;
    const run = await createAutomationRun({
        automationDefinition: definition,
        source: dryRun ? 'replay' : 'manual',
        sourceEvent,
        sourceEventType: originalRun.sourceEventType,
        sourceAggregateId:
            originalRun.sourceEventType === 'automation.schedule.monthly'
                ? null
                : originalRun.sourceAggregateId,
        parentRunId: originalRun.id,
        input: originalRun.input,
        dryRun,
        manualRequestedByUserId: userId,
    });

    if (!run) {
        const actionLabel =
            actionName === 'replay'
                ? 'probno ponavljanje'
                : 'ponovno pokretanje';
        return {
            ok: false,
            errors: [`${actionLabel} nije kreirano.`],
        };
    }

    revalidateAutomationPages(definition.id);
    return { ok: true, runId: run.id, status: run.status };
}

export async function replayAutomationRunAction(
    runId: number,
): Promise<AutomationRunActionResult> {
    return runAutomationRunAgain({
        runId,
        dryRun: true,
        actionName: 'replay',
    });
}

export async function retryAutomationRunAction(
    runId: number,
): Promise<AutomationRunActionResult> {
    return runAutomationRunAgain({
        runId,
        dryRun: false,
        actionName: 'retry',
    });
}

export async function getAutomationRunStepsAction(runId: number) {
    await auth(['admin']);
    return listAutomationRunSteps(runId);
}
