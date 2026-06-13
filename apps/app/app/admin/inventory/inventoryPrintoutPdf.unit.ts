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
                details: ['Biljeska: Paket otvoren'],
                quantity: 13,
            },
            {
                label: 'Bosiljak',
                details: [],
                quantity: 0,
            },
        ],
    });
    const content = new TextDecoder().decode(pdf);

    assert.match(content, /^%PDF-1\.4/);
    assert.match(content, /\/MediaBox \[0 0 595\.28 841\.89\]/);
    assert.match(content, /Gredice/);
    assert.doesNotMatch(content, /GREDICE/);
    assert.match(content, /INVENTURNI LIST/);
    assert.match(content, /Sjeme rajcice/);
    assert.match(content, /DATUM ISPISA/);
    assert.match(content, /INVENTURA OBAVLJENA/);
    assert.match(content, /INVENTURU OBAVIO\/LA/);
    assert.match(content, /STAVKA I DETALJI/);
    assert.match(content, /BILJESKA/);
    assert.match(content, /NOVO STANJE/);
    assert.doesNotMatch(content, /STATUS/);
    assert.match(content, /Rajcica cherry/);
    assert.match(content, /Biljeska: Paket otvoren/);
    assert.doesNotMatch(content, /ID #1/);
    assert.doesNotMatch(content, /Pracenje/);
    assert.doesNotMatch(content, /Minimum/);
    assert.doesNotMatch(content, /Dodano/);
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
