import 'server-only';

import {
    type EntityStandardized,
    entityRevisions,
    getAttributeDefinitions,
    getEntitiesFormatted,
    type SelectEntityRevision,
    storage,
} from '@gredice/storage';
import { and, desc, eq, gte } from 'drizzle-orm';

export type FarmerDocumentationChangeType = 'insert' | 'replace' | 'discard';

export type FarmerDocumentationOperation = {
    id: number;
    code: string;
    label: string;
    name: string | null;
    description: string | null;
    instructions: string | null;
    durationLabel: string;
    photoProofLabel: string;
    attributes: FarmerDocumentationAttribute[];
    changedAt: Date | null;
    changeType: Exclude<FarmerDocumentationChangeType, 'discard'>;
    revisionActions: string[];
};

export type FarmerDocumentationAttribute = {
    label: string;
    value: string;
};

export type FarmerDocumentationDiscard = {
    entityId: number;
    code: string;
    label: string;
    changedAt: Date;
    revisionActions: string[];
};

export type FarmerDocumentationPackage = {
    since: Date | null;
    generatedAt: Date;
    totalOperations: number;
    includedOperations: FarmerDocumentationOperation[];
    discardedOperations: FarmerDocumentationDiscard[];
};

export type FarmerDocumentationRevision = Pick<
    SelectEntityRevision,
    | 'id'
    | 'entityId'
    | 'entityTypeName'
    | 'action'
    | 'actorName'
    | 'attributeDefinitionId'
    | 'previousValue'
    | 'nextValue'
    | 'previousState'
    | 'nextState'
    | 'createdAt'
>;

const operationAttributeLabels: Record<string, string> = {
    application: 'Primjena',
    deliverable: 'Isporuka',
    frequency: 'Ucestalost',
    internal: 'Interno',
    printLabel: 'Ispis etikete',
    relativeDays: 'Relativni dani',
    stage: 'Faza',
};

const operationAttributeValueLabels: Record<string, Record<string, string>> = {
    application: {
        raisedBed: 'Gredica',
        raisedBedField: 'Polje gredice',
        raisedBedFull: 'Cijela gredica',
    },
    frequency: {
        once: 'Jednom',
        optional: 'Po potrebi',
        recurring: 'Ponavljajuce',
        required: 'Obavezno',
    },
};

const revisionActionLabels: Record<string, string> = {
    'attribute.created': 'dodani podaci',
    'attribute.deleted': 'uklonjeni podaci',
    'attribute.updated': 'promijenjeni podaci',
    'entity.created': 'nova radnja',
    'entity.deleted': 'obrisana radnja',
    'entity.state_changed': 'promijenjen status',
    'entity.updated': 'azurirana radnja',
};

export function getFarmerDocumentationCode(entityId: number) {
    return `OP-${entityId.toString().padStart(4, '0')}`;
}

export function getFarmerAppOrigin() {
    const configured = process.env.NEXT_PUBLIC_GREDICE_FARM_ORIGIN?.trim();
    return (configured || 'https://farma.gredice.com').replace(/\/+$/, '');
}

export function parseDocumentationSince(value: string | undefined) {
    const normalized = value?.trim();
    if (!normalized) {
        return null;
    }

    const isDate = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
    const isDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized);
    const isIsoDateTime =
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?$/.test(normalized);

    if (!isDate && !isDateTime && !isIsoDateTime) {
        return null;
    }

    const parsed = new Date(isDate ? `${normalized}T00:00:00` : normalized);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed;
}

export function formatDocumentationDateTime(date: Date | null) {
    if (!date) {
        return 'Nije odabrano';
    }

    return new Intl.DateTimeFormat('hr-HR', {
        timeZone: 'Europe/Zagreb',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

export function documentationChangeLabel(type: FarmerDocumentationChangeType) {
    switch (type) {
        case 'insert':
            return 'Umetni';
        case 'replace':
            return 'Zamijeni';
        case 'discard':
            return 'Ukloni';
    }
}

export async function getFarmerDocumentationPackage({
    since,
}: {
    since: Date | null;
}): Promise<FarmerDocumentationPackage> {
    const [operations, revisions, attributeDefinitions] = await Promise.all([
        getEntitiesFormatted<EntityStandardized>('operation').catch(
            (): EntityStandardized[] => [],
        ),
        getOperationRevisionsSince(since),
        getAttributeDefinitions('operation').catch(() => []),
    ]);

    return buildFarmerDocumentationPackage({
        operations,
        revisions,
        labelAttributeDefinitionIds: new Set(
            attributeDefinitions
                .filter(
                    (definition) =>
                        definition.category === 'information' &&
                        (definition.name === 'label' ||
                            definition.name === 'name'),
                )
                .map((definition) => definition.id),
        ),
        generatedAt: new Date(),
        since,
    });
}

export function buildFarmerDocumentationPackage({
    generatedAt,
    labelAttributeDefinitionIds,
    operations,
    revisions,
    since,
}: {
    generatedAt: Date;
    labelAttributeDefinitionIds: ReadonlySet<number>;
    operations: EntityStandardized[];
    revisions: FarmerDocumentationRevision[];
    since: Date | null;
}): FarmerDocumentationPackage {
    const sortedOperations = [...operations].sort(
        (left, right) => left.id - right.id,
    );
    const currentOperationIds = new Set(
        sortedOperations.map((operation) => operation.id),
    );
    const revisionsByEntityId = groupRevisionsByEntityId(revisions);
    const includedOperations = sortedOperations
        .filter((operation) => !since || revisionsByEntityId.has(operation.id))
        .map((operation) =>
            toDocumentationOperation(
                operation,
                revisionsByEntityId.get(operation.id) ?? [],
                since,
            ),
        );
    const discardedOperations = Array.from(revisionsByEntityId.entries())
        .filter(([entityId]) => !currentOperationIds.has(entityId))
        .filter(([, entityRevisions]) =>
            entityRevisions.some(isDiscardRevision),
        )
        .map(([entityId, entityRevisions]) => ({
            entityId,
            code: getFarmerDocumentationCode(entityId),
            label: revisionEntityLabel(
                entityId,
                entityRevisions,
                labelAttributeDefinitionIds,
            ),
            changedAt: latestRevisionDate(entityRevisions),
            revisionActions: revisionActionSummary(entityRevisions),
        }))
        .sort((left, right) => left.entityId - right.entityId);

    return {
        since,
        generatedAt,
        totalOperations: sortedOperations.length,
        includedOperations,
        discardedOperations,
    };
}

function getOperationRevisionsSince(since: Date | null) {
    if (!since) {
        return Promise.resolve<FarmerDocumentationRevision[]>([]);
    }

    return storage().query.entityRevisions.findMany({
        columns: {
            id: true,
            entityId: true,
            entityTypeName: true,
            action: true,
            actorName: true,
            attributeDefinitionId: true,
            previousValue: true,
            nextValue: true,
            previousState: true,
            nextState: true,
            createdAt: true,
        },
        where: and(
            eq(entityRevisions.entityTypeName, 'operation'),
            gte(entityRevisions.createdAt, since),
        ),
        orderBy: (revisions) => [desc(revisions.createdAt), desc(revisions.id)],
    });
}

function groupRevisionsByEntityId(revisions: FarmerDocumentationRevision[]) {
    const grouped = new Map<number, FarmerDocumentationRevision[]>();

    for (const revision of revisions) {
        const entityRevisions = grouped.get(revision.entityId) ?? [];
        entityRevisions.push(revision);
        grouped.set(revision.entityId, entityRevisions);
    }

    return grouped;
}

function toDocumentationOperation(
    operation: EntityStandardized,
    revisions: FarmerDocumentationRevision[],
    since: Date | null,
): FarmerDocumentationOperation {
    return {
        id: operation.id,
        code: getFarmerDocumentationCode(operation.id),
        label: getOperationLabel(operation),
        name: operation.information?.name ?? null,
        description: operation.information?.description?.trim() || null,
        instructions: operation.information?.instructions?.trim() || null,
        durationLabel: operationDurationLabel(operation),
        photoProofLabel: operationPhotoProofLabel(operation),
        attributes: operationAttributes(operation),
        changedAt: revisions.length > 0 ? latestRevisionDate(revisions) : null,
        changeType: isInsertOperation(revisions, since) ? 'insert' : 'replace',
        revisionActions: revisionActionSummary(revisions),
    };
}

function getOperationLabel(operation: EntityStandardized) {
    return (
        operation.information?.label?.trim() ||
        operation.information?.name?.trim() ||
        `Radnja #${operation.id}`
    );
}

function operationDurationLabel(operation: EntityStandardized) {
    const duration = operation.attributes?.duration;
    const minutes =
        typeof duration === 'number'
            ? duration
            : typeof duration === 'string'
              ? Number.parseInt(duration, 10)
              : 0;

    if (!Number.isFinite(minutes) || minutes <= 0) {
        return 'Nije definirano';
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours > 0 && remainingMinutes > 0) {
        return `${hours} h ${remainingMinutes} min`;
    }
    if (hours > 0) {
        return `${hours} h`;
    }
    return `${minutes} min`;
}

function operationPhotoProofLabel(operation: EntityStandardized) {
    if (!operation.conditions?.completionAttachImages) {
        return 'Nije potrebno';
    }

    return operation.conditions.completionAttachImagesRequired
        ? 'Obavezno priloziti fotografije'
        : 'Preporuceno priloziti fotografije';
}

function operationAttributes(operation: EntityStandardized) {
    return Object.entries(operation.attributes ?? {})
        .filter(
            ([attributeName, attributeValue]) =>
                attributeName !== 'duration' &&
                attributeValue !== null &&
                attributeValue !== undefined,
        )
        .map(([attributeName, attributeValue]) => ({
            label: formatAttributeLabel(attributeName),
            value: formatAttributeValue(attributeValue, attributeName),
        }))
        .filter(
            (attribute): attribute is FarmerDocumentationAttribute =>
                attribute.value !== null,
        );
}

function formatAttributeLabel(attributeName: string) {
    return (
        operationAttributeLabels[attributeName] ??
        attributeName
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/^./, (value) => value.toUpperCase())
    );
}

function formatAttributeValue(value: unknown, attributeName: string) {
    if (typeof value === 'boolean') {
        return value ? 'Da' : 'Ne';
    }

    if (typeof value === 'number') {
        return value.toLocaleString('hr-HR');
    }

    if (typeof value === 'string') {
        return operationAttributeValueLabels[attributeName]?.[value] ?? value;
    }

    if (value && typeof value === 'object') {
        const information = Reflect.get(value, 'information');
        if (information && typeof information === 'object') {
            const label = Reflect.get(information, 'label');
            const name = Reflect.get(information, 'name');
            if (typeof label === 'string' && label.trim()) {
                return label;
            }
            if (typeof name === 'string' && name.trim()) {
                return name;
            }
        }
    }

    return null;
}

function isInsertOperation(
    revisions: FarmerDocumentationRevision[],
    since: Date | null,
) {
    if (!since) {
        return false;
    }

    return revisions.some(
        (revision) =>
            revision.action === 'entity.created' ||
            (revision.action === 'entity.state_changed' &&
                revision.nextState === 'published' &&
                revision.previousState !== 'published'),
    );
}

function isDiscardRevision(revision: FarmerDocumentationRevision) {
    return (
        revision.action === 'entity.deleted' ||
        (revision.action === 'entity.state_changed' &&
            revision.previousState === 'published' &&
            revision.nextState !== 'published')
    );
}

function revisionEntityLabel(
    entityId: number,
    revisions: FarmerDocumentationRevision[],
    labelAttributeDefinitionIds: ReadonlySet<number>,
) {
    for (const revision of revisions) {
        if (
            revision.attributeDefinitionId &&
            labelAttributeDefinitionIds.has(revision.attributeDefinitionId)
        ) {
            const label = revision.nextValue || revision.previousValue;
            if (label?.trim()) {
                return label;
            }
        }
    }

    return `Radnja #${entityId}`;
}

function latestRevisionDate(revisions: FarmerDocumentationRevision[]) {
    return revisions.reduce(
        (latest, revision) =>
            revision.createdAt > latest ? revision.createdAt : latest,
        revisions[0]?.createdAt ?? new Date(0),
    );
}

function revisionActionSummary(revisions: FarmerDocumentationRevision[]) {
    return Array.from(
        new Set(
            revisions.map(
                (revision) =>
                    revisionActionLabels[revision.action] ?? revision.action,
            ),
        ),
    );
}
