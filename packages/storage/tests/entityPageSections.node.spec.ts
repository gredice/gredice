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
            component: 'header',
            data: {
                title: 'Mulching',
                subtitle: 'Protects soil moisture.',
                image: 'https://cdn.gredice.com/operation/mulching.jpg',
            },
        },
        {
            component: 'richtext',
            data: {
                content: 'Apply mulch around plants to reduce water loss.',
            },
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

test('transformEntityToSectionData fails for unsupported entity type', () => {
    const entity: EntitySectionTransformInput = {
        id: 7,
        entityType: {
            name: 'plant',
        },
        information: {
            label: 'Tomato',
        },
    };

    assert.throws(
        () => transformEntityToSectionData(entity),
        /Unsupported entity type for page transformation: plant/,
    );
});
