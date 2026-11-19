import type { CommunityEditButtonProps } from './CommunityEditButton.types';
import type { ReferencePickerNoun } from './PlantReferencePicker';

export type CommunityEditControlType =
    | 'boolean'
    | 'json'
    | 'markdown'
    | 'number'
    | 'operationSuggestion'
    | 'range'
    | 'reference'
    | 'select'
    | 'text';

export type CommunityEditableFieldOption = {
    value: string;
    label: string;
    helpText?: string;
    description?: string;
    iconKey?: string;
};

export type CommunityEditableField = {
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
    options?: CommunityEditableFieldOption[];
    operationSuggestionStage?: {
        name: string;
        label: string;
    };
    currentValue: string | null;
    baseValueHash: string;
};

export type OperationSuggestionIntent = 'add' | 'remove';
export type OperationSuggestionMode = 'existing' | 'new';

export type OperationSuggestionFieldValue = {
    intent: OperationSuggestionIntent;
    operationMode: OperationSuggestionMode;
    operationId: string;
    newOperationName: string;
    newOperationDescription: string;
    note: string;
    source: string;
};

type OperationSuggestionSubmitValue = {
    intent: OperationSuggestionIntent;
    operationMode: OperationSuggestionMode;
    stageName: string;
    operationId?: number;
    newOperationName?: string | null;
    newOperationDescription?: string | null;
    note?: string | null;
    source?: string | null;
};

export type RangeFieldValue = {
    min: string;
    max: string;
};

export type FieldValue =
    | string
    | RangeFieldValue
    | OperationSuggestionFieldValue
    | null;

type SubmitValue =
    | string
    | string[]
    | {
          min: number;
          max: number;
      }
    | OperationSuggestionSubmitValue
    | null;

export type CommunityEditFieldGroup =
    | 'attributes'
    | 'content'
    | 'operations'
    | 'relationships';

export const communityEditFieldGroups = [
    'content',
    'relationships',
    'attributes',
    'operations',
] satisfies CommunityEditFieldGroup[];

export function communityEditFieldGroup(
    field: CommunityEditableField,
): CommunityEditFieldGroup {
    if (
        field.controlType === 'operationSuggestion' ||
        field.attributePath.startsWith('operations.')
    ) {
        return 'operations';
    }

    if (field.attributePath.startsWith('attributes.')) {
        return 'attributes';
    }

    if (field.attributePath.startsWith('relationships.')) {
        return 'relationships';
    }

    return 'content';
}

export function communityEditFieldGroupLabel(
    group: CommunityEditFieldGroup,
    entityTypeName: CommunityEditButtonProps['entityTypeName'],
) {
    switch (group) {
        case 'attributes':
            return 'Svojstva';
        case 'operations':
            return 'Radnje';
        case 'relationships':
            return entityTypeName === 'plantDisease' ||
                entityTypeName === 'plantPest'
                ? 'Pogođene biljke'
                : 'Biljni susjedi';
        case 'content':
            return 'Sadržaj';
    }
}

export const emptyOperationSuggestionValue: OperationSuggestionFieldValue = {
    intent: 'add',
    operationMode: 'existing',
    operationId: '',
    newOperationName: '',
    newOperationDescription: '',
    note: '',
    source: '',
};

export function initialFieldValue(field: CommunityEditableField): FieldValue {
    if (field.controlType === 'operationSuggestion') {
        return { ...emptyOperationSuggestionValue };
    }

    if (field.controlType === 'range') {
        if (!field.currentValue) {
            return { min: '', max: '' };
        }

        try {
            const parsed: unknown = JSON.parse(field.currentValue);
            if (
                typeof parsed === 'object' &&
                parsed !== null &&
                'min' in parsed &&
                'max' in parsed
            ) {
                return {
                    min:
                        typeof parsed.min === 'number'
                            ? String(parsed.min)
                            : '',
                    max:
                        typeof parsed.max === 'number'
                            ? String(parsed.max)
                            : '',
                };
            }
        } catch {
            return { min: '', max: '' };
        }
    }

    if (field.controlType === 'reference' && field.multiple) {
        return referenceListTextFromCurrentValue(field.currentValue);
    }

    return field.currentValue ?? '';
}

export function isOperationSuggestionValue(
    value: FieldValue,
): value is OperationSuggestionFieldValue {
    return (
        typeof value === 'object' &&
        value !== null &&
        'intent' in value &&
        (value.intent === 'add' || value.intent === 'remove') &&
        'operationMode' in value &&
        (value.operationMode === 'existing' || value.operationMode === 'new') &&
        'operationId' in value &&
        typeof value.operationId === 'string' &&
        'newOperationName' in value &&
        typeof value.newOperationName === 'string' &&
        'newOperationDescription' in value &&
        typeof value.newOperationDescription === 'string'
    );
}

export function isRangeFieldValue(value: FieldValue): value is RangeFieldValue {
    return (
        typeof value === 'object' &&
        value !== null &&
        !isOperationSuggestionValue(value)
    );
}

function operationIdsFromCurrentValue(field: CommunityEditableField) {
    if (!field.currentValue) {
        return new Set<string>();
    }

    try {
        const parsed: unknown = JSON.parse(field.currentValue);
        if (!Array.isArray(parsed)) {
            return new Set<string>();
        }

        return new Set(
            parsed
                .filter(
                    (entry): entry is string | number =>
                        typeof entry === 'string' || typeof entry === 'number',
                )
                .map(String),
        );
    } catch {
        return new Set<string>();
    }
}

function operationSuggestionOptionsForIntent(
    field: CommunityEditableField,
    intent: OperationSuggestionIntent,
) {
    const currentOperationIds = operationIdsFromCurrentValue(field);
    return (field.options ?? []).filter((option) =>
        intent === 'add'
            ? !currentOperationIds.has(option.value)
            : currentOperationIds.has(option.value),
    );
}

export function currentOperationOptions(field: CommunityEditableField) {
    return operationSuggestionOptionsForIntent(field, 'remove');
}

export function availableOperationOptions(field: CommunityEditableField) {
    return operationSuggestionOptionsForIntent(field, 'add');
}

function referenceListTextFromCurrentValue(value: string | null) {
    if (!value) {
        return '';
    }

    try {
        const parsed: unknown = JSON.parse(value);
        if (!Array.isArray(parsed)) {
            return value;
        }

        return parsed
            .filter(
                (entry): entry is string | number =>
                    typeof entry === 'string' || typeof entry === 'number',
            )
            .map(String)
            .join('\n');
    } catch {
        return value;
    }
}

export function referenceListFromText(value: string) {
    return value
        .split(/[\s,;]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);
}

/**
 * Fields that would need a raw record ID or raw JSON cannot be edited in the
 * public dialog. They are shown as a notice and never count as changed.
 */
export function isFieldEditableHere(field: CommunityEditableField) {
    if (field.controlType === 'json') {
        return false;
    }

    if (field.controlType === 'reference') {
        return field.multiple && Boolean(field.options);
    }

    return true;
}

/** Validation message for a field value, or `null` when it can be sent. */
export function fieldValueError(
    field: CommunityEditableField,
    value: FieldValue,
) {
    if (field.controlType !== 'range' || !isRangeFieldValue(value)) {
        return null;
    }

    const min = value.min.trim();
    const max = value.max.trim();
    if (!min && !max) {
        return null;
    }

    const minNumber = Number.parseFloat(min);
    const maxNumber = Number.parseFloat(max);
    if (
        !min ||
        !max ||
        !Number.isFinite(minNumber) ||
        !Number.isFinite(maxNumber)
    ) {
        return 'Upiši i najmanju i najveću vrijednost.';
    }

    if (minNumber > maxNumber) {
        return 'Najmanja vrijednost ne može biti veća od najveće.';
    }

    return null;
}

export function serializeFieldValue(
    field: CommunityEditableField,
    value: FieldValue,
): { comparisonValue: string | null; submitValue: SubmitValue } {
    if (field.controlType === 'operationSuggestion') {
        if (!isOperationSuggestionValue(value)) {
            return {
                comparisonValue: field.currentValue,
                submitValue: null,
            };
        }

        const stageName =
            field.operationSuggestionStage?.name ?? field.sectionKey;
        const note = value.note.trim() || null;
        const source = value.source.trim() || null;

        if (value.intent === 'remove') {
            const operationId = Number.parseInt(value.operationId, 10);
            const selectedOption = currentOperationOptions(field).some(
                (option) => option.value === value.operationId,
            );
            if (!Number.isInteger(operationId) || !selectedOption) {
                return {
                    comparisonValue: field.currentValue,
                    submitValue: null,
                };
            }

            const submitValue: OperationSuggestionSubmitValue = {
                intent: value.intent,
                operationMode: 'existing',
                operationId,
                stageName,
                note,
                source,
            };

            return {
                comparisonValue: JSON.stringify(submitValue),
                submitValue,
            };
        }

        if (value.operationMode === 'new') {
            const newOperationName = value.newOperationName.trim();
            const newOperationDescription =
                value.newOperationDescription.trim();
            if (!newOperationName || !newOperationDescription) {
                return {
                    comparisonValue: field.currentValue,
                    submitValue: null,
                };
            }

            const submitValue: OperationSuggestionSubmitValue = {
                intent: value.intent,
                operationMode: value.operationMode,
                stageName,
                newOperationName,
                newOperationDescription,
                note,
                source,
            };

            return {
                comparisonValue: JSON.stringify(submitValue),
                submitValue,
            };
        }

        const operationId = Number.parseInt(value.operationId, 10);
        const selectedOption = availableOperationOptions(field).some(
            (option) => option.value === value.operationId,
        );
        if (!Number.isInteger(operationId) || !selectedOption) {
            return {
                comparisonValue: field.currentValue,
                submitValue: null,
            };
        }

        const submitValue: OperationSuggestionSubmitValue = {
            intent: value.intent,
            operationMode: value.operationMode,
            operationId,
            stageName,
            note,
            source,
        };

        return {
            comparisonValue: JSON.stringify(submitValue),
            submitValue,
        };
    }

    if (field.controlType === 'range') {
        if (!isRangeFieldValue(value)) {
            return { comparisonValue: null, submitValue: null };
        }

        if (!value.min.trim() && !value.max.trim()) {
            return { comparisonValue: null, submitValue: null };
        }

        const rangeValue = {
            min: Number.parseFloat(value.min),
            max: Number.parseFloat(value.max),
        };

        return {
            comparisonValue: JSON.stringify(rangeValue),
            submitValue: rangeValue,
        };
    }

    const textValue = typeof value === 'string' ? value : '';
    if (field.controlType === 'reference' && field.multiple) {
        const references = referenceListFromText(textValue);
        return {
            comparisonValue: JSON.stringify(references),
            submitValue: references,
        };
    }

    if (!textValue.length) {
        return { comparisonValue: null, submitValue: null };
    }

    return {
        comparisonValue: textValue,
        submitValue: textValue,
    };
}

/**
 * True when the value differs from the published one and can be sent: fields
 * that cannot be edited here and invalid values never count as changed.
 */
export function fieldChanged(field: CommunityEditableField, value: FieldValue) {
    if (!isFieldEditableHere(field) || fieldValueError(field, value)) {
        return false;
    }

    return (
        serializeFieldValue(field, value).comparisonValue !== field.currentValue
    );
}

export function fieldInputId(prefix: string, field: CommunityEditableField) {
    return `${prefix}-${field.fieldKey.replace(/[^a-z0-9_-]/giu, '-')}`;
}

function isCommunityEditableField(
    value: unknown,
): value is CommunityEditableField {
    return (
        typeof value === 'object' &&
        value !== null &&
        'fieldKey' in value &&
        typeof value.fieldKey === 'string' &&
        'attributePath' in value &&
        typeof value.attributePath === 'string' &&
        'publicLabel' in value &&
        typeof value.publicLabel === 'string' &&
        'controlType' in value &&
        typeof value.controlType === 'string' &&
        'currentValue' in value &&
        (typeof value.currentValue === 'string' ||
            value.currentValue === null) &&
        'baseValueHash' in value &&
        typeof value.baseValueHash === 'string' &&
        (!('options' in value) ||
            value.options === undefined ||
            (Array.isArray(value.options) &&
                value.options.every(
                    (option) =>
                        typeof option === 'object' &&
                        option !== null &&
                        'value' in option &&
                        typeof option.value === 'string' &&
                        'label' in option &&
                        typeof option.label === 'string' &&
                        (!('description' in option) ||
                            typeof option.description === 'undefined' ||
                            typeof option.description === 'string') &&
                        (!('iconKey' in option) ||
                            typeof option.iconKey === 'undefined' ||
                            typeof option.iconKey === 'string'),
                )))
    );
}

export function isFieldsResponse(
    value: unknown,
): value is { fields: CommunityEditableField[] } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'fields' in value &&
        Array.isArray(value.fields) &&
        value.fields.every(isCommunityEditableField)
    );
}

export function referencePickerNoun(dataType: string): ReferencePickerNoun {
    if (dataType === 'ref:plant') {
        return {
            nominative: 'Biljka',
            accusative: 'biljku',
            accusativePlural: 'biljke',
            genitivePlural: 'biljaka',
        };
    }
    if (dataType === 'ref:operation') {
        return {
            nominative: 'Radnja',
            accusative: 'radnju',
            accusativePlural: 'radnje',
            genitivePlural: 'radnji',
        };
    }
    return {
        nominative: 'Zapis',
        accusative: 'zapis',
        accusativePlural: 'zapise',
        genitivePlural: 'zapisa',
    };
}

/** Croatian plural for a number of changes: 1 izmjena, 2 izmjene, 5 izmjena. */
/**
 * Most changes one request may carry. Mirrors the `changes` cap of
 * `POST /api/directories/community-edits`; keep the two in step.
 */
export const maxCommunityEditChanges = 20;

export function changeCountLabel(count: number) {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;
    const few =
        lastDigit >= 2 &&
        lastDigit <= 4 &&
        !(lastTwoDigits >= 12 && lastTwoDigits <= 14);
    return `${count.toString()} ${few ? 'izmjene' : 'izmjena'}`;
}
