import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildDeliveryPricingRows,
    buildOperationPricingRows,
    buildPlantPricingRows,
} from './pricingRows.ts';

test('buildPlantPricingRows includes plants only when numeric prices exist and links public plant pages', () => {
    const rows = buildPlantPricingRows(
        [
            {
                id: 1,
                slug: 'custom-mrkva-slug',
                information: { name: 'Mrkva' },
                prices: { perPlant: 1.2 },
            },
            {
                id: 2,
                slug: 'blitva',
                information: { name: 'Blitva' },
                prices: { perPlant: null },
            },
            {
                id: 3,
                slug: '',
                information: { name: 'Ljuta Papričica' },
            },
        ],
        [],
    );

    assert.deepEqual(
        rows.map((row) => ({
            href: row.href,
            kind: row.kind,
            label: row.label,
            price: row.price,
        })),
        [
            {
                href: '/biljke/mrkva',
                kind: 'plant',
                label: 'Mrkva',
                price: 1.2,
            },
        ],
    );
});

test('buildPlantPricingRows includes plant sorts with their own numeric price and links public sort pages', () => {
    const rows = buildPlantPricingRows(
        [
            {
                id: 1,
                slug: 'custom-rajcica-slug',
                information: { name: 'Rajčica' },
                prices: { perPlant: 2.5 },
            },
            {
                id: 2,
                slug: 'mrkva',
                information: { name: 'Mrkva' },
                prices: { perPlant: 1.2 },
            },
        ],
        [
            {
                id: 11,
                slug: 'custom-roma-slug',
                information: {
                    name: 'Roma',
                    plant: {
                        id: 1,
                        information: { name: 'Rajčica' },
                    },
                },
                prices: { perPlant: 1.7 },
            },
            {
                id: 12,
                slug: 'nantes',
                information: {
                    name: 'Nantes',
                    plant: {
                        id: 2,
                        information: { name: 'Mrkva' },
                    },
                },
                prices: { perPlant: 1.1 },
            },
            {
                id: 13,
                slug: 'cherry',
                information: {
                    name: 'Cherry',
                    plant: {
                        id: 1,
                        information: { name: 'Rajčica' },
                    },
                },
            },
        ],
    );

    assert.deepEqual(
        rows
            .filter((row) => row.kind === 'sort')
            .map((row) => ({
                href: row.href,
                label: row.label,
                parentLabel: row.parentLabel,
                price: row.price,
            })),
        [
            {
                href: '/biljke/mrkva/sorte/nantes',
                label: 'Nantes',
                parentLabel: 'Mrkva',
                price: 1.1,
            },
            {
                href: '/biljke/rajcica/sorte/roma',
                label: 'Roma',
                parentLabel: 'Rajčica',
                price: 1.7,
            },
        ],
    );
});

test('buildPlantPricingRows keeps zero-price entries so they can be marked unavailable', () => {
    const rows = buildPlantPricingRows(
        [
            {
                id: 14,
                information: { name: 'Nedostupna biljka' },
                prices: { perPlant: 0 },
            },
        ],
        [],
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.price, 0);
});

test('buildOperationPricingRows includes operations only when numeric prices exist and links public operation pages', () => {
    const rows = buildOperationPricingRows([
        {
            id: 21,
            slug: 'custom-zalijevanje-slug',
            information: { label: 'Zalijevanje' },
            prices: { perOperation: 1.25 },
        },
        {
            id: 22,
            slug: '',
            information: { label: 'Čišćenje gredice' },
            prices: { perOperation: 4 },
        },
        {
            id: 23,
            slug: 'berba',
            information: { label: 'Berba' },
        },
    ]);

    assert.deepEqual(
        rows.map(({ href, label, price }) => ({ href, label, price })),
        [
            {
                href: '/radnje/ciscenje-gredice',
                label: 'Čišćenje gredice',
                price: 4,
            },
            { href: '/radnje/zalijevanje', label: 'Zalijevanje', price: 1.25 },
        ],
    );
});

test('buildOperationPricingRows distinguishes paid, internal, and unavailable operations', () => {
    const rows = buildOperationPricingRows([
        {
            id: 24,
            information: { label: 'Plaćena radnja' },
            attributes: {
                internal: false,
                stage: { information: { label: 'Održavanje' } },
            },
            prices: { perOperation: 0.5 },
        },
        {
            id: 25,
            information: { label: 'Interna radnja' },
            attributes: {
                internal: true,
                stage: { information: { label: 'Evidencija' } },
            },
            prices: { perOperation: 99 },
        },
        {
            id: 26,
            information: { label: 'Nedostupna radnja' },
            attributes: {
                internal: false,
                stage: { information: { label: 'Berba' } },
            },
            prices: { perOperation: 0 },
        },
    ]);

    assert.deepEqual(
        rows.map(({ availability, label, stageLabel }) => ({
            availability,
            label,
            stageLabel,
        })),
        [
            {
                availability: 'internal',
                label: 'Interna radnja',
                stageLabel: 'Evidencija',
            },
            {
                availability: 'unavailable',
                label: 'Nedostupna radnja',
                stageLabel: 'Berba',
            },
            {
                availability: 'available',
                label: 'Plaćena radnja',
                stageLabel: 'Održavanje',
            },
        ],
    );
});

test('buildDeliveryPricingRows links delivery rows to the delivery page', () => {
    assert.deepEqual(
        buildDeliveryPricingRows(
            [
                {
                    id: 31,
                    information: { label: 'Zagreb' },
                    delivery: { freeRadius: 10, zoneRadius: 60 },
                    prices: { pricePerKilometer: 0.2 },
                },
            ],
            '/dostava',
        ),
        [
            {
                id: 'delivery-31',
                label: 'Zagreb',
                href: '/dostava',
                entityId: 31,
                freeRadius: 10,
                zoneRadius: 60,
                pricePerKilometer: 0.2,
            },
        ],
    );
});
