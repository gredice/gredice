import assert from 'node:assert/strict';
import test from 'node:test';
import {
    type EntitySectionTransformInput,
    transformEntityToSectionData,
} from '@gredice/storage/entityPageSections';

test('transformEntityToSectionData maps supported entity type to deterministic sections', () => {
    const entity: EntitySectionTransformInput = {
        id: 42,
        entityType: {
            name: 'operation',
            label: 'Operation',
        },
        information: {
            label: 'Mulching',
            shortDescription: 'Protects soil moisture.',
            description: 'Apply mulch around plants to reduce water loss.',
        },
        image: {
            cover: {
                url: 'https://cdn.gredice.com/operation/mulching.jpg',
            },
        },
    };

    assert.deepStrictEqual(transformEntityToSectionData(entity), [
        {
            component: 'PageHeader',
            header: 'Mulching',
            description: 'Protects soil moisture.',
        },
        {
            component: 'Heading1',
            header: 'Opis',
            description: 'Apply mulch around plants to reduce water loss.',
        },
    ]);
});

test('transformEntityToSectionData throws validation error when required field is missing', () => {
    const invalidEntity: EntitySectionTransformInput = {
        id: 108,
        entityType: {
            name: 'operation',
        },
        information: {
            label: '',
            description: 'Still has description but no label.',
        },
    };

    assert.throws(
        () => transformEntityToSectionData(invalidEntity),
        /missing required field: information.label/,
    );
});

test('transformEntityToSectionData falls back for unsupported entity type', () => {
    const entity: EntitySectionTransformInput = {
        id: 7,
        entityType: {
            name: 'farmSupply',
            label: 'Materijali i potrošni inventar',
        },
        information: {
            label: 'BR Garden Zaštita za biljke od hladnoće 3.2x10m',
            description: 'Zaštita za osjetljive biljke tijekom hladnijih dana.',
            supplier: 'BR Garden',
        },
        attributes: {
            category: 'odrzavanje',
            unit: 'm',
            price: 9.95,
        },
    };

    assert.deepStrictEqual(transformEntityToSectionData(entity), [
        {
            component: 'PageHeader',
            header: 'BR Garden Zaštita za biljke od hladnoće 3.2x10m',
            description: 'Zaštita za osjetljive biljke tijekom hladnijih dana.',
        },
        {
            component: 'Heading1',
            header: 'Detalji',
            description:
                'supplier: BR Garden · category: odrzavanje · unit: m · price: 9.95',
        },
    ]);
});

test('transformEntityToSectionData falls back for raw plant entity attributes', () => {
    const entity: EntitySectionTransformInput = {
        id: 12,
        entityType: {
            name: 'plant',
            label: 'Biljka',
        },
        attributes: [
            {
                value: 'Kelj pupčar',
                attributeDefinition: {
                    category: 'information',
                    name: 'label',
                    label: 'Naziv',
                },
            },
            {
                value: 'Brassica oleracea var. gemmifera',
                attributeDefinition: {
                    category: 'information',
                    name: 'latinName',
                    label: 'Latinsko ime',
                },
            },
            {
                value: 'Europa',
                attributeDefinition: {
                    category: 'information',
                    name: 'origin',
                    label: 'Porijeklo',
                },
            },
            {
                value: 'Kelj pupčar razvija stabljiku visoku oko 60-80 cm.',
                attributeDefinition: {
                    category: 'information',
                    name: 'description',
                    label: 'Opis',
                },
            },
        ],
    };

    assert.deepStrictEqual(transformEntityToSectionData(entity), [
        {
            component: 'PageHeader',
            header: 'Kelj pupčar',
            description: 'Kelj pupčar razvija stabljiku visoku oko 60-80 cm.',
        },
        {
            component: 'Heading1',
            header: 'Detalji',
            description:
                'Latinsko ime: Brassica oleracea var. gemmifera · Porijeklo: Europa',
        },
    ]);
});
