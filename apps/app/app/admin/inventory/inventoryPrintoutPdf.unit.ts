import assert from 'node:assert/strict';
import test from 'node:test';
import {
    generateInventoryPrintoutPdf,
    inventoryPrintoutFilename,
} from './[inventoryId]/inventoryPrintoutPdf';

test('generates an inventory worksheet PDF with printable inventory fields', () => {
    const pdf = generateInventoryPrintoutPdf({
        inventoryLabel: 'Sjeme raj\u010dice',
        printedAt: new Date('2026-06-12T10:30:00Z'),
        summary: {
            totalItems: 2,
            totalQuantity: 13,
            emptyItems: 1,
            lowItems: 0,
            normalItems: 1,
        },
        items: [
            {
                label: 'Raj\u010dica cherry',
                details: ['ID #1', 'Serijski br.: LOT-7', 'Minimum: 4'],
                quantity: 13,
                currentStatus: 'Uredno',
            },
            {
                label: 'Bosiljak',
                details: ['ID #2', 'Pracenje: komadi'],
                quantity: 0,
                currentStatus: 'Prazno',
            },
        ],
    });
    const content = new TextDecoder().decode(pdf);

    assert.match(content, /^%PDF-1\.4/);
    assert.match(content, /GREDICE/);
    assert.match(content, /INVENTURNI LIST/);
    assert.match(content, /Sjeme rajcice/);
    assert.match(content, /DATUM ISPISA/);
    assert.match(content, /INVENTURA OBAVLJENA/);
    assert.match(content, /STAVKA I DETALJI/);
    assert.match(content, /NOVO STANJE/);
    assert.match(content, /Rajcica cherry/);
    assert.match(content, /Serijski br.: LOT-7/);
    assert.match(content, /Stranica 1 \/ 1/);
    assert.doesNotMatch(content, /Raj\u010dica/);
});

test('creates a stable ASCII filename for the printout download', () => {
    assert.equal(
        inventoryPrintoutFilename(
            'Sjeme raj\u010dice',
            new Date('2026-06-12T10:30:00Z'),
        ),
        'sjeme-rajcice-inventura-2026-06-12.pdf',
    );
});
