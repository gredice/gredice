import assert from 'node:assert/strict';
import test from 'node:test';
import { priceListCsv } from '../src/helpers/priceListCsv';

test('CSV retains equal anchor amounts, unknown history and sale information independently of presentation', () => {
    const entry = {
        key: 'plant:1',
        name: 'Uzgoj: Rajčica',
        price: 5,
        currency: 'EUR',
        unit: 'biljka',
        available: true,
        specialSale: '',
        anchorPrice: { price: 5, date: '2026-09-10' },
    };
    const csv = priceListCsv([
        entry,
        { ...entry, key: 'plant:2', anchorPrice: null, available: false },
        { ...entry, key: 'plant:3', price: 4, specialSale: 'Akcija' },
    ]);
    assert.ok(csv.startsWith('\uFEFF'));
    assert.ok(
        csv.includes('"5.00";"EUR";"NE";"";"5.00";"2026-09-10";"DOSTUPNO"'),
    );
    assert.ok(csv.includes('"NE";"";"";"";"NEDOSTUPNO"'));
    assert.ok(csv.includes('"4.00";"EUR";"DA";"Akcija";"5.00"'));
});

test('CSV quotes delimiters, newlines and quotes and neutralizes formula names', () => {
    const csv = priceListCsv([
        {
            key: 'operation:1',
            name: '=HYPERLINK("url");\nNaziv',
            price: 5,
            currency: 'EUR',
            unit: 'radnja',
            available: true,
            specialSale: '',
            anchorPrice: null,
        },
    ]);
    assert.ok(csv.includes('"\'=HYPERLINK(""url"");\nNaziv"'));
});
