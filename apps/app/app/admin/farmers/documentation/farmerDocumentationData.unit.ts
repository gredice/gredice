import assert from 'node:assert/strict';
import test from 'node:test';
import { inflateSync } from 'node:zlib';
import type {
    EntityStandardized,
    SelectFarm,
    SelectOperationPrice,
} from '@gredice/storage';
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
const plantImageDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4z8AAAAMBAQCc479ZAAAAAElFTkSuQmCC';
const sortImageDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWNgaGAAAAEEAIEl6+oTAAAAAElFTkSuQmCC';

test('builds insert, replace, and discard instructions from manual revisions', () => {
    const documentationPackage = buildFarmerDocumentationPackage({
        generatedAt,
        since,
        labelAttributeDefinitionIds: {
            operation: new Set([10]),
            plant: new Set([30]),
            plantSort: new Set([20]),
        },
        plantSortPlantAttributeDefinitionIds: new Set([21]),
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
        plants: [plantFixture()],
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
    assert.equal(documentationPackage.totalPlants, 1);
    assert.equal(documentationPackage.totalPlantSorts, 1);
    assert.deepEqual(
        currentDocumentationPages(documentationPackage).map((page) => [
            page.code,
            page.label,
        ]),
        [
            ['OP-0008', 'Čišćenje gredice'],
            ['OP-0006', 'Okopavanje'],
            ['PL-1014', 'Rajčica'],
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
        documentationPackage.includedPlants.map((plant) => [
            plant.code,
            plant.changeType,
            plant.appPath,
        ]),
        [['PL-1014', 'replace', '/plants']],
    );
    assert.equal(
        documentationPackage.includedPlants[0]?.sections[0]?.title,
        'Dostupne sorte',
    );
    assert.deepEqual(documentationPackage.includedPlants[0]?.sections.at(-1), {
        title: 'Dodatne informacije sorte - Cherry rajčica',
        lines: ['Opis: Kratak opis sorte.'],
    });
    assert.deepEqual(
        documentationPackage.includedPlants[0]?.images.map((image) => [
            image.label,
            image.url,
        ]),
        [
            ['Biljka - Rajčica', plantImageDataUrl],
            ['Sorta - Cherry rajčica', sortImageDataUrl],
        ],
    );
    assert.deepEqual(
        documentationPackage.includedPlants[0]?.summaryRows.find(
            (row) => row.label === 'Podrijetlo',
        ),
        { label: 'Podrijetlo', value: 'Južna Amerika' },
    );
    assert.equal(
        documentationPackage.includedPlants[0]?.sections.some(
            (section) => section.title === 'Podrijetlo',
        ),
        false,
    );
    assert.deepEqual(
        pagesByHeader.map((page) => page.code),
        ['OP-0008', 'PL-1014', 'OP-0004'],
    );
    assert.deepEqual(
        includedDocumentationPages(documentationPackage, 'operations').map(
            (page) => page.code,
        ),
        ['OP-0008', 'OP-0004'],
    );
    assert.deepEqual(
        includedDocumentationPages(documentationPackage, 'plants').map(
            (page) => page.code,
        ),
        ['PL-1014'],
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
        documentationPackage.discardedPlants.map((plant) => [
            plant.code,
            plant.label,
        ]),
        [],
    );
    assert.deepEqual(
        discardedDocumentationPages(documentationPackage, 'plants').map(
            (plantSort) => [plantSort.code, plantSort.label],
        ),
        [['PS-0016', 'Stara sorta']],
    );
});

test('builds farmer payout price tables per farm', () => {
    const documentationPackage = buildFarmerDocumentationPackage({
        generatedAt,
        since: null,
        labelAttributeDefinitionIds: {
            operation: new Set(),
            plant: new Set(),
            plantSort: new Set(),
        },
        farms: [farmFixture({ id: 7, name: 'Testna farma' })],
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
        ],
        operationPrices: [
            operationPriceFixture({
                id: 1,
                farmId: 7,
                entityTypeName: 'sowing',
                entityId: null,
                pricePerUnit: '0.40',
            }),
            operationPriceFixture({
                id: 2,
                farmId: 7,
                entityTypeName: 'operation',
                entityId: 4,
                pricePerUnit: '1.25',
            }),
        ],
        plants: [
            plantFixture({ prices: { perPlant: 1.25 } }),
            plantFixture({
                id: 2020,
                label: 'Paprika',
                prices: { perPlant: 2.5 },
            }),
        ],
        plantSorts: [],
        plantSortPlantAttributeDefinitionIds: new Set(),
        revisions: [],
    });

    assert.equal(documentationPackage.payoutPrices.totalRows, 4);
    assert.equal(documentationPackage.payoutPrices.configuredRows, 2);
    assert.equal(documentationPackage.payoutPrices.missingRows, 2);
    assert.deepEqual(
        documentationPackage.payoutPrices.farms[0]?.rows.map((row) => [
            row.code,
            row.label,
            row.userFacingPriceLabel,
            row.durationLabel,
            row.farmerPriceLabel,
            row.farmerPricePerMinuteLabel,
            row.hasFarmerPrice,
        ]),
        [
            [
                'SOW-DIRECT',
                'Sijanje (direktno)',
                '1,25 EUR - 2,50 EUR (prema cijeni biljke)',
                'Nije primjenjivo',
                '0,40 EUR',
                '-',
                true,
            ],
            [
                'SOW-GREENHOUSE',
                'Sijanje (staklenički rasad)',
                '1,25 EUR - 2,50 EUR (prema cijeni biljke)',
                'Nije primjenjivo',
                'Nije definirano',
                '-',
                false,
            ],
            [
                'OP-0004',
                'Zalijevanje',
                '2,50 EUR',
                '25 min',
                '1,25 EUR',
                '0,05 EUR / min',
                true,
            ],
            [
                'OP-0006',
                'Okopavanje',
                'Nije definirano',
                '30 min',
                'Nije definirano',
                '-',
                false,
            ],
        ],
    );
});

test('regenerates the previous plant page when a sort moves plants', () => {
    const tomato = plantFixture();
    const pepper = plantFixture({
        id: 2020,
        label: 'Paprika',
        description: 'Opis paprike.',
    });
    const documentationPackage = buildFarmerDocumentationPackage({
        generatedAt,
        since,
        labelAttributeDefinitionIds: {
            operation: new Set(),
            plant: new Set(),
            plantSort: new Set(),
        },
        plantSortPlantAttributeDefinitionIds: new Set([21]),
        operations: [],
        plants: [tomato, pepper],
        plantSorts: [
            plantSortFixture(
                18,
                'Žuta paprika',
                { reproductionType: 'seed' },
                tomato,
            ),
        ],
        revisions: [
            revisionFixture({
                id: 1,
                entityId: 18,
                entityTypeName: 'plantSort',
                action: 'attribute.updated',
                attributeDefinitionId: 21,
                previousValue: '2020',
                nextValue: '1014',
                createdAt: new Date('2026-06-08T13:00:00.000Z'),
            }),
        ],
    });

    assert.deepEqual(
        documentationPackage.includedPlants.map((plant) => [
            plant.code,
            plant.label,
            plant.appPath,
            plant.revisionActions,
        ]),
        [
            ['PL-2020', 'Paprika', '/plants', ['promijenjeni podaci']],
            ['PL-1014', 'Rajčica', '/plants', ['promijenjeni podaci']],
        ],
    );

    const previousPlantPage = documentationPackage.includedPlants.find(
        (plant) => plant.code === 'PL-2020',
    );
    assert.deepEqual(previousPlantPage?.sections[0], {
        title: 'Dostupne sorte',
        lines: ['Nema dostupnih sorti.'],
    });

    const currentPlantPage = documentationPackage.includedPlants.find(
        (plant) => plant.code === 'PL-1014',
    );
    assert.deepEqual(currentPlantPage?.sections[0], {
        title: 'Dostupne sorte',
        lines: ['PS-0018 - Žuta paprika, Sjeme'],
    });
});

test('generates a guide-first PDF without page numbering text', async () => {
    const documentationPackage = buildFarmerDocumentationPackage({
        generatedAt,
        since,
        labelAttributeDefinitionIds: {
            operation: new Set(),
            plant: new Set(),
            plantSort: new Set(),
        },
        farms: [farmFixture({ id: 7, name: 'Testna farma' })],
        plantSortPlantAttributeDefinitionIds: new Set(),
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
        operationPrices: [
            operationPriceFixture({
                id: 1,
                farmId: 7,
                entityTypeName: 'sowing',
                entityId: null,
                pricePerUnit: '0.40',
            }),
            operationPriceFixture({
                id: 2,
                farmId: 7,
                entityTypeName: 'operation',
                entityId: 4,
                pricePerUnit: '1.25',
            }),
        ],
        plants: [plantFixture()],
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

    const pdf = await generateFarmerDocumentationPdf(documentationPackage);
    const content = decodePdfForAssertions(pdf);

    assert.match(content, /^%PDF-1\.4/);
    assert.match(content, /\/Filter \/FlateDecode/);
    assert.match(content, /ORG-GUIDE/);
    assert.match(content, /OP-0004/);
    assert.match(content, /OP-0008/);
    assert.match(content, /PL-1014/);
    assert.match(content, /PS-0014/);
    assert.match(content, /Zalijevanje/);
    assertPdfText(content, 'abecedno prije OP-0006 - Okopavanje');
    assertPdfText(
        content,
        'abecedno između OP-0006 - Okopavanje i OP-0004 - Zalijevanje',
    );
    assertPdfText(content, 'abecedno poslije PL-1014 - Rajčica');
    assertPdfText(content, 'DOSTUPNE SORTE');
    assertPdfText(content, 'SLIKE');
    assertPdfText(content, 'Biljka - Rajčica');
    assertPdfText(content, 'Sorta - Cherry rajčica');
    assertPdfText(content, 'DODATNE INFORMACIJE SORTE - CHERRY RAJČICA');
    assertPdfText(content, 'Cherry rajčica');
    assertPdfText(content, 'Rajčica');
    assertPdfText(content, 'Vlažno tlo');
    assertPdfText(content, 'CJENIK ISPLATA FARMERA');
    assertPdfText(content, 'Testna farma');
    assertPdfText(content, 'SOW-DIRECT');
    assertPdfText(content, '0,40 EUR');
    assertPdfText(content, '0,05 EUR / min');
    assert.match(
        content,
        /\/Differences \[128 \/Ccaron \/ccaron \/Cacute \/cacute \/Dcroat \/dcroat \/Scaron \/scaron \/Zcaron \/zcaron\]/,
    );
    assert.match(content, /<81> <010D>/);
    assert.match(content, /<85> <0111>/);
    assert.match(content, /<89> <017E>/);
    assert.match(content, /CIJENA/);
    assert.match(content, /2,50 EUR/);
    assert.match(content, /\/Subtype \/Image/);
    assert.match(content, /\/Im1 Do/);
    assert.match(content, /\/Im2 Do/);
    assert.match(content, /2 Tr \(Gredice\)/);
    assert.doesNotMatch(content, /Stranica \d/);
});

test('renders compact plant attributes and markdown content in PDFs', async () => {
    const documentationPackage = buildFarmerDocumentationPackage({
        generatedAt,
        since: null,
        labelAttributeDefinitionIds: {
            operation: new Set(),
            plant: new Set(),
            plantSort: new Set(),
        },
        plantSortPlantAttributeDefinitionIds: new Set(),
        operations: [],
        plants: [
            plantFixture({
                description:
                    'Artičoke su “teški potrošači” hranjivih tvari i podnose 7–10°C skladištenje…',
                storage: [
                    '1. **Kratkoročno skladištenje**',
                    '   - Hladnjak:',
                    '     * Papriku čuvajte u ladici za povrće na temperaturi 7-10 C.',
                    '     * Nemojte je prati prije skladištenja.',
                    '2. Dugotrajno skladištenje',
                    '   - **Sušenje**',
                    '     * Najbolje za ljute ili tanke sorte.',
                    '',
                    '| Metoda | Temperatura |',
                    '| --- | --- |',
                    '| Hladnjak | 7-10 C |',
                    '| Podrum | 10-12 C |',
                    '',
                    '> Čuvati suho.',
                    '',
                    'Detalji na [uputama](https://example.test/upute).',
                ].join('\n'),
            }),
        ],
        plantSorts: [],
        revisions: [],
    });

    const pdf = await generateFarmerDocumentationPdf(documentationPackage, {
        content: 'plants',
    });
    const content = decodePdfForAssertions(pdf);
    const sowingPosition = pdfTextPosition(content, 'SJETVA');
    const growthPosition = pdfTextPosition(content, 'RAST');

    assert.equal(sowingPosition.y, growthPosition.y);
    assert.ok(growthPosition.x > sowingPosition.x + 200);
    assertPdfText(
        content,
        'Artičoke su "teški potrošači" hranjivih tvari i podnose 7-10 C skladištenje...',
    );
    assert.doesNotMatch(content, /\?te/);
    assertPdfText(content, 'Kratkoročno skladištenje');
    assertPdfText(content, 'Papriku čuvajte u ladici za povrće');
    assertPdfText(content, 'Sušenje');
    assertPdfText(content, 'Metoda');
    assertPdfText(content, 'Temperatura');
    assertPdfText(content, 'Čuvati suho.');
    assertPdfText(content, 'https://example.test/upute');
    assertPdfTextWithFont(content, 'F2', 'Sušenje');
    assert.doesNotMatch(content, /\(\* Papriku/);
});

test('inserts blank pages between documentation entries for duplex printing', async () => {
    const documentationPackage = buildFarmerDocumentationPackage({
        generatedAt,
        since: null,
        labelAttributeDefinitionIds: {
            operation: new Set(),
            plant: new Set(),
            plantSort: new Set(),
        },
        plantSortPlantAttributeDefinitionIds: new Set(),
        operations: [],
        plants: [
            plantFixture(),
            plantFixture({
                id: 2020,
                label: 'Paprika',
                origin: 'Srednja Amerika',
            }),
        ],
        plantSorts: [],
        revisions: [],
    });

    const pdf = await generateFarmerDocumentationPdf(documentationPackage, {
        content: 'plants',
    });
    const content = decodePdfForAssertions(pdf);

    assert.equal(pdfPageCount(content), 5);
    assertPdfText(content, 'PL-1014');
    assertPdfText(content, 'PL-2020');
});

test('generates filtered PDF packages for updates', async () => {
    const documentationPackage = buildFarmerDocumentationPackage({
        generatedAt,
        since,
        labelAttributeDefinitionIds: {
            operation: new Set(),
            plant: new Set(),
            plantSort: new Set(),
        },
        plantSortPlantAttributeDefinitionIds: new Set(),
        operations: [
            operationFixture(4, 'Zalijevanje', {
                duration: 25,
                application: 'raisedBedFull',
            }),
        ],
        plants: [plantFixture()],
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

    const pdf = await generateFarmerDocumentationPdf(documentationPackage, {
        content: 'operations',
    });
    const content = decodePdfForAssertions(pdf);

    assert.match(content, /ORG-GUIDE/);
    assert.match(content, /Radnje/);
    assert.match(content, /OP-0004/);
    assert.match(content, /Kratak opis radnje/);
    assert.doesNotMatch(content, /Opis biljke/);
    assert.doesNotMatch(content, /Kratak opis sorte/);

    const plantsPdf = await generateFarmerDocumentationPdf(
        documentationPackage,
        {
            content: 'plants',
        },
    );
    const plantsContent = decodePdfForAssertions(plantsPdf);

    assert.match(plantsContent, /ORG-GUIDE/);
    assert.match(plantsContent, /Biljke i sorte/);
    assert.match(plantsContent, /PL-1014/);
    assert.match(plantsContent, /PS-0014/);
    assert.match(plantsContent, /Opis biljke/);
    assert.match(plantsContent, /Kratak opis sorte/);
    assert.doesNotMatch(plantsContent, /Kratak opis radnje/);
});

const pdfTextGlyphCodes = new Map([
    ['Č', 0x80],
    ['č', 0x81],
    ['Ć', 0x82],
    ['ć', 0x83],
    ['Đ', 0x84],
    ['đ', 0x85],
    ['Š', 0x86],
    ['š', 0x87],
    ['Ž', 0x88],
    ['ž', 0x89],
]);

function assertPdfText(content: string, value: string) {
    assert.match(content, new RegExp(escapeRegExp(encodedPdfText(value))));
}

function assertPdfTextWithFont(
    content: string,
    font: 'F1' | 'F2' | 'F3' | 'F4',
    value: string,
) {
    assert.match(
        content,
        new RegExp(
            `/${font} [0-9.]+ Tf[\\s\\S]{0,160}\\(${escapeRegExp(
                encodedPdfText(value),
            )}\\) Tj`,
        ),
    );
}

function pdfTextPosition(content: string, value: string) {
    const match = new RegExp(
        `/F2 8 Tf 1 0 0 1 ([0-9.]+) ([0-9.]+) Tm\\s+\\(${escapeRegExp(
            encodedPdfText(value),
        )}\\) Tj`,
    ).exec(content);

    assert.ok(match?.[1]);
    assert.ok(match[2]);

    return {
        x: Number.parseFloat(match[1]),
        y: Number.parseFloat(match[2]),
    };
}

function pdfPageCount(content: string) {
    const match = /\/Type \/Pages \/Kids \[[^\]]+\] \/Count (\d+)/.exec(
        content,
    );

    assert.ok(match?.[1]);
    return Number.parseInt(match[1], 10);
}

function decodePdfForAssertions(pdf: ArrayBuffer) {
    const bytes = new Uint8Array(pdf);
    const textDecoder = new TextDecoder();
    const contentParts = [textDecoder.decode(bytes)];
    const streamStart = new TextEncoder().encode('stream\n');
    const streamEnd = new TextEncoder().encode('\nendstream');
    let offset = 0;

    while (offset < bytes.byteLength) {
        const start = indexOfBytes(bytes, streamStart, offset);
        if (start === -1) break;

        const contentStart = start + streamStart.byteLength;
        const end = indexOfBytes(bytes, streamEnd, contentStart);
        if (end === -1) break;

        const streamContent = bytes.subarray(contentStart, end);
        const streamDictionary = textDecoder.decode(
            bytes.subarray(Math.max(0, start - 128), start),
        );
        if (!streamDictionary.includes('/Subtype /Image')) {
            contentParts.push(
                streamDictionary.includes('/Filter /FlateDecode')
                    ? textDecoder.decode(inflateSync(streamContent))
                    : textDecoder.decode(streamContent),
            );
        }
        offset = end + streamEnd.byteLength;
    }

    return contentParts.join('\n');
}

function indexOfBytes(
    bytes: Uint8Array,
    needle: Uint8Array,
    fromIndex: number,
) {
    for (
        let index = fromIndex;
        index <= bytes.byteLength - needle.byteLength;
        index += 1
    ) {
        let matches = true;
        for (let offset = 0; offset < needle.byteLength; offset += 1) {
            if (bytes[index + offset] !== needle[offset]) {
                matches = false;
                break;
            }
        }
        if (matches) return index;
    }

    return -1;
}

function encodedPdfText(value: string) {
    let encoded = '';
    for (const character of value) {
        const code = pdfTextGlyphCodes.get(character);
        if (code) {
            encoded += `\\${code.toString(8).padStart(3, '0')}`;
            continue;
        }

        if (character === '\\') {
            encoded += '\\\\';
            continue;
        }
        if (character === '(') {
            encoded += '\\(';
            continue;
        }
        if (character === ')') {
            encoded += '\\)';
            continue;
        }

        encoded += character;
    }

    return encoded;
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

function farmFixture({
    id = 1,
    name = 'Farma',
}: {
    id?: number;
    name?: string;
} = {}): SelectFarm {
    return {
        id,
        name,
        latitude: 45.8,
        longitude: 16,
        slackChannelId: null,
        snowAccumulation: 0,
        createdAt: generatedAt,
        updatedAt: generatedAt,
        isDeleted: false,
    };
}

function operationPriceFixture({
    entityId,
    entityTypeName,
    farmId,
    id,
    pricePerUnit,
}: {
    entityId: number | null;
    entityTypeName: string;
    farmId: number;
    id: number;
    pricePerUnit: string;
}): SelectOperationPrice {
    return {
        id,
        farmId,
        entityTypeName,
        entityId,
        pricePerUnit,
        currency: 'eur',
        createdAt: generatedAt,
        updatedAt: generatedAt,
    };
}

function plantSortFixture(
    id: number,
    label: string,
    attributes: EntityStandardized['attributes'],
    plant: EntityStandardized = plantFixture(),
): EntityStandardized {
    return {
        id,
        information: {
            label,
            name: label,
            description: 'Kratak opis sorte.',
            plant,
        },
        image: { cover: { url: sortImageDataUrl } },
        attributes,
    };
}

function plantFixture({
    description = 'Opis biljke.',
    id = 1014,
    label = 'Rajčica',
    origin = 'Južna Amerika',
    prices,
    storage,
}: {
    description?: string;
    id?: number;
    label?: string;
    origin?: string;
    prices?: EntityStandardized['prices'];
    storage?: string;
} = {}): EntityStandardized {
    const information: NonNullable<EntityStandardized['information']> & {
        origin?: string;
        storage?: string;
    } = {
        label,
        name: label,
        description,
        origin,
        ...(storage ? { storage } : {}),
    };

    return {
        id,
        information,
        image: { cover: { url: plantImageDataUrl } },
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
        ...(prices === undefined ? {} : { prices }),
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
    entityTypeName?: 'operation' | 'plant' | 'plantSort';
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
