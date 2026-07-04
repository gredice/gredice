import 'server-only';
import { createHash } from 'node:crypto';
import { PLANT_STAGE_LABELS, type PlantStageName } from '@gredice/js/plants';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import {
    type CommunityEditableFieldDefinition,
    type CommunityEditControlType,
    getCommunityEditableFieldDefinition,
    getCommunityEditableFieldDefinitions,
} from '../helpers/communityEditableFields';
import {
    attributeValues,
    communityEditRequestChanges,
    communityEditRequests,
    type SelectAttributeDefinition,
    type SelectAttributeValue,
    type SelectCommunityEditRequest,
} from '../schema';
import { storage } from '../storage';
import { evaluateCommunityEditAchievementsForSubmitter } from './achievementsRepo';
import {
    createAttributeValueMutationSideEffects,
    deleteAttributeValue,
    flushAttributeValueMutationSideEffects,
    upsertAttributeValue,
} from './attributeValuesRepo';
import { getEntitiesRaw, getEntityRaw } from './entitiesRepo';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = TransactionClient | StorageClient;

export type CommunityEditRequestStatus =
    | 'applied'
    | 'approved'
    | 'canceled'
    | 'conflicted'
    | 'pending'
    | 'rejected';

export type CommunityEditRequestErrorCode =
    | 'conflict'
    | 'invalid_field'
    | 'invalid_state'
    | 'invalid_value'
    | 'missing_entity'
    | 'no_changes'
    | 'not_found'
    | 'unsupported_data_type';

export class CommunityEditRequestError extends Error {
    constructor(
        readonly code: CommunityEditRequestErrorCode,
        message: string,
    ) {
        super(message);
        this.name = 'CommunityEditRequestError';
    }
}

export type CommunityEditActor = {
    id: string;
    name?: string | null;
    email?: string | null;
};

export type CommunityEditableFieldSnapshot = {
    entityTypeName: string;
    entityId: number;
    fieldKey: string;
    sectionKey: string;
    attributeDefinitionId: number;
    attributeValueId: number | null;
    attributePath: string;
    dataType: string;
    controlType: CommunityEditControlType;
    multiple: boolean;
    publicLabel: string;
    helpText?: string;
    options?: CommunityEditableFieldDefinition['options'];
    operationSuggestionStage?: CommunityEditableFieldDefinition['operationSuggestionStage'];
    currentValue: string | null;
    baseValueHash: string;
};

export type CreateCommunityEditRequestInput = {
    entityTypeName: string;
    entityId: number;
    publicPath: string;
    sectionKey?: string | null;
    submitter: CommunityEditActor;
    submitterNote?: string | null;
    changes: {
        fieldKey: string;
        proposedValue: unknown;
        baseValueHash?: string | null;
    }[];
};

type EntityRaw = NonNullable<Awaited<ReturnType<typeof getEntityRaw>>>;

export type CommunityOperationSuggestionIntent = 'add' | 'remove';
export type CommunityOperationSuggestionMode = 'existing' | 'new';

type CommunityOperationSuggestionBaseValue = {
    format: 'community-operation-suggestion-v1';
    intent: CommunityOperationSuggestionIntent;
    operationMode: CommunityOperationSuggestionMode;
    operationLabel: string;
    stageName: PlantStageName;
    stageLabel: string;
    currentState: 'absent' | 'present';
    note?: string;
    source?: string;
};

export type CommunityOperationSuggestionValue =
    | (CommunityOperationSuggestionBaseValue & {
          operationMode: 'existing';
          operationId: number;
      })
    | (CommunityOperationSuggestionBaseValue & {
          intent: 'add';
          operationMode: 'new';
          currentState: 'absent';
          newOperationName: string;
          newOperationDescription: string;
      });

type ResolvedCommunityEditChange = {
    fieldKey: string;
    sectionKey: string;
    attributeDefinitionId: number;
    attributeValueId: number | null;
    attributePath: string;
    dataType: string;
    previousValue: string | null;
    proposedValue: string | null;
    baseValueHash: string;
    valuePatch: string | null;
    reviewDiff: string | null;
};

type CompactTextDiff = {
    format: 'compact-text-diff-v1';
    prefixLength: number;
    suffixLength: number;
    removed: string;
    added: string;
};

type TextPatchHunk = {
    contextBefore: string;
    removed: string;
    added: string;
    contextAfter: string;
};

type CommunityTextPatch = {
    format: 'community-text-patch-v1';
    hunks: TextPatchHunk[];
};

const TEXT_PATCH_CONTEXT_LENGTH = 64;

function attributePath(
    field: Pick<CommunityEditableFieldDefinition, 'category' | 'name'>,
) {
    return `${field.category}.${field.name}`;
}

function stableValueHash(value: string | null) {
    return createHash('sha256')
        .update(value ?? '')
        .digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isPlantStageName(value: unknown): value is PlantStageName {
    return typeof value === 'string' && value in PLANT_STAGE_LABELS;
}

function rawAttributeValue(entity: EntityRaw, category: string, name: string) {
    return (
        entity.attributes.find(
            (attribute) =>
                !attribute.isDeleted &&
                attribute.attributeDefinition.category === category &&
                attribute.attributeDefinition.name === name,
        )?.value ?? null
    );
}

function entityLabel(entity: EntityRaw) {
    return (
        rawAttributeValue(entity, 'information', 'label') ??
        rawAttributeValue(entity, 'information', 'name') ??
        `${entity.entityType.label} ${entity.id}`
    );
}

function booleanAttributeValue(value: string | null) {
    return value === 'true';
}

function operationIdsFromSerializedValue(value: string | null) {
    if (!value) {
        return new Set<string>();
    }

    try {
        const parsed: unknown = JSON.parse(value);
        if (!Array.isArray(parsed)) {
            return new Set<string>();
        }

        return new Set(
            parsed
                .map(normalizeReferenceId)
                .filter((entry): entry is string => Boolean(entry)),
        );
    } catch {
        return new Set<string>();
    }
}

function activeAttributeValues(
    entity: EntityRaw,
    attributeDefinitionId: number,
) {
    return entity.attributes.filter(
        (attribute) =>
            attribute.attributeDefinitionId === attributeDefinitionId &&
            !attribute.isDeleted,
    );
}

function serializedCurrentValue(
    values: SelectAttributeValue[],
    multiple: boolean,
) {
    if (multiple) {
        return JSON.stringify(values.map((value) => value.value ?? null));
    }

    return values[0]?.value ?? null;
}

function firstPersistedAttributeValueId(values: SelectAttributeValue[]) {
    const id = values[0]?.id;
    return typeof id === 'number' && id > 0 ? id : null;
}

function controlTypeMatchesDataType(
    controlType: CommunityEditControlType,
    dataType: string,
) {
    switch (controlType) {
        case 'boolean':
            return dataType === 'boolean';
        case 'json':
            return dataType.startsWith('json');
        case 'markdown':
            return dataType === 'markdown';
        case 'number':
            return dataType === 'number';
        case 'operationSuggestion':
            return dataType === 'ref:operation';
        case 'range':
            return dataType === 'range' || dataType.startsWith('range|');
        case 'reference':
            return dataType.startsWith('ref:');
        case 'select':
            return (
                dataType === 'boolean' ||
                dataType === 'number' ||
                dataType === 'text'
            );
        case 'text':
            return dataType === 'text';
    }
}

function assertFieldDataTypeSupported(
    field: CommunityEditableFieldDefinition,
    definition: SelectAttributeDefinition,
) {
    if (!controlTypeMatchesDataType(field.controlType, definition.dataType)) {
        throw new CommunityEditRequestError(
            'unsupported_data_type',
            `Field ${field.fieldKey} is registered as ${field.controlType}, but the attribute uses ${definition.dataType}.`,
        );
    }

    if (field.controlType === 'json' && !field.allowJson) {
        throw new CommunityEditRequestError(
            'unsupported_data_type',
            `Field ${field.fieldKey} does not allow JSON submissions.`,
        );
    }

    if (field.controlType === 'select' && !field.options?.length) {
        throw new CommunityEditRequestError(
            'unsupported_data_type',
            `Field ${field.fieldKey} is registered as select but has no options.`,
        );
    }
}

function findAttributeDefinition(
    entity: EntityRaw,
    field: CommunityEditableFieldDefinition,
) {
    return entity.entityType.attributeDefinitions.find(
        (definition) =>
            definition.category === field.category &&
            definition.name === field.name &&
            !definition.isDeleted,
    );
}

function resolveFieldSnapshot(
    entity: EntityRaw,
    field: CommunityEditableFieldDefinition,
): CommunityEditableFieldSnapshot {
    const definition = findAttributeDefinition(entity, field);
    if (!definition) {
        throw new CommunityEditRequestError(
            'invalid_field',
            `Editable field ${field.fieldKey} is not backed by an attribute definition.`,
        );
    }

    assertFieldDataTypeSupported(field, definition);
    if (field.controlType === 'select' && definition.multiple) {
        throw new CommunityEditRequestError(
            'unsupported_data_type',
            `Field ${field.fieldKey} cannot use select for multiple values.`,
        );
    }
    if (field.controlType === 'operationSuggestion' && !definition.multiple) {
        throw new CommunityEditRequestError(
            'unsupported_data_type',
            `Field ${field.fieldKey} must be backed by a multiple operation reference.`,
        );
    }

    const values = activeAttributeValues(entity, definition.id);
    const currentValue = serializedCurrentValue(values, definition.multiple);

    return {
        entityTypeName: entity.entityTypeName,
        entityId: entity.id,
        fieldKey: field.fieldKey,
        sectionKey: field.sectionKey,
        attributeDefinitionId: definition.id,
        attributeValueId: firstPersistedAttributeValueId(values),
        attributePath: attributePath(field),
        dataType: definition.dataType,
        controlType: field.controlType,
        multiple: definition.multiple,
        publicLabel: field.publicLabel,
        helpText: field.helpText,
        options: field.options,
        operationSuggestionStage: field.operationSuggestionStage,
        currentValue,
        baseValueHash: stableValueHash(currentValue),
    };
}

async function getCommunityEditableEntity(
    entityTypeName: string,
    entityId: number,
) {
    const entity = await getEntityRaw(entityId);
    if (!entity || entity.entityTypeName !== entityTypeName) {
        throw new CommunityEditRequestError(
            'missing_entity',
            `Entity ${entityTypeName}#${entityId} was not found.`,
        );
    }

    return entity;
}

async function plantStageInfoById() {
    const stages = (await getEntitiesRaw(
        'plantStage',
        'published',
    )) as EntityRaw[];

    return new Map(
        stages.map((stage) => [
            stage.id,
            {
                name: rawAttributeValue(stage, 'information', 'name'),
                label:
                    rawAttributeValue(stage, 'information', 'label') ??
                    rawAttributeValue(stage, 'information', 'name') ??
                    `Stadij ${stage.id}`,
            },
        ]),
    );
}

function operationStageInfo(
    operation: EntityRaw,
    stagesById: Awaited<ReturnType<typeof plantStageInfoById>>,
) {
    const stageId = normalizeReferenceId(
        rawAttributeValue(operation, 'attributes', 'stage'),
    );
    if (!stageId) {
        return null;
    }

    const stage = stagesById.get(Number.parseInt(stageId, 10));
    return stage?.name ? stage : null;
}

async function operationSuggestionOptions(
    field: CommunityEditableFieldDefinition,
) {
    if (
        field.controlType !== 'operationSuggestion' ||
        !field.operationSuggestionStage
    ) {
        return field.options;
    }

    const [operations, stagesById] = await Promise.all([
        getEntitiesRaw('operation', 'published') as Promise<EntityRaw[]>,
        plantStageInfoById(),
    ]);

    return operations
        .filter((operation) => {
            const stage = operationStageInfo(operation, stagesById);
            return (
                operation.entityTypeName === 'operation' &&
                rawAttributeValue(operation, 'attributes', 'application') ===
                    'plant' &&
                !booleanAttributeValue(
                    rawAttributeValue(operation, 'attributes', 'internal'),
                ) &&
                stage?.name === field.operationSuggestionStage?.name
            );
        })
        .map((operation) => ({
            value: String(operation.id),
            label: entityLabel(operation),
            helpText: field.operationSuggestionStage?.label,
            description:
                rawAttributeValue(
                    operation,
                    'information',
                    'shortDescription',
                ) ??
                rawAttributeValue(operation, 'information', 'description') ??
                undefined,
            iconKey:
                operationStageInfo(operation, stagesById)?.name ??
                field.operationSuggestionStage?.name,
        }))
        .sort((left, right) => left.label.localeCompare(right.label, 'hr'));
}

async function resolveFieldSnapshotForResponse(
    entity: EntityRaw,
    field: CommunityEditableFieldDefinition,
) {
    const snapshot = resolveFieldSnapshot(entity, field);
    if (field.controlType !== 'operationSuggestion') {
        return snapshot;
    }

    return {
        ...snapshot,
        options: await operationSuggestionOptions(field),
    };
}

export async function getCommunityEditableFieldsForEntity(input: {
    entityTypeName: string;
    entityId: number;
    sectionKey?: string | null;
}) {
    const entity = await getCommunityEditableEntity(
        input.entityTypeName,
        input.entityId,
    );

    const fields = await Promise.all(
        getCommunityEditableFieldDefinitions(
            input.entityTypeName,
            input.sectionKey,
        ).map(async (field) => {
            try {
                return await resolveFieldSnapshotForResponse(entity, field);
            } catch (error) {
                if (error instanceof CommunityEditRequestError) {
                    return null;
                }
                throw error;
            }
        }),
    );
    return fields.filter(
        (field): field is CommunityEditableFieldSnapshot => field !== null,
    );
}

function normalizeNullableString(value: string, maxLength?: number) {
    if (value.length === 0) {
        return null;
    }

    if (maxLength && value.length > maxLength) {
        throw new CommunityEditRequestError(
            'invalid_value',
            `Value must be ${maxLength} characters or fewer.`,
        );
    }

    return value;
}

function normalizeTextValue(
    value: unknown,
    field: CommunityEditableFieldDefinition,
) {
    if (value === null) {
        return null;
    }

    if (typeof value !== 'string') {
        throw new CommunityEditRequestError(
            'invalid_value',
            `Field ${field.fieldKey} expects text.`,
        );
    }

    return normalizeNullableString(value, field.maxLength);
}

function normalizeNumberValue(
    value: unknown,
    field: CommunityEditableFieldDefinition,
) {
    if (value === null || value === '') {
        return null;
    }

    const numberValue =
        typeof value === 'number'
            ? value
            : typeof value === 'string'
              ? Number.parseFloat(value)
              : Number.NaN;

    if (!Number.isFinite(numberValue)) {
        throw new CommunityEditRequestError(
            'invalid_value',
            `Field ${field.fieldKey} expects a number.`,
        );
    }

    return String(numberValue);
}

function normalizeBooleanValue(
    value: unknown,
    field: CommunityEditableFieldDefinition,
) {
    if (value === null || value === '') {
        return null;
    }

    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }

    if (value === 'true' || value === 'false') {
        return value;
    }

    throw new CommunityEditRequestError(
        'invalid_value',
        `Field ${field.fieldKey} expects a boolean.`,
    );
}

function isRangeRecord(value: unknown): value is { min: number; max: number } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'min' in value &&
        'max' in value &&
        typeof value.min === 'number' &&
        typeof value.max === 'number' &&
        Number.isFinite(value.min) &&
        Number.isFinite(value.max)
    );
}

function normalizeRangeValue(
    value: unknown,
    field: CommunityEditableFieldDefinition,
) {
    if (value === null || value === '') {
        return null;
    }

    if (typeof value === 'string') {
        try {
            const parsed: unknown = JSON.parse(value);
            if (isRangeRecord(parsed)) {
                return JSON.stringify({
                    min: parsed.min,
                    max: parsed.max,
                });
            }
        } catch {
            // handled below
        }
    }

    if (isRangeRecord(value)) {
        return JSON.stringify({ min: value.min, max: value.max });
    }

    throw new CommunityEditRequestError(
        'invalid_value',
        `Field ${field.fieldKey} expects a range.`,
    );
}

function normalizeReferenceId(value: unknown) {
    const textValue =
        typeof value === 'number'
            ? String(value)
            : typeof value === 'string'
              ? value
              : '';
    const trimmed = textValue.trim();
    return /^\d+$/.test(trimmed) ? trimmed : null;
}

function normalizeReferenceValue(
    value: unknown,
    field: CommunityEditableFieldDefinition,
    multiple: boolean,
) {
    if (value === null || value === '') {
        return null;
    }

    if (multiple) {
        const rawValues = Array.isArray(value) ? value : [value];
        const normalizedValues = rawValues.map(normalizeReferenceId);
        if (normalizedValues.some((entry) => entry === null)) {
            throw new CommunityEditRequestError(
                'invalid_value',
                `Field ${field.fieldKey} expects entity reference IDs.`,
            );
        }

        return JSON.stringify(normalizedValues);
    }

    const normalizedValue = normalizeReferenceId(value);
    if (!normalizedValue) {
        throw new CommunityEditRequestError(
            'invalid_value',
            `Field ${field.fieldKey} expects an entity reference ID.`,
        );
    }

    return normalizedValue;
}

function normalizeJsonValue(
    value: unknown,
    field: CommunityEditableFieldDefinition,
) {
    if (!field.allowJson) {
        throw new CommunityEditRequestError(
            'unsupported_data_type',
            `Field ${field.fieldKey} does not allow JSON submissions.`,
        );
    }

    if (value === null || value === '') {
        return null;
    }

    if (typeof value === 'string') {
        try {
            return JSON.stringify(JSON.parse(value));
        } catch {
            throw new CommunityEditRequestError(
                'invalid_value',
                `Field ${field.fieldKey} expects valid JSON.`,
            );
        }
    }

    return JSON.stringify(value);
}

function normalizeOptionalSuggestionText(
    value: unknown,
    fieldLabel: string,
    maxLength: number,
) {
    if (value === null || typeof value === 'undefined') {
        return undefined;
    }
    if (typeof value !== 'string') {
        throw new CommunityEditRequestError(
            'invalid_value',
            `${fieldLabel} must be text.`,
        );
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }
    if (trimmed.length > maxLength) {
        throw new CommunityEditRequestError(
            'invalid_value',
            `${fieldLabel} must be ${maxLength} characters or fewer.`,
        );
    }

    return trimmed;
}

function normalizeOperationSuggestionIntent(
    value: unknown,
): CommunityOperationSuggestionIntent {
    if (value === 'add' || value === 'remove') {
        return value;
    }

    throw new CommunityEditRequestError(
        'invalid_value',
        'Operation suggestion must choose add or remove.',
    );
}

function normalizeOperationSuggestionMode(
    value: unknown,
): CommunityOperationSuggestionMode {
    if (value === 'new' || value === 'existing') {
        return value;
    }
    if (typeof value === 'undefined') {
        return 'existing';
    }

    throw new CommunityEditRequestError(
        'invalid_value',
        'Operation suggestion must choose an existing or new operation.',
    );
}

function normalizeOperationSuggestionOperationId(value: unknown) {
    const normalized = normalizeReferenceId(value);
    if (!normalized) {
        throw new CommunityEditRequestError(
            'invalid_value',
            'Operation suggestion must include an operation ID.',
        );
    }

    return Number.parseInt(normalized, 10);
}

function normalizeRequiredSuggestionText(
    value: unknown,
    fieldLabel: string,
    maxLength: number,
) {
    const normalized = normalizeOptionalSuggestionText(
        value,
        fieldLabel,
        maxLength,
    );
    if (!normalized) {
        throw new CommunityEditRequestError(
            'invalid_value',
            `${fieldLabel} is required.`,
        );
    }

    return normalized;
}

async function resolveOperationSuggestionTarget(input: {
    operationId: number;
    stage: NonNullable<
        CommunityEditableFieldDefinition['operationSuggestionStage']
    >;
}) {
    const operation = await getEntityRaw(input.operationId);
    if (
        operation?.entityTypeName !== 'operation' ||
        operation.state !== 'published'
    ) {
        throw new CommunityEditRequestError(
            'invalid_value',
            `Operation ${input.operationId} is not a published operation.`,
        );
    }

    if (rawAttributeValue(operation, 'attributes', 'application') !== 'plant') {
        throw new CommunityEditRequestError(
            'invalid_value',
            'Operation suggestions can only use operations applied to a plant.',
        );
    }

    if (
        booleanAttributeValue(
            rawAttributeValue(operation, 'attributes', 'internal'),
        )
    ) {
        throw new CommunityEditRequestError(
            'invalid_value',
            'Internal operations cannot be suggested for public plant pages.',
        );
    }

    const stage = operationStageInfo(operation, await plantStageInfoById());
    if (stage?.name !== input.stage.name) {
        throw new CommunityEditRequestError(
            'invalid_value',
            `Operation ${input.operationId} does not belong to the ${input.stage.label} stage.`,
        );
    }

    return {
        operationLabel: entityLabel(operation),
        stageName: input.stage.name,
        stageLabel: stage.label,
    };
}

async function normalizeOperationSuggestionValue(
    value: unknown,
    field: CommunityEditableFieldDefinition,
    snapshot: CommunityEditableFieldSnapshot,
) {
    if (!field.operationSuggestionStage) {
        throw new CommunityEditRequestError(
            'unsupported_data_type',
            `Field ${field.fieldKey} is missing operation suggestion stage metadata.`,
        );
    }

    if (!snapshot.multiple || snapshot.dataType !== 'ref:operation') {
        throw new CommunityEditRequestError(
            'unsupported_data_type',
            `Field ${field.fieldKey} must be backed by multiple operation references.`,
        );
    }

    if (!isRecord(value)) {
        throw new CommunityEditRequestError(
            'invalid_value',
            `Field ${field.fieldKey} expects an operation suggestion.`,
        );
    }

    const stageName =
        typeof value.stageName === 'string'
            ? value.stageName
            : field.operationSuggestionStage.name;
    if (stageName !== field.operationSuggestionStage.name) {
        throw new CommunityEditRequestError(
            'invalid_value',
            `Field ${field.fieldKey} only accepts ${field.operationSuggestionStage.label} suggestions.`,
        );
    }

    const intent = normalizeOperationSuggestionIntent(value.intent);
    const operationMode = normalizeOperationSuggestionMode(value.operationMode);
    const note = normalizeOptionalSuggestionText(value.note, 'Note', 1000);
    const source = normalizeOptionalSuggestionText(value.source, 'Source', 500);

    if (operationMode === 'new') {
        if (intent !== 'add') {
            throw new CommunityEditRequestError(
                'invalid_value',
                'New operation suggestions can only be added.',
            );
        }

        const newOperationName = normalizeRequiredSuggestionText(
            value.newOperationName,
            'New operation name',
            160,
        );
        const newOperationDescription = normalizeRequiredSuggestionText(
            value.newOperationDescription,
            'New operation description',
            2000,
        );

        const suggestion: CommunityOperationSuggestionValue = {
            format: 'community-operation-suggestion-v1',
            intent,
            operationMode,
            operationLabel: newOperationName,
            stageName: field.operationSuggestionStage.name,
            stageLabel: field.operationSuggestionStage.label,
            currentState: 'absent',
            newOperationName,
            newOperationDescription,
        };
        if (note) {
            suggestion.note = note;
        }
        if (source) {
            suggestion.source = source;
        }

        return JSON.stringify(suggestion);
    }

    const operationId = normalizeOperationSuggestionOperationId(
        value.operationId,
    );
    const target = await resolveOperationSuggestionTarget({
        operationId,
        stage: field.operationSuggestionStage,
    });
    const currentOperationIds = operationIdsFromSerializedValue(
        snapshot.currentValue,
    );
    const currentState = currentOperationIds.has(String(operationId))
        ? 'present'
        : 'absent';
    if (intent === 'add' && currentState === 'present') {
        throw new CommunityEditRequestError(
            'invalid_value',
            `${target.operationLabel} is already linked to this plant.`,
        );
    }
    if (intent === 'remove' && currentState === 'absent') {
        throw new CommunityEditRequestError(
            'invalid_value',
            `${target.operationLabel} is not linked to this plant.`,
        );
    }

    const suggestion: CommunityOperationSuggestionValue = {
        format: 'community-operation-suggestion-v1',
        intent,
        operationMode,
        operationId,
        operationLabel: target.operationLabel,
        stageName: target.stageName,
        stageLabel: target.stageLabel,
        currentState,
    };
    if (note) {
        suggestion.note = note;
    }
    if (source) {
        suggestion.source = source;
    }

    return JSON.stringify(suggestion);
}

function normalizeSelectValue(
    value: unknown,
    field: CommunityEditableFieldDefinition,
    snapshot: CommunityEditableFieldSnapshot,
) {
    if (value === null || value === '') {
        return null;
    }

    const textValue =
        typeof value === 'boolean' || typeof value === 'number'
            ? String(value)
            : typeof value === 'string'
              ? value
              : null;

    if (
        !textValue ||
        !field.options?.some((option) => option.value === textValue)
    ) {
        throw new CommunityEditRequestError(
            'invalid_value',
            `Field ${field.fieldKey} expects one of the configured options.`,
        );
    }

    switch (snapshot.dataType) {
        case 'boolean':
            return normalizeBooleanValue(textValue, field);
        case 'number':
            return normalizeNumberValue(textValue, field);
        default:
            return normalizeNullableString(textValue, field.maxLength);
    }
}

async function normalizeProposedValue(
    value: unknown,
    field: CommunityEditableFieldDefinition,
    snapshot: CommunityEditableFieldSnapshot,
) {
    switch (field.controlType) {
        case 'boolean':
            return normalizeBooleanValue(value, field);
        case 'json':
            return normalizeJsonValue(value, field);
        case 'markdown':
        case 'text':
            return normalizeTextValue(value, field);
        case 'number':
            return normalizeNumberValue(value, field);
        case 'operationSuggestion':
            return await normalizeOperationSuggestionValue(
                value,
                field,
                snapshot,
            );
        case 'range':
            return normalizeRangeValue(value, field);
        case 'reference':
            return normalizeReferenceValue(value, field, snapshot.multiple);
        case 'select':
            return normalizeSelectValue(value, field, snapshot);
    }
}

function supportsTextPatch(
    controlType: CommunityEditControlType,
    multiple: boolean,
) {
    return !multiple && (controlType === 'text' || controlType === 'markdown');
}

function createCompactTextDiff(
    previousValue: string | null,
    proposedValue: string | null,
): CompactTextDiff {
    const previous = previousValue ?? '';
    const proposed = proposedValue ?? '';
    let prefixLength = 0;
    while (
        prefixLength < previous.length &&
        prefixLength < proposed.length &&
        previous[prefixLength] === proposed[prefixLength]
    ) {
        prefixLength += 1;
    }

    let suffixLength = 0;
    while (
        suffixLength < previous.length - prefixLength &&
        suffixLength < proposed.length - prefixLength &&
        previous[previous.length - suffixLength - 1] ===
            proposed[proposed.length - suffixLength - 1]
    ) {
        suffixLength += 1;
    }

    const previousEnd =
        suffixLength > 0 ? previous.length - suffixLength : previous.length;
    const proposedEnd =
        suffixLength > 0 ? proposed.length - suffixLength : proposed.length;

    return {
        format: 'compact-text-diff-v1',
        prefixLength,
        suffixLength,
        removed: previous.slice(prefixLength, previousEnd),
        added: proposed.slice(prefixLength, proposedEnd),
    };
}

function createReviewDiff(
    controlType: CommunityEditControlType,
    previousValue: string | null,
    proposedValue: string | null,
) {
    if (controlType === 'operationSuggestion') {
        return proposedValue;
    }

    if (controlType !== 'text' && controlType !== 'markdown') {
        return null;
    }

    return JSON.stringify(createCompactTextDiff(previousValue, proposedValue));
}

function createTextValuePatch(
    controlType: CommunityEditControlType,
    snapshot: CommunityEditableFieldSnapshot,
    proposedValue: string | null,
) {
    if (!supportsTextPatch(controlType, snapshot.multiple)) {
        return null;
    }

    const previous = snapshot.currentValue ?? '';
    const diff = createCompactTextDiff(snapshot.currentValue, proposedValue);
    const previousEnd =
        diff.suffixLength > 0
            ? previous.length - diff.suffixLength
            : previous.length;
    const contextBefore = previous.slice(
        Math.max(0, diff.prefixLength - TEXT_PATCH_CONTEXT_LENGTH),
        diff.prefixLength,
    );
    const contextAfter = previous.slice(
        previousEnd,
        Math.min(previous.length, previousEnd + TEXT_PATCH_CONTEXT_LENGTH),
    );
    const patch: CommunityTextPatch = {
        format: 'community-text-patch-v1',
        hunks: [
            {
                contextBefore,
                removed: diff.removed,
                added: diff.added,
                contextAfter,
            },
        ],
    };

    return JSON.stringify(patch);
}

function isCommunityTextPatch(value: unknown): value is CommunityTextPatch {
    return (
        typeof value === 'object' &&
        value !== null &&
        'format' in value &&
        value.format === 'community-text-patch-v1' &&
        'hunks' in value &&
        Array.isArray(value.hunks) &&
        value.hunks.every(
            (hunk) =>
                typeof hunk === 'object' &&
                hunk !== null &&
                'contextBefore' in hunk &&
                typeof hunk.contextBefore === 'string' &&
                'removed' in hunk &&
                typeof hunk.removed === 'string' &&
                'added' in hunk &&
                typeof hunk.added === 'string' &&
                'contextAfter' in hunk &&
                typeof hunk.contextAfter === 'string',
        )
    );
}

function parseCommunityTextPatch(value: string | null) {
    if (!value) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(value);
        return isCommunityTextPatch(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function findUniqueIndex(value: string, needle: string, startIndex = 0) {
    if (needle.length === 0) {
        return startIndex <= value.length ? startIndex : null;
    }

    const firstIndex = value.indexOf(needle, startIndex);
    if (firstIndex === -1) {
        return null;
    }

    return value.indexOf(needle, firstIndex + 1) === -1 ? firstIndex : null;
}

function replacementRangeForHunk(value: string, hunk: TextPatchHunk) {
    const exactNeedle = hunk.contextBefore + hunk.removed + hunk.contextAfter;
    const exactIndex = findUniqueIndex(value, exactNeedle);
    if (exactIndex !== null) {
        const start = exactIndex + hunk.contextBefore.length;
        return {
            start,
            end: start + hunk.removed.length,
        };
    }

    if (hunk.removed.length > 0) {
        const removedWithAfter = hunk.removed + hunk.contextAfter;
        const removedWithAfterIndex = findUniqueIndex(value, removedWithAfter);
        if (removedWithAfterIndex !== null) {
            return {
                start: removedWithAfterIndex,
                end: removedWithAfterIndex + hunk.removed.length,
            };
        }

        const beforeWithRemoved = hunk.contextBefore + hunk.removed;
        const beforeWithRemovedIndex = findUniqueIndex(
            value,
            beforeWithRemoved,
        );
        if (beforeWithRemovedIndex !== null) {
            const start = beforeWithRemovedIndex + hunk.contextBefore.length;
            return {
                start,
                end: start + hunk.removed.length,
            };
        }

        const removedIndex = findUniqueIndex(value, hunk.removed);
        if (removedIndex !== null) {
            return {
                start: removedIndex,
                end: removedIndex + hunk.removed.length,
            };
        }
    }

    if (hunk.removed.length > 0) {
        return null;
    }

    if (hunk.contextAfter.length > 0) {
        const contextAfterIndex = findUniqueIndex(value, hunk.contextAfter);
        if (contextAfterIndex !== null) {
            return {
                start: contextAfterIndex,
                end: contextAfterIndex,
            };
        }
    }

    if (hunk.contextBefore.length > 0) {
        const contextBeforeIndex = findUniqueIndex(value, hunk.contextBefore);
        if (contextBeforeIndex !== null) {
            const start = contextBeforeIndex + hunk.contextBefore.length;
            return { start, end: start };
        }
    }

    return null;
}

function applyTextValuePatch(valuePatch: string | null, currentValue: string) {
    const patch = parseCommunityTextPatch(valuePatch);
    if (!patch) {
        return null;
    }

    let patchedValue = currentValue;
    for (const hunk of patch.hunks) {
        const range = replacementRangeForHunk(patchedValue, hunk);
        if (!range) {
            return null;
        }

        if (
            hunk.removed.length > 0 &&
            patchedValue.slice(range.start, range.end) !== hunk.removed
        ) {
            return null;
        }

        patchedValue =
            patchedValue.slice(0, range.start) +
            hunk.added +
            patchedValue.slice(range.end);
    }

    return patchedValue;
}

async function resolveSubmittedChange(
    entity: EntityRaw,
    submittedChange: CreateCommunityEditRequestInput['changes'][number],
    sectionKey?: string | null,
): Promise<ResolvedCommunityEditChange> {
    const field = getCommunityEditableFieldDefinition(
        entity.entityTypeName,
        submittedChange.fieldKey,
    );
    if (!field) {
        throw new CommunityEditRequestError(
            'invalid_field',
            `Field ${submittedChange.fieldKey} is not editable for ${entity.entityTypeName}.`,
        );
    }

    if (sectionKey && field.sectionKey !== sectionKey) {
        throw new CommunityEditRequestError(
            'invalid_field',
            `Field ${field.fieldKey} does not belong to section ${sectionKey}.`,
        );
    }

    const snapshot = resolveFieldSnapshot(entity, field);
    if (
        field.controlType !== 'operationSuggestion' &&
        submittedChange.baseValueHash &&
        submittedChange.baseValueHash !== snapshot.baseValueHash
    ) {
        throw new CommunityEditRequestError(
            'conflict',
            `Field ${field.fieldKey} has changed since editing started.`,
        );
    }

    const proposedValue = await normalizeProposedValue(
        submittedChange.proposedValue,
        field,
        snapshot,
    );

    return {
        fieldKey: field.fieldKey,
        sectionKey: field.sectionKey,
        attributeDefinitionId: snapshot.attributeDefinitionId,
        attributeValueId: snapshot.attributeValueId,
        attributePath: snapshot.attributePath,
        dataType: snapshot.dataType,
        previousValue: snapshot.currentValue,
        proposedValue,
        baseValueHash: snapshot.baseValueHash,
        valuePatch: createTextValuePatch(
            field.controlType,
            snapshot,
            proposedValue,
        ),
        reviewDiff: createReviewDiff(
            field.controlType,
            snapshot.currentValue,
            proposedValue,
        ),
    };
}

export async function createCommunityEditRequest(
    input: CreateCommunityEditRequestInput,
) {
    const entity = await getCommunityEditableEntity(
        input.entityTypeName,
        input.entityId,
    );
    const changes = (
        await Promise.all(
            input.changes.map((change) =>
                resolveSubmittedChange(entity, change, input.sectionKey),
            ),
        )
    ).filter((change) => change.previousValue !== change.proposedValue);

    if (changes.length === 0) {
        throw new CommunityEditRequestError(
            'no_changes',
            'At least one changed field is required.',
        );
    }

    const createdRequest = await storage().transaction(async (tx) => {
        const [request] = await tx
            .insert(communityEditRequests)
            .values({
                status: 'pending',
                entityTypeName: input.entityTypeName,
                entityId: input.entityId,
                publicPath: input.publicPath,
                sectionKey: input.sectionKey,
                submitterUserId: input.submitter.id,
                submitterName: input.submitter.name,
                submitterEmail: input.submitter.email,
                submitterNote: input.submitterNote,
            })
            .returning();

        await tx.insert(communityEditRequestChanges).values(
            changes.map((change) => ({
                requestId: request.id,
                fieldKey: change.fieldKey,
                sectionKey: change.sectionKey,
                attributeDefinitionId: change.attributeDefinitionId,
                attributeValueId: change.attributeValueId,
                attributePath: change.attributePath,
                dataType: change.dataType,
                previousValue: change.previousValue,
                proposedValue: change.proposedValue,
                baseValueHash: change.baseValueHash,
                valuePatch: change.valuePatch,
                reviewDiff: change.reviewDiff,
            })),
        );

        return request;
    });

    const request = await getCommunityEditRequest(createdRequest.id);
    if (!request) {
        throw new CommunityEditRequestError(
            'not_found',
            'Community edit request was created but could not be loaded.',
        );
    }
    return request;
}

export function listCommunityEditRequests(filters?: {
    status?: CommunityEditRequestStatus;
    entityTypeName?: string;
}) {
    const conditions = [];
    if (filters?.status) {
        conditions.push(eq(communityEditRequests.status, filters.status));
    }
    if (filters?.entityTypeName) {
        conditions.push(
            eq(communityEditRequests.entityTypeName, filters.entityTypeName),
        );
    }

    return storage().query.communityEditRequests.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
            submitter: {
                columns: {
                    id: true,
                    userName: true,
                    displayName: true,
                    avatarUrl: true,
                },
            },
            changes: {
                with: {
                    attributeDefinition: true,
                },
                orderBy: [asc(communityEditRequestChanges.id)],
            },
        },
        orderBy: [desc(communityEditRequests.createdAt)],
    });
}

export async function getPendingCommunityEditRequestsCount() {
    const result = await storage()
        .select({ count: count() })
        .from(communityEditRequests)
        .where(eq(communityEditRequests.status, 'pending'));

    return result[0]?.count ?? 0;
}

export function getCommunityEditRequest(id: number) {
    return storage().query.communityEditRequests.findFirst({
        where: eq(communityEditRequests.id, id),
        with: {
            changes: {
                with: {
                    attributeDefinition: true,
                },
                orderBy: [asc(communityEditRequestChanges.id)],
            },
        },
    });
}

function assertReviewableStatus(request: SelectCommunityEditRequest) {
    if (request.status !== 'pending' && request.status !== 'approved') {
        throw new CommunityEditRequestError(
            'invalid_state',
            `Request ${request.id} cannot be reviewed from status ${request.status}.`,
        );
    }
}

export async function rejectCommunityEditRequest(input: {
    id: number;
    reviewer: CommunityEditActor;
    reviewerNote?: string | null;
}) {
    const request = await getCommunityEditRequest(input.id);
    if (!request) {
        throw new CommunityEditRequestError(
            'not_found',
            `Request ${input.id} was not found.`,
        );
    }
    assertReviewableStatus(request);

    const [updated] = await storage()
        .update(communityEditRequests)
        .set({
            status: 'rejected',
            reviewerUserId: input.reviewer.id,
            reviewerName: input.reviewer.name,
            reviewerNote: input.reviewerNote,
            reviewedAt: new Date(),
        })
        .where(eq(communityEditRequests.id, input.id))
        .returning();

    return updated;
}

export async function markCommunityEditRequestConflicted(input: {
    id: number;
    reviewer?: CommunityEditActor;
    reason: string;
}) {
    const [updated] = await storage()
        .update(communityEditRequests)
        .set({
            status: 'conflicted',
            reviewerUserId: input.reviewer?.id,
            reviewerName: input.reviewer?.name,
            applicationFailureReason: input.reason,
            reviewedAt: new Date(),
        })
        .where(eq(communityEditRequests.id, input.id))
        .returning();

    return updated;
}

function parseMultipleProposedValue(value: string | null) {
    if (!value) {
        return [];
    }

    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
        throw new CommunityEditRequestError(
            'invalid_value',
            'Multiple attribute changes must store an array value.',
        );
    }

    return parsed.map((entry) => (entry === null ? null : String(entry)));
}

function parseCommunityOperationSuggestion(
    value: string | null,
): CommunityOperationSuggestionValue | null {
    if (!value) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(value);
        if (
            !isRecord(parsed) ||
            parsed.format !== 'community-operation-suggestion-v1' ||
            (parsed.intent !== 'add' && parsed.intent !== 'remove') ||
            typeof parsed.operationLabel !== 'string' ||
            !isPlantStageName(parsed.stageName) ||
            typeof parsed.stageLabel !== 'string' ||
            (parsed.currentState !== 'absent' &&
                parsed.currentState !== 'present') ||
            ('note' in parsed &&
                typeof parsed.note !== 'undefined' &&
                typeof parsed.note !== 'string') ||
            ('source' in parsed &&
                typeof parsed.source !== 'undefined' &&
                typeof parsed.source !== 'string')
        ) {
            return null;
        }

        const operationMode =
            parsed.operationMode === 'new'
                ? 'new'
                : parsed.operationMode === 'existing' ||
                    typeof parsed.operationMode === 'undefined'
                  ? 'existing'
                  : null;
        if (!operationMode) {
            return null;
        }

        if (operationMode === 'new') {
            if (
                parsed.intent !== 'add' ||
                parsed.currentState !== 'absent' ||
                typeof parsed.newOperationName !== 'string' ||
                typeof parsed.newOperationDescription !== 'string'
            ) {
                return null;
            }

            const suggestion: CommunityOperationSuggestionValue = {
                format: 'community-operation-suggestion-v1',
                intent: parsed.intent,
                operationMode,
                operationLabel: parsed.operationLabel,
                stageName: parsed.stageName,
                stageLabel: parsed.stageLabel,
                currentState: parsed.currentState,
                newOperationName: parsed.newOperationName,
                newOperationDescription: parsed.newOperationDescription,
            };
            if (typeof parsed.note === 'string') {
                suggestion.note = parsed.note;
            }
            if (typeof parsed.source === 'string') {
                suggestion.source = parsed.source;
            }

            return suggestion;
        }

        if (
            typeof parsed.operationId !== 'number' ||
            !Number.isInteger(parsed.operationId)
        ) {
            return null;
        }

        const suggestion: CommunityOperationSuggestionValue = {
            format: 'community-operation-suggestion-v1',
            intent: parsed.intent,
            operationMode,
            operationId: parsed.operationId,
            operationLabel: parsed.operationLabel,
            stageName: parsed.stageName,
            stageLabel: parsed.stageLabel,
            currentState: parsed.currentState,
        };
        if (typeof parsed.note === 'string') {
            suggestion.note = parsed.note;
        }
        if (typeof parsed.source === 'string') {
            suggestion.source = parsed.source;
        }

        return suggestion;
    } catch {
        return null;
    }
}

async function getCurrentPersistedValues(
    db: DatabaseClient,
    entityId: number,
    attributeDefinitionId: number,
) {
    return db.query.attributeValues.findMany({
        where: and(
            eq(attributeValues.entityId, entityId),
            eq(attributeValues.attributeDefinitionId, attributeDefinitionId),
            eq(attributeValues.isDeleted, false),
        ),
        orderBy: [asc(attributeValues.order), asc(attributeValues.id)],
    });
}

async function applySingleChange(input: {
    db: DatabaseClient;
    sideEffects: ReturnType<typeof createAttributeValueMutationSideEffects>;
    entityTypeName: string;
    entityId: number;
    attributeDefinitionId: number;
    attributeValueId: number | null;
    proposedValue: string | null;
    actor: CommunityEditActor;
}) {
    await upsertAttributeValue(
        {
            id: input.attributeValueId ?? undefined,
            attributeDefinitionId: input.attributeDefinitionId,
            entityTypeName: input.entityTypeName,
            entityId: input.entityId,
            value: input.proposedValue,
        },
        {
            id: input.actor.id,
            name: input.actor.name ?? undefined,
        },
        {
            db: input.db,
            sideEffects: input.sideEffects,
        },
    );
}

async function applyMultipleChange(input: {
    db: DatabaseClient;
    sideEffects: ReturnType<typeof createAttributeValueMutationSideEffects>;
    entityTypeName: string;
    entityId: number;
    attributeDefinitionId: number;
    proposedValue: string | null;
    actor: CommunityEditActor;
}) {
    const proposedValues = parseMultipleProposedValue(input.proposedValue);
    const currentValues = await getCurrentPersistedValues(
        input.db,
        input.entityId,
        input.attributeDefinitionId,
    );

    for (const [index, proposedValue] of proposedValues.entries()) {
        await upsertAttributeValue(
            {
                id: currentValues[index]?.id,
                attributeDefinitionId: input.attributeDefinitionId,
                entityTypeName: input.entityTypeName,
                entityId: input.entityId,
                value: proposedValue,
                order: String(index),
            },
            {
                id: input.actor.id,
                name: input.actor.name ?? undefined,
            },
            {
                db: input.db,
                sideEffects: input.sideEffects,
            },
        );
    }

    for (const extraValue of currentValues.slice(proposedValues.length)) {
        await deleteAttributeValue(
            extraValue.id,
            {
                id: input.actor.id,
                name: input.actor.name ?? undefined,
            },
            {
                db: input.db,
                sideEffects: input.sideEffects,
            },
        );
    }
}

async function applyOperationSuggestionChange(input: {
    db: DatabaseClient;
    sideEffects: ReturnType<typeof createAttributeValueMutationSideEffects>;
    entityTypeName: string;
    entityId: number;
    attributeDefinitionId: number;
    proposedValue: string | null;
    actor: CommunityEditActor;
}) {
    const suggestion = parseCommunityOperationSuggestion(input.proposedValue);
    if (!suggestion) {
        throw new CommunityEditRequestError(
            'invalid_value',
            'Operation suggestion change is not valid.',
        );
    }
    if (suggestion.operationMode === 'new') {
        return;
    }

    const currentValues = await getCurrentPersistedValues(
        input.db,
        input.entityId,
        input.attributeDefinitionId,
    );
    const operationValue = String(suggestion.operationId);
    const existingValue = currentValues.find(
        (value) => value.value === operationValue,
    );

    if (suggestion.intent === 'add') {
        if (existingValue) {
            return;
        }

        await resolveOperationSuggestionTarget({
            operationId: suggestion.operationId,
            stage: {
                name: suggestion.stageName,
                label: suggestion.stageLabel,
            },
        });
        await upsertAttributeValue(
            {
                attributeDefinitionId: input.attributeDefinitionId,
                entityTypeName: input.entityTypeName,
                entityId: input.entityId,
                value: operationValue,
                order: String(currentValues.length),
            },
            {
                id: input.actor.id,
                name: input.actor.name ?? undefined,
            },
            {
                db: input.db,
                sideEffects: input.sideEffects,
            },
        );
        return;
    }

    if (!existingValue) {
        return;
    }

    await deleteAttributeValue(
        existingValue.id,
        {
            id: input.actor.id,
            name: input.actor.name ?? undefined,
        },
        {
            db: input.db,
            sideEffects: input.sideEffects,
        },
    );
}

function resolveApplicableProposedValue(input: {
    field: CommunityEditableFieldDefinition;
    snapshot: CommunityEditableFieldSnapshot;
    change: {
        fieldKey: string;
        baseValueHash: string;
        proposedValue: string | null;
        valuePatch: string | null;
    };
}) {
    if (input.field.controlType === 'operationSuggestion') {
        if (!parseCommunityOperationSuggestion(input.change.proposedValue)) {
            return {
                proposedValue: null,
                conflictReason: `Field ${input.change.fieldKey} has an invalid operation suggestion payload.`,
            };
        }

        return {
            proposedValue: input.change.proposedValue,
            conflictReason: null,
        };
    }

    if (input.snapshot.baseValueHash === input.change.baseValueHash) {
        return {
            proposedValue: input.change.proposedValue,
            conflictReason: null,
        };
    }

    if (input.snapshot.currentValue === input.change.proposedValue) {
        return {
            proposedValue: input.change.proposedValue,
            conflictReason: null,
        };
    }

    if (supportsTextPatch(input.field.controlType, input.snapshot.multiple)) {
        const patchedValue = applyTextValuePatch(
            input.change.valuePatch,
            input.snapshot.currentValue ?? '',
        );
        if (patchedValue !== null) {
            return {
                proposedValue: normalizeTextValue(patchedValue, input.field),
                conflictReason: null,
            };
        }
    }

    return {
        proposedValue: null,
        conflictReason: `Field ${input.change.fieldKey} changed after the request was submitted and its patch could not be applied cleanly.`,
    };
}

export async function approveCommunityEditRequest(input: {
    id: number;
    reviewer: CommunityEditActor;
    reviewerNote?: string | null;
}) {
    const request = await getCommunityEditRequest(input.id);
    if (!request) {
        throw new CommunityEditRequestError(
            'not_found',
            `Request ${input.id} was not found.`,
        );
    }
    assertReviewableStatus(request);

    const entity = await getCommunityEditableEntity(
        request.entityTypeName,
        request.entityId,
    );

    const preparedChanges: {
        change: (typeof request.changes)[number];
        field: CommunityEditableFieldDefinition;
        attributeValueId: number | null;
        proposedValue: string | null;
    }[] = [];
    for (const change of request.changes) {
        const field = getCommunityEditableFieldDefinition(
            request.entityTypeName,
            change.fieldKey,
        );
        if (!field) {
            throw new CommunityEditRequestError(
                'invalid_field',
                `Field ${change.fieldKey} is not editable for ${request.entityTypeName}.`,
            );
        }

        const snapshot = resolveFieldSnapshot(entity, field);
        let applicationValue: ReturnType<typeof resolveApplicableProposedValue>;
        try {
            applicationValue = resolveApplicableProposedValue({
                field,
                snapshot,
                change,
            });
        } catch (error) {
            applicationValue = {
                proposedValue: null,
                conflictReason:
                    error instanceof Error ? error.message : String(error),
            };
        }

        if (applicationValue.conflictReason) {
            await markCommunityEditRequestConflicted({
                id: request.id,
                reviewer: input.reviewer,
                reason: applicationValue.conflictReason,
            });
            const conflicted = await getCommunityEditRequest(request.id);
            if (!conflicted) {
                throw new CommunityEditRequestError(
                    'not_found',
                    `Request ${request.id} was not found after conflict update.`,
                );
            }
            return conflicted;
        }

        preparedChanges.push({
            change,
            field,
            attributeValueId: snapshot.attributeValueId,
            proposedValue: applicationValue.proposedValue,
        });
    }

    const sideEffects = createAttributeValueMutationSideEffects();
    try {
        await storage().transaction(async (tx) => {
            await tx
                .update(communityEditRequests)
                .set({
                    status: 'approved',
                    reviewerUserId: input.reviewer.id,
                    reviewerName: input.reviewer.name,
                    reviewerNote: input.reviewerNote,
                    reviewedAt: new Date(),
                    applicationFailureReason: null,
                })
                .where(eq(communityEditRequests.id, request.id));

            for (const {
                change,
                field,
                attributeValueId,
                proposedValue,
            } of preparedChanges) {
                if (field.controlType === 'operationSuggestion') {
                    await applyOperationSuggestionChange({
                        db: tx,
                        sideEffects,
                        entityTypeName: request.entityTypeName,
                        entityId: request.entityId,
                        attributeDefinitionId: change.attributeDefinitionId,
                        proposedValue,
                        actor: input.reviewer,
                    });
                } else if (change.attributeDefinition.multiple) {
                    await applyMultipleChange({
                        db: tx,
                        sideEffects,
                        entityTypeName: request.entityTypeName,
                        entityId: request.entityId,
                        attributeDefinitionId: change.attributeDefinitionId,
                        proposedValue,
                        actor: input.reviewer,
                    });
                } else {
                    await applySingleChange({
                        db: tx,
                        sideEffects,
                        entityTypeName: request.entityTypeName,
                        entityId: request.entityId,
                        attributeDefinitionId: change.attributeDefinitionId,
                        attributeValueId,
                        proposedValue,
                        actor: input.reviewer,
                    });
                }
            }

            await tx
                .update(communityEditRequests)
                .set({
                    status: 'applied',
                    appliedAt: new Date(),
                    applicationFailureReason: null,
                })
                .where(eq(communityEditRequests.id, request.id));
        });
    } catch (error) {
        await markCommunityEditRequestConflicted({
            id: request.id,
            reviewer: input.reviewer,
            reason: error instanceof Error ? error.message : String(error),
        });
        const conflicted = await getCommunityEditRequest(request.id);
        if (!conflicted) {
            throw error;
        }
        return conflicted;
    }

    await flushAttributeValueMutationSideEffects(sideEffects);

    const applied = await getCommunityEditRequest(request.id);
    if (!applied) {
        throw new CommunityEditRequestError(
            'not_found',
            `Request ${request.id} was not found after applying.`,
        );
    }

    try {
        await evaluateCommunityEditAchievementsForSubmitter(
            applied.submitterUserId,
        );
    } catch (error) {
        console.error(
            'Failed to evaluate community edit achievements after approval',
            {
                requestId: applied.id,
                error,
            },
        );
    }

    return applied;
}
