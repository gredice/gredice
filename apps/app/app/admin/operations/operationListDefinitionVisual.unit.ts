import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeOperationDefinitionForList } from './operationListDefinitionVisual';

test('operation list definition visual keeps cover and fallback category metadata', () => {
    assert.deepEqual(
        serializeOperationDefinitionForList(
            {
                id: 10,
                information: { label: 'Zalijevanje' },
                image: {
                    cover: {
                        url: 'https://cdn.example.com/operations/watering.webp',
                    },
                },
                attributes: {
                    category: {
                        information: {
                            name: 'watering',
                        },
                    },
                    stage: {
                        information: {
                            name: 'growth',
                        },
                    },
                },
            },
            'Radnja 15',
        ),
        {
            image: {
                cover: {
                    url: 'https://cdn.example.com/operations/watering.webp',
                },
            },
            information: { label: 'Zalijevanje' },
            attributes: {
                category: {
                    information: {
                        name: 'watering',
                    },
                },
                stage: {
                    information: {
                        name: 'growth',
                    },
                },
            },
        },
    );
});

test('operation list definition visual falls back to legacy images and row label', () => {
    assert.deepEqual(
        serializeOperationDefinitionForList(
            {
                id: 11,
                images: {
                    cover: {
                        url: 'https://cdn.example.com/operations/legacy.webp',
                    },
                },
            },
            'Radnja 16',
        ),
        {
            image: {
                cover: {
                    url: 'https://cdn.example.com/operations/legacy.webp',
                },
            },
            information: { label: 'Radnja 16' },
            attributes: {
                category: null,
                stage: null,
            },
        },
    );
});
