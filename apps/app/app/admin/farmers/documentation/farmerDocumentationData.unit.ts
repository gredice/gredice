import assert from 'node:assert/strict';
import test from 'node:test';
import type { EntityStandardized } from '@gredice/storage';
import {
    buildFarmerDocumentationPackage,
    currentDocumentationPages,
    discardedDocumentationPages,
    type FarmerDocumentationRevision,
    includedDocumentationPages,
} from './farmerDocumentationData';
import { generateFarmerDocumentationPdf } from './farmerDocumentationPdf';

const generatedAt = new Date('2026-06-13T10:00:00.000Z');
const since = new Date('2026-06-01T00:00:00.000Z');

test('builds insert, replace, and discard instructions from manual revisions', () => {
    const documentationPackage = buildFarmerDocumentationPackage({
        generatedAt,
        since,
        labelAttributeDefinitionIds: {
            operation: new Set([10]),
            plantSort: new Set([20]),
        },
        operations: [
            operationFixture(
                4,
                'Zalijevanje',
                {
                    duration: 25,
                    application: 'raisedBedFull',
                },
                { perOperation: 2.5 },
            ),
            operationFixture(6, 'Okopavanje', {
                duration: 30,
                application: 'raisedBed',
            }),
            operationFixture(8, 'Čišćenje gredice', {
                duration: 40,
                frequency: 'required',
            }),
        ],
        plantSorts: [
            plantSortFixture(14, 'Cherry rajčica', {
                reproductionType: 'seed',
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
            revisionFixture({
                id: 5,
                entityId: 14,
                entityTypeName: 'plantSort',
                action: 'entity.created',
                createdAt: new Date('2026-06-11T12:00:00.000Z'),
            }),
            revisionFixture({
                id: 6,
                entityId: 16,
                entityTypeName: 'plantSort',
                action: 'attribute.updated',
                attributeDefinitionId: 20,
                previousValue: 'Stara sorta',
                nextValue: 'Stara sorta',
                createdAt: new Date('2026-06-12T12:00:00.000Z'),
            }),
            revisionFixture({
                id: 7,
                entityId: 16,
                entityTypeName: 'plantSort',
                action: 'entity.deleted',
                previousState: 'published',
                nextState: 'published',
                createdAt: new Date('2026-06-12T12:30:00.000Z'),
            }),
        ],
    });
    const pagesByHeader = includedDocumentationPages(documentationPackage);

    assert.equal(documentationPackage.totalOperations, 3);
    assert.equal(documentationPackage.totalPlantSorts, 1);
    assert.deepEqual(
        currentDocumentationPages(documentationPackage).map((page) => [
            page.code,
            page.label,
        ]),
        [
            ['PS-0014', 'Cherry rajčica'],
            ['OP-0008', 'Čišćenje gredice'],
            ['OP-0006', 'Okopavanje'],
            ['OP-0004', 'Zalijevanje'],
        ],
    );
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
        documentationPackage.includedPlantSorts.map((plantSort) => [
            plantSort.code,
            plantSort.changeType,
        ]),
        [['PS-0014', 'insert']],
    );
    assert.deepEqual(
        pagesByHeader.map((page) => page.code),
        ['PS-0014', 'OP-0008', 'OP-0004'],
    );
    assert.deepEqual(
        includedDocumentationPages(documentationPackage, 'operations').map(
            (page) => page.code,
        ),
        ['OP-0008', 'OP-0004'],
    );
    assert.deepEqual(
        includedDocumentationPages(documentationPackage, 'plantSorts').map(
            (page) => page.code,
        ),
        ['PS-0014'],
    );
    assert.deepEqual(
        documentationPackage.includedOperations[0]?.summaryRows.find(
            (row) => row.label === 'Cijena',
        ),
        { label: 'Cijena', value: '2,50 EUR' },
    );
    assert.deepEqual(
        documentationPackage.discardedOperations.map((operation) => [
            operation.code,
            operation.label,
        ]),
        [['OP-0011', 'Stara radnja']],
    );
    assert.deepEqual(
        discardedDocumentationPages(documentationPackage, 'operations').map(
            (operation) => [operation.code, operation.label],
        ),
        [['OP-0011', 'Stara radnja']],
    );
    assert.deepEqual(
        documentationPackage.discardedPlantSorts.map((plantSort) => [
            plantSort.code,
            plantSort.label,
        ]),
        [['PS-0016', 'Stara sorta']],
    );
    assert.deepEqual(
        discardedDocumentationPages(documentationPackage, 'plantSorts').map(
            (plantSort) => [plantSort.code, plantSort.label],
        ),
        [['PS-0016', 'Stara sorta']],
    );
});

test('generates a guide-first PDF without page numbering text', () => {
    const documentationPackage = buildFarmerDocumentationPackage({
        generatedAt,
        since,
        labelAttributeDefinitionIds: {
            operation: new Set(),
            plantSort: new Set(),
        },
        operations: [
            operationFixture(
                4,
                'Zalijevanje',
                {
                    duration: 25,
                    application: 'raisedBedFull',
                },
                { perOperation: 2.5 },
            ),
            operationFixture(6, 'Okopavanje', {
                duration: 30,
                application: 'raisedBed',
            }),
            operationFixture(8, 'Berba', {
                duration: 35,
                application: 'raisedBed',
            }),
        ],
        plantSorts: [
            plantSortFixture(14, 'Cherry rajčica', {
                reproductionType: 'seed',
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
                action: 'attribute.updated',
                createdAt: new Date('2026-06-08T12:30:00.000Z'),
            }),
            revisionFixture({
                id: 3,
                entityId: 14,
                entityTypeName: 'plantSort',
                action: 'attribute.updated',
                createdAt: new Date('2026-06-08T13:00:00.000Z'),
            }),
        ],
    });

    const pdf = generateFarmerDocumentationPdf(documentationPackage);
    const content = new TextDecoder().decode(pdf);

    assert.match(content, /^%PDF-1\.4/);
    assert.match(content, /ORG-GUIDE/);
    assert.match(content, /OP-0004/);
    assert.match(content, /OP-0008/);
    assert.match(content, /PS-0014/);
    assert.match(content, /Zalijevanje/);
    assert.match(content, /abecedno prije PS-0014 - Cherry rajcica/);
    assert.match(
        content,
        /abecedno izmedju OP-0008 - Berba i OP-0006 - Okopavanje/,
    );
    assert.match(content, /abecedno poslije OP-0006 - Okopavanje/);
    assert.match(content, /Cherry rajcica/);
    assert.match(content, /CIJENA/);
    assert.match(content, /2,50 EUR/);
    assert.match(content, /2 Tr \(Gredice\)/);
    assert.doesNotMatch(content, /Stranica \d/);
});

test('generates filtered PDF packages for updates', () => {
    const documentationPackage = buildFarmerDocumentationPackage({
        generatedAt,
        since,
        labelAttributeDefinitionIds: {
            operation: new Set(),
            plantSort: new Set(),
        },
        operations: [
            operationFixture(4, 'Zalijevanje', {
                duration: 25,
                application: 'raisedBedFull',
            }),
        ],
        plantSorts: [
            plantSortFixture(14, 'Cherry rajčica', {
                reproductionType: 'seed',
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
                entityId: 14,
                entityTypeName: 'plantSort',
                action: 'attribute.updated',
                createdAt: new Date('2026-06-08T13:00:00.000Z'),
            }),
        ],
    });

    const pdf = generateFarmerDocumentationPdf(documentationPackage, {
        content: 'operations',
    });
    const content = new TextDecoder().decode(pdf);

    assert.match(content, /ORG-GUIDE/);
    assert.match(content, /Radnje/);
    assert.match(content, /OP-0004/);
    assert.match(content, /Kratak opis radnje/);
    assert.doesNotMatch(content, /Kratak opis sorte/);

    const plantSortsPdf = generateFarmerDocumentationPdf(documentationPackage, {
        content: 'plantSorts',
    });
    const plantSortsContent = new TextDecoder().decode(plantSortsPdf);

    assert.match(plantSortsContent, /ORG-GUIDE/);
    assert.match(plantSortsContent, /Biljke i sorte/);
    assert.match(plantSortsContent, /PS-0014/);
    assert.match(plantSortsContent, /Kratak opis sorte/);
    assert.doesNotMatch(plantSortsContent, /Kratak opis radnje/);
});

function operationFixture(
    id: number,
    label: string,
    attributes: EntityStandardized['attributes'],
    prices?: EntityStandardized['prices'],
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
        ...(prices === undefined ? {} : { prices }),
        conditions: {
            completionAttachImages: true,
            completionAttachImagesRequired: false,
        },
    };
}

function plantSortFixture(
    id: number,
    label: string,
    attributes: EntityStandardized['attributes'],
): EntityStandardized {
    return {
        id,
        information: {
            label,
            name: label,
            description: 'Kratak opis sorte.',
            plant: {
                id: 1000 + id,
                information: {
                    label: 'Rajčica',
                    name: 'Rajčica',
                    description: 'Opis biljke.',
                },
                attributes: {
                    seedingDistance: 30,
                    germinationWindowMin: 7,
                    germinationWindowMax: 10,
                    growthWindowMin: 60,
                    growthWindowMax: 80,
                    water: 'Vlažno tlo',
                    yieldMin: 100,
                    yieldMax: 200,
                    yieldType: 'perPlant',
                    cleanHarvest: false,
                },
            },
        },
        attributes,
    };
}

function revisionFixture({
    action,
    attributeDefinitionId = null,
    createdAt,
    entityId,
    entityTypeName = 'operation',
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
    entityTypeName?: 'operation' | 'plantSort';
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
        entityTypeName,
        nextState,
        nextValue,
        previousState,
        previousValue,
    };
}
