import type { EntityStandardized } from '../@types/EntityStandardized';
import { getEntityFormatted } from '../repositories/entitiesRepo';
import {
    buildRaisedBedFieldPlantUpdatePayload,
    createEvent,
    knownEvents,
    knownEventTypes,
} from '../repositories/events';
import { getRaisedBed } from '../repositories/gardensRepo';
import {
    createOperation,
    getOperationById,
} from '../repositories/operationsRepo';
import { queueSeasonalSowingOfferOperations } from '../repositories/seasonalOffersRepo';
import type { AutomationGraphNode, AutomationJsonObject } from '../schema';
import {
    type AutomationModule,
    AutomationModuleExecutionError,
    type AutomationModuleMetadata,
    type AutomationModuleResult,
} from './types';

const domainEventTriggerKey = 'trigger.domainEvent';
const eventDataEqualsConditionKey = 'condition.eventDataEquals';
const operationMatchesConditionKey = 'condition.operationMatches';
const plantStatusEqualsConditionKey = 'condition.plantStatusEquals';
const queueSeasonalSowingOfferOperationsActionKey =
    'action.queueSeasonalSowingOfferOperations';
const createOperationActionKey = 'action.createOperation';
const updateRaisedBedFieldPlantStatusActionKey =
    'action.updateRaisedBedFieldPlantStatus';
const logActionKey = 'action.log';

export const automationModuleKeys = {
    triggerDomainEvent: domainEventTriggerKey,
    conditionEventDataEquals: eventDataEqualsConditionKey,
    conditionOperationMatches: operationMatchesConditionKey,
    conditionPlantStatusEquals: plantStatusEqualsConditionKey,
    actionQueueSeasonalSowingOfferOperations:
        queueSeasonalSowingOfferOperationsActionKey,
    actionCreateOperation: createOperationActionKey,
    actionUpdateRaisedBedFieldPlantStatus:
        updateRaisedBedFieldPlantStatusActionKey,
    actionLog: logActionKey,
} as const;

function getRecord(value: unknown): AutomationJsonObject {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as AutomationJsonObject)
        : {};
}

function getString(config: AutomationJsonObject, key: string) {
    const value = config[key];
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
}

function getNumber(config: AutomationJsonObject, key: string) {
    const value = config[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}

function requiredString(config: AutomationJsonObject, key: string) {
    const value = getString(config, key);
    return value ? [] : [`${key} is required.`];
}

function readPath(source: AutomationJsonObject, path: string): unknown {
    return path.split('.').reduce<unknown>((current, segment) => {
        if (!segment || !current || typeof current !== 'object') {
            return undefined;
        }

        return Reflect.get(current, segment);
    }, source);
}

function compareValue(left: unknown, operator: string, right: string) {
    if (operator === 'exists') {
        return left !== undefined && left !== null;
    }

    if (operator === 'notExists') {
        return left === undefined || left === null;
    }

    const leftText =
        typeof left === 'string' || typeof left === 'number'
            ? left.toString()
            : typeof left === 'boolean'
              ? left
                  ? 'true'
                  : 'false'
              : undefined;

    if (operator === 'notEquals') {
        return leftText !== right;
    }

    return leftText === right;
}

function skip(reason: string, output: AutomationJsonObject = {}) {
    return {
        status: 'skipped',
        reason,
        output: {
            reason,
            ...output,
        },
    } satisfies AutomationModuleResult;
}

function success(output: AutomationJsonObject = {}) {
    return {
        status: 'succeeded',
        output,
    } satisfies AutomationModuleResult;
}

function parseRaisedBedFieldAggregateId(aggregateId: string) {
    const [raisedBedIdRaw, positionIndexRaw] = aggregateId.split('|');
    const raisedBedId = Number(raisedBedIdRaw);
    const positionIndex = Number(positionIndexRaw);

    if (
        !Number.isInteger(raisedBedId) ||
        raisedBedId <= 0 ||
        !Number.isInteger(positionIndex) ||
        positionIndex < 0
    ) {
        return null;
    }

    return { raisedBedId, positionIndex };
}

function configFieldsForEventType() {
    return [
        {
            key: 'eventType',
            label: 'Event type',
            type: 'string',
            required: true,
            placeholder: knownEventTypes.raisedBedFields.plantUpdate,
        },
    ] satisfies AutomationModuleMetadata['configFields'];
}

const triggerDomainEventModule: AutomationModule = {
    key: domainEventTriggerKey,
    kind: 'trigger',
    title: 'Domain event',
    description: 'Starts an automation from a stored Gredice domain event.',
    category: 'Events',
    configFields: configFieldsForEventType(),
    inputDescription: 'A row from the `events` table.',
    outputDescription: 'The event id, type, aggregate id, and event data.',
    dryRunSupported: true,
    mutatesData: false,
    retryable: false,
    validateConfig: (config) => requiredString(config, 'eventType'),
    execute: async (context, node) => {
        const eventType = getString(node.config, 'eventType');
        if (!context.event) {
            throw new AutomationModuleExecutionError(
                'Automation run is missing a source event.',
                'missing_source_event',
            );
        }

        if (eventType && context.event.type !== eventType) {
            return skip('Source event type did not match trigger config.', {
                expected: eventType,
                actual: context.event.type,
            });
        }

        return success({
            eventId: context.event.id ?? null,
            eventType: context.event.type,
            aggregateId: context.event.aggregateId,
            data: context.event.data,
        });
    },
};

const eventDataEqualsConditionModule: AutomationModule = {
    key: eventDataEqualsConditionKey,
    kind: 'condition',
    title: 'Event data comparison',
    description: 'Checks a value in the event payload before continuing.',
    category: 'Event filters',
    configFields: [
        {
            key: 'path',
            label: 'Data path',
            type: 'string',
            required: true,
            placeholder: 'status',
        },
        {
            key: 'operator',
            label: 'Operator',
            type: 'select',
            required: true,
            options: [
                { value: 'equals', label: 'Equals' },
                { value: 'notEquals', label: 'Does not equal' },
                { value: 'exists', label: 'Exists' },
                { value: 'notExists', label: 'Does not exist' },
            ],
        },
        {
            key: 'value',
            label: 'Value',
            type: 'string',
            required: false,
            placeholder: 'sowed',
        },
    ],
    dryRunSupported: true,
    mutatesData: false,
    retryable: false,
    validateConfig: (config) => [
        ...requiredString(config, 'path'),
        ...requiredString(config, 'operator'),
    ],
    execute: async (context, node) => {
        if (!context.event) {
            return skip('No source event is available.');
        }

        const path = getString(node.config, 'path') ?? '';
        const operator = getString(node.config, 'operator') ?? 'equals';
        const expected = getString(node.config, 'value') ?? '';
        const actual = readPath(context.event.data, path);
        const matched = compareValue(actual, operator, expected);

        if (!matched) {
            return skip('Event data condition did not match.', {
                path,
                operator,
                expected,
                actual:
                    typeof actual === 'string' ||
                    typeof actual === 'number' ||
                    typeof actual === 'boolean'
                        ? actual
                        : null,
            });
        }

        return success({ path, operator, matched: true });
    },
};

const operationMatchesConditionModule: AutomationModule = {
    key: operationMatchesConditionKey,
    kind: 'condition',
    title: 'Operation matches',
    description:
        'Checks operation state or operation directory metadata for operation events.',
    category: 'Operations',
    configFields: [
        {
            key: 'status',
            label: 'Operation status',
            type: 'string',
            placeholder: 'completed',
        },
        {
            key: 'entityId',
            label: 'Operation entity ID',
            type: 'number',
        },
        {
            key: 'application',
            label: 'Operation application',
            type: 'string',
            placeholder: 'plant',
        },
    ],
    dryRunSupported: true,
    mutatesData: false,
    retryable: false,
    execute: async (context, node) => {
        if (!context.event) {
            return skip('No source event is available.');
        }

        const operationId = Number(context.event.aggregateId);
        if (!Number.isInteger(operationId) || operationId <= 0) {
            return skip('Source event aggregate is not an operation id.');
        }

        const operation = await getOperationById(operationId);
        if (!operation) {
            return skip('Operation was not found.', { operationId });
        }

        const expectedStatus = getString(node.config, 'status');
        if (expectedStatus && operation.status !== expectedStatus) {
            return skip('Operation status did not match.', {
                expected: expectedStatus,
                actual: operation.status,
            });
        }

        const expectedEntityId = getNumber(node.config, 'entityId');
        if (expectedEntityId && operation.entityId !== expectedEntityId) {
            return skip('Operation entity id did not match.', {
                expected: expectedEntityId,
                actual: operation.entityId,
            });
        }

        const expectedApplication = getString(node.config, 'application');
        if (expectedApplication) {
            const operationEntity =
                await getEntityFormatted<EntityStandardized>(
                    operation.entityId,
                );
            const actualApplication =
                typeof operationEntity?.attributes?.application === 'string'
                    ? operationEntity.attributes.application
                    : null;

            if (actualApplication !== expectedApplication) {
                return skip('Operation application did not match.', {
                    expected: expectedApplication,
                    actual: actualApplication,
                });
            }
        }

        return success({
            operationId,
            operationStatus: operation.status,
            entityId: operation.entityId,
            raisedBedId: operation.raisedBedId,
            raisedBedFieldId: operation.raisedBedFieldId,
        });
    },
};

const plantStatusEqualsConditionModule: AutomationModule = {
    key: plantStatusEqualsConditionKey,
    kind: 'condition',
    title: 'Plant status comparison',
    description: 'Checks the current raised-bed field plant status.',
    category: 'Raised-bed fields',
    configFields: [
        {
            key: 'status',
            label: 'Plant status',
            type: 'string',
            required: true,
            placeholder: 'sowed',
        },
    ],
    dryRunSupported: true,
    mutatesData: false,
    retryable: false,
    validateConfig: (config) => requiredString(config, 'status'),
    execute: async (context, node) => {
        if (!context.event) {
            return skip('No source event is available.');
        }

        const expectedStatus = getString(node.config, 'status');
        if (!expectedStatus) {
            throw new AutomationModuleExecutionError(
                'Plant status condition is missing status config.',
                'invalid_config',
            );
        }

        const parsed = parseRaisedBedFieldAggregateId(
            context.event.aggregateId,
        );
        if (!parsed) {
            return skip(
                'Source event aggregate is not a raised-bed field aggregate.',
            );
        }

        const raisedBed = await getRaisedBed(parsed.raisedBedId);
        const field = raisedBed?.fields.find(
            (candidate) =>
                candidate.positionIndex === parsed.positionIndex &&
                candidate.active,
        );
        const actualStatus = field?.plantStatus ?? null;

        if (actualStatus !== expectedStatus) {
            return skip('Plant status did not match.', {
                expected: expectedStatus,
                actual: actualStatus,
            });
        }

        return success({
            raisedBedId: parsed.raisedBedId,
            positionIndex: parsed.positionIndex,
            plantStatus: actualStatus,
        });
    },
};

const queueSeasonalSowingOfferOperationsActionModule: AutomationModule = {
    key: queueSeasonalSowingOfferOperationsActionKey,
    kind: 'action',
    title: 'Queue seasonal watering operations',
    description:
        'Queues the current seasonal free watering offer after a field is sowed.',
    category: 'Operations',
    configFields: [],
    inputDescription:
        'A `raisedBedField.plantUpdate` event with aggregate id `raisedBedId|positionIndex`.',
    outputDescription: 'Created operation ids, or a skip reason.',
    dryRunSupported: true,
    mutatesData: true,
    retryable: true,
    execute: async (context) => {
        if (!context.event) {
            return skip('No source event is available.');
        }

        const parsed = parseRaisedBedFieldAggregateId(
            context.event.aggregateId,
        );
        if (!parsed) {
            return skip(
                'Source event aggregate is not a raised-bed field aggregate.',
            );
        }

        const raisedBed = await getRaisedBed(parsed.raisedBedId);
        if (!raisedBed?.accountId) {
            return skip('Raised bed or account was not found.', {
                raisedBedId: parsed.raisedBedId,
            });
        }

        if (context.dryRun) {
            return success({
                dryRun: true,
                accountId: raisedBed.accountId,
                gardenId: raisedBed.gardenId,
                raisedBedId: raisedBed.id,
            });
        }

        const createdOperationIds = await queueSeasonalSowingOfferOperations({
            accountId: raisedBed.accountId,
            ...(raisedBed.gardenId ? { gardenId: raisedBed.gardenId } : {}),
            raisedBedId: raisedBed.id,
            referenceDate: context.event.createdAt ?? new Date(),
        });

        if (createdOperationIds.length === 0) {
            return skip('No seasonal watering operations were queued.', {
                accountId: raisedBed.accountId,
                raisedBedId: raisedBed.id,
            });
        }

        return success({
            createdOperationIds,
            createdCount: createdOperationIds.length,
        });
    },
};

const createOperationActionModule: AutomationModule = {
    key: createOperationActionKey,
    kind: 'action',
    title: 'Create operation',
    description: 'Creates a Gredice operation for the current event context.',
    category: 'Operations',
    configFields: [
        {
            key: 'entityId',
            label: 'Operation entity ID',
            type: 'number',
            required: true,
        },
        {
            key: 'entityTypeName',
            label: 'Entity type',
            type: 'string',
            placeholder: 'operation',
        },
        {
            key: 'scheduledInDays',
            label: 'Schedule after days',
            type: 'number',
        },
    ],
    dryRunSupported: true,
    mutatesData: true,
    retryable: true,
    validateConfig: (config) =>
        getNumber(config, 'entityId') ? [] : ['entityId is required.'],
    execute: async (context, node) => {
        const entityId = getNumber(node.config, 'entityId');
        if (!entityId) {
            throw new AutomationModuleExecutionError(
                'Create operation action is missing entityId.',
                'invalid_config',
            );
        }

        const event = context.event;
        let accountId: string | undefined;
        let gardenId: number | undefined;
        let raisedBedId: number | undefined;
        let raisedBedFieldId: number | undefined;

        if (event?.type.startsWith('operation.')) {
            const operation = await getOperationById(Number(event.aggregateId));
            accountId = operation?.accountId ?? undefined;
            gardenId = operation?.gardenId ?? undefined;
            raisedBedId = operation?.raisedBedId ?? undefined;
            raisedBedFieldId = operation?.raisedBedFieldId ?? undefined;
        } else if (event?.aggregateId) {
            const parsed = parseRaisedBedFieldAggregateId(event.aggregateId);
            if (parsed) {
                const raisedBed = await getRaisedBed(parsed.raisedBedId);
                const field = raisedBed?.fields.find(
                    (candidate) =>
                        candidate.positionIndex === parsed.positionIndex &&
                        candidate.active,
                );
                accountId = raisedBed?.accountId ?? undefined;
                gardenId = raisedBed?.gardenId ?? undefined;
                raisedBedId = raisedBed?.id;
                raisedBedFieldId = field?.id;
            }
        }

        if (!accountId && !raisedBedId) {
            return skip('No operation target could be resolved.');
        }

        const scheduledInDays = getNumber(node.config, 'scheduledInDays');
        const scheduledDate =
            scheduledInDays === undefined
                ? undefined
                : new Date(
                      (event?.createdAt ?? new Date()).getTime() +
                          scheduledInDays * 24 * 60 * 60 * 1000,
                  );

        if (context.dryRun) {
            return success({
                dryRun: true,
                entityId,
                accountId,
                gardenId,
                raisedBedId,
                raisedBedFieldId,
                scheduledDate: scheduledDate?.toISOString() ?? null,
            });
        }

        const operationId = await createOperation({
            entityId,
            entityTypeName:
                getString(node.config, 'entityTypeName') ?? 'operation',
            accountId,
            gardenId,
            raisedBedId,
            raisedBedFieldId,
        });

        if (scheduledDate) {
            await createEvent(
                knownEvents.operations.scheduledV1(operationId.toString(), {
                    scheduledDate: scheduledDate.toISOString(),
                }),
            );
        }

        return success({
            operationId,
            scheduledDate: scheduledDate?.toISOString() ?? null,
        });
    },
};

const updateRaisedBedFieldPlantStatusActionModule: AutomationModule = {
    key: updateRaisedBedFieldPlantStatusActionKey,
    kind: 'action',
    title: 'Update plant status',
    description:
        'Writes a raised-bed field plant status update for the operation target.',
    category: 'Raised-bed fields',
    configFields: [
        {
            key: 'targetStatus',
            label: 'Target status',
            type: 'string',
            required: true,
            placeholder: 'sprouted',
        },
    ],
    dryRunSupported: true,
    mutatesData: true,
    retryable: true,
    validateConfig: (config) => requiredString(config, 'targetStatus'),
    execute: async (context, node) => {
        if (!context.event) {
            return skip('No source event is available.');
        }

        const targetStatus = getString(node.config, 'targetStatus');
        if (!targetStatus) {
            throw new AutomationModuleExecutionError(
                'Plant status action is missing targetStatus.',
                'invalid_config',
            );
        }

        const operationId = Number(context.event.aggregateId);
        if (!Number.isInteger(operationId) || operationId <= 0) {
            return skip('Source event aggregate is not an operation id.');
        }

        const operation = await getOperationById(operationId);
        if (!operation?.raisedBedId || !operation.raisedBedFieldId) {
            return skip('Operation has no raised-bed field target.', {
                operationId,
            });
        }

        const raisedBed = await getRaisedBed(operation.raisedBedId);
        const field = raisedBed?.fields.find(
            (candidate) => candidate.id === operation.raisedBedFieldId,
        );
        if (!raisedBed || !field) {
            return skip('Operation target field was not found.', {
                operationId,
                raisedBedId: operation.raisedBedId,
                raisedBedFieldId: operation.raisedBedFieldId,
            });
        }

        if (field.plantStatus === targetStatus) {
            return skip('Plant already has the target status.', {
                targetStatus,
            });
        }

        if (context.dryRun) {
            return success({
                dryRun: true,
                raisedBedId: raisedBed.id,
                positionIndex: field.positionIndex,
                previousStatus: field.plantStatus ?? null,
                targetStatus,
            });
        }

        await createEvent(
            knownEvents.raisedBedFields.plantUpdateV1(
                `${raisedBed.id}|${field.positionIndex}`,
                buildRaisedBedFieldPlantUpdatePayload(
                    targetStatus,
                    field.assignedUserIds,
                ),
            ),
        );

        return success({
            raisedBedId: raisedBed.id,
            positionIndex: field.positionIndex,
            previousStatus: field.plantStatus ?? null,
            targetStatus,
        });
    },
};

const logActionModule: AutomationModule = {
    key: logActionKey,
    kind: 'action',
    title: 'Log only',
    description:
        'Records a no-op action result for testing an automation path.',
    category: 'Diagnostics',
    configFields: [
        {
            key: 'message',
            label: 'Message',
            type: 'string',
            placeholder: 'Automation reached this step.',
        },
    ],
    dryRunSupported: true,
    mutatesData: false,
    retryable: false,
    execute: async (_context, node) =>
        success({
            message:
                getString(node.config, 'message') ??
                'Automation reached log action.',
        }),
};

export const automationModules = [
    triggerDomainEventModule,
    eventDataEqualsConditionModule,
    operationMatchesConditionModule,
    plantStatusEqualsConditionModule,
    queueSeasonalSowingOfferOperationsActionModule,
    createOperationActionModule,
    updateRaisedBedFieldPlantStatusActionModule,
    logActionModule,
] as const satisfies readonly AutomationModule[];

const automationModulesByKey = new Map(
    automationModules.map((module) => [module.key, module]),
);

export function getAutomationModule(key: string) {
    return automationModulesByKey.get(key) ?? null;
}

export function getAutomationModuleMetadata(): AutomationModuleMetadata[] {
    return automationModules.map(
        ({ execute: _execute, validateConfig: _validateConfig, ...metadata }) =>
            metadata,
    );
}

export function validateAutomationNodeConfig(node: AutomationGraphNode) {
    const module = getAutomationModule(node.moduleKey);
    if (!module) {
        return [`Unknown automation module: ${node.moduleKey}.`];
    }

    if (module.kind !== node.kind) {
        return [
            `Module ${node.moduleKey} is a ${module.kind}, not a ${node.kind}.`,
        ];
    }

    return module.validateConfig
        ? module.validateConfig(getRecord(node.config))
        : [];
}
