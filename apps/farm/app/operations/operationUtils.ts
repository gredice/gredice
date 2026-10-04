import type { EntityStandardized } from '@gredice/storage';

const attributeLabels: Record<string, string> = {
    application: 'Primjena',
    appliesToAllTargets: 'Primjenjivo na sve ciljeve',
    deliverable: 'Isporuka',
    frequency: 'Učestalost',
    internal: 'Interno',
    printLabel: 'Ispis etikete',
    stage: 'Faza',
};

const attributeValueLabels: Record<string, Record<string, string>> = {
    application: {
        raisedBed: 'Gredica',
        raisedBedField: 'Polje gredice',
        raisedBedFull: 'Cijela gredica',
    },
    frequency: {
        once: 'Jednom',
        optional: 'Po potrebi',
        recurring: 'Ponavljajuće',
        required: 'Obavezno',
    },
};

export function formatAttributeLabel(attributeName: string) {
    return (
        attributeLabels[attributeName] ??
        attributeName
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/^./, (value) => value.toUpperCase())
    );
}

export function formatAttributeValue(value: unknown, attributeName?: string) {
    if (typeof value === 'boolean') {
        return value ? 'Da' : 'Ne';
    }

    if (typeof value === 'number') {
        return value.toLocaleString('hr-HR');
    }

    if (typeof value === 'string') {
        return attributeName
            ? (attributeValueLabels[attributeName]?.[value] ?? value)
            : value;
    }

    if (
        value &&
        typeof value === 'object' &&
        'information' in value &&
        value.information &&
        typeof value.information === 'object' &&
        'label' in value.information &&
        typeof value.information.label === 'string'
    ) {
        return value.information.label;
    }

    return null;
}

export function getOperationLabel(operation: EntityStandardized) {
    return (
        operation.information?.label ??
        operation.information?.name ??
        `Radnja #${operation.id}`
    );
}

export function getOperationSearchText(operation: EntityStandardized) {
    return [
        operation.information?.label,
        operation.information?.name,
        operation.information?.shortDescription,
        operation.information?.description,
        operation.information?.instructions,
    ]
        .filter((value) => typeof value === 'string')
        .join(' ')
        .toLocaleLowerCase('hr-HR');
}
