import assert from 'node:assert/strict';
import test from 'node:test';
import type { EntityStandardized } from '@gredice/storage';
import {
    buildFarmerDocumentationPackage,
    type FarmerDocumentationRevision,
} from './farmerDocumentationData';
import { generateFarmerDocumentationPdf } from './farmerDocumentationPdf';

const generatedAt = new Date('2026-06-13T10:00:00.000Z');
const since = new Date('2026-06-01T00:00:00.000Z');

test('builds insert, replace, and discard instructions from operation revisions', () => {
    const documentationPackage = buildFarmerDocumentationPackage({
        generatedAt,
        since,
        labelAttributeDefinitionIds: new Set([10]),
        operations: [
            operationFixture(4, 'Zalijevanje', {
                duration: 25,
                application: 'raisedBedFull',
            }),
            operationFixture(8, 'Čišćenje gredice', {
                duration: 40,
                frequency: 'required',
            }),
        ],
        revisions: [
            revisionFixture({
                id: 1,
                entityId: 4,
                action: 'attribute.updated',
                createdAt: new Date('2026-06-08T12:00:00.000Z'),
            }),
            revisionFixture({
                id: 2,
                entityId: 8,
                action: 'entity.created',
                createdAt: new Date('2026-06-09T12:00:00.000Z'),
            }),
            revisionFixture({
                id: 3,
                entityId: 11,
                action: 'attribute.updated',
                attributeDefinitionId: 10,
                previousValue: 'Stara radnja',
                nextValue: 'Stara radnja',
                createdAt: new Date('2026-06-10T12:00:00.000Z'),
            }),
            revisionFixture({
                id: 4,
                entityId: 11,
                action: 'entity.deleted',
                previousState: 'published',
                nextState: 'published',
                createdAt: new Date('2026-06-10T12:30:00.000Z'),
            }),
        ],
    });

    assert.equal(documentationPackage.totalOperations, 2);
    assert.deepEqual(
        documentationPackage.includedOperations.map((operation) => [
            operation.code,
            operation.changeType,
        ]),
        [
            ['OP-0004', 'replace'],
            ['OP-0008', 'insert'],
        ],
    );
    assert.deepEqual(
        documentationPackage.discardedOperations.map((operation) => [
            operation.code,
            operation.label,
        ]),
        [['OP-0011', 'Stara radnja']],
    );
});

test('generates a guide-first PDF without page numbering text', () => {
    const documentationPackage = buildFarmerDocumentationPackage({
        generatedAt,
        since,
        labelAttributeDefinitionIds: new Set(),
        operations: [
            operationFixture(4, 'Zalijevanje', {
                duration: 25,
                application: 'raisedBedFull',
            }),
        ],
        revisions: [
            revisionFixture({
                id: 1,
                entityId: 4,
                action: 'attribute.updated',
                createdAt: new Date('2026-06-08T12:00:00.000Z'),
            }),
        ],
    });

    const pdf = generateFarmerDocumentationPdf(documentationPackage);
    const content = new TextDecoder().decode(pdf);

    assert.match(content, /^%PDF-1\.4/);
    assert.match(content, /ORG-GUIDE/);
    assert.match(content, /OP-0004/);
    assert.match(content, /Zalijevanje/);
    assert.doesNotMatch(content, /Stranica \d/);
});

function operationFixture(
    id: number,
    label: string,
    attributes: EntityStandardized['attributes'],
): EntityStandardized {
    return {
        id,
        information: {
            label,
            name: label,
            description: 'Kratak opis radnje.',
            instructions: '1. Provjeri gredicu.\n2. Odradi radnju.',
        },
        attributes,
        conditions: {
            completionAttachImages: true,
            completionAttachImagesRequired: false,
        },
    };
}

function revisionFixture({
    action,
    attributeDefinitionId = null,
    createdAt,
    entityId,
    id,
    nextState = null,
    nextValue = null,
    previousState = null,
    previousValue = null,
}: {
    action: string;
    attributeDefinitionId?: number | null;
    createdAt: Date;
    entityId: number;
    id: number;
    nextState?: string | null;
    nextValue?: string | null;
    previousState?: string | null;
    previousValue?: string | null;
}): FarmerDocumentationRevision {
    return {
        id,
        action,
        actorName: null,
        attributeDefinitionId,
        createdAt,
        entityId,
        entityTypeName: 'operation',
        nextState,
        nextValue,
        previousState,
        previousValue,
    };
}
