import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRaisedBedAddons } from './raisedBedAddons';

const definitions = [
    {
        id: 1,
        attributes: { visualReward: 'mulch', application: 'raisedBedFull' },
        information: { label: 'Malčiranje slamom' },
    },
    {
        id: 2,
        attributes: {
            visualReward: 'removeMulch',
            application: 'plant',
            appliesToEmptyFields: true,
        },
    },
    {
        id: 3,
        attributes: { visualReward: 'supports', application: 'plant' },
        information: { label: 'Postavljanje potpornja' },
    },
    {
        id: 4,
        attributes: { visualReward: 'removeMulch', application: 'raisedBed1m' },
    },
    {
        id: 5,
        attributes: { visualReward: 'watering', application: 'raisedBedFull' },
    },
    {
        id: 6,
        attributes: {
            visualReward: 'agrotextile',
            application: 'raisedBedFull',
        },
    },
    {
        id: 7,
        attributes: {
            visualReward: 'removeAgrotextile',
            application: 'raisedBedFull',
        },
    },
    {
        id: 8,
        attributes: {
            visualReward: 'insectMesh',
            application: 'raisedBedFull',
        },
    },
    {
        id: 9,
        attributes: { visualReward: 'removeInsectMesh', application: 'plant' },
    },
    {
        id: 10,
        attributes: {
            visualReward: 'mulch',
            application: 'plant',
            appliesToEmptyFields: true,
        },
    },
];
const fields = [0, 1, 2].map((positionIndex) => ({
    id: positionIndex + 11,
    positionIndex,
    active: true,
    plantCycles: [{ active: true, startedAt: '2026-09-01' }],
}));
function operation(
    id: number,
    entityId: number,
    extra: Partial<
        Parameters<typeof resolveRaisedBedAddons>[0]['operations'][number]
    > = {},
) {
    return {
        id,
        entityId,
        raisedBedId: 10,
        status: 'completed',
        completedAt: `2026-09-${String(id + 1).padStart(2, '0')}`,
        ...extra,
    };
}
function resolve(
    operations: Parameters<typeof resolveRaisedBedAddons>[0]['operations'],
    extra: Partial<Parameters<typeof resolveRaisedBedAddons>[0]> = {},
) {
    return resolveRaisedBedAddons({
        raisedBedId: 10,
        positionNumbers: [1, 2, 3],
        fields,
        definitions,
        operations,
        ...extra,
    });
}

test('whole-bed mulch covers empty cells; field removal leaves only remaining coverage', () => {
    const addons = resolve([
        operation(2, 2, { raisedBedFieldId: 12 }),
        operation(1, 1),
    ]);
    assert.deepEqual(
        addons.map((item) => [item.family, item.scope, item.positionNumbers]),
        [['mulch', 'raisedBed', [1, 3]]],
    );
});
test('later bed removal clears field additions and later application restores them', () => {
    assert.deepEqual(
        resolve([operation(1, 1, { raisedBedFieldId: 11 }), operation(2, 4)]),
        [],
    );
    assert.deepEqual(
        resolve([
            operation(1, 1),
            operation(2, 4),
            operation(3, 1, { raisedBedFieldId: 12 }),
        ])[0]?.positionNumbers,
        [2],
    );
});
test('ignores requested, cancelled, unrelated, unclassified and previous-cycle operations', () => {
    assert.deepEqual(
        resolve([
            operation(1, 3, {
                raisedBedFieldId: 11,
                completedAt: '2026-08-31',
            }),
            operation(2, 1, { status: 'planned' }),
            operation(3, 1, { status: 'canceled' }),
            operation(4, 1, { raisedBedId: 99 }),
            operation(5, 5),
            operation(6, 99),
            operation(7, 3),
            operation(8, 3, { raisedBedFieldId: 999 }),
        ]),
        [],
    );
});
test('planting-targeted supports cover the exact active multi-field footprint', () => {
    const plantings = [
        {
            id: 20,
            isActive: true,
            lifecycleStartedAt: '2026-09-01',
            memberships: [
                { raisedBedField: { positionIndex: 0 } },
                { raisedBedField: { positionIndex: 2 } },
            ],
        },
    ];
    const addons = resolve(
        [operation(1, 3, { plantingId: 20, status: 'pendingVerification' })],
        { plantings },
    );
    assert.deepEqual(addons[0]?.positionNumbers, [1, 3]);
    assert.equal(addons[0]?.pendingVerification, true);
    assert.equal(addons[0]?.scope, 'planting');
    assert.deepEqual(
        resolve([operation(1, 3, { plantingId: 20 })], {
            plantings: plantings.map((planting) => ({
                ...planting,
                isActive: false,
            })),
        }),
        [],
    );
});
test('tie-breaking, date fallback and multiple families are deterministic', () => {
    const result = resolve([
        operation(3, 3, {
            raisedBedFieldId: 11,
            completedAt: null,
            createdAt: '2026-09-04',
        }),
        operation(2, 4),
        operation(1, 1, { completedAt: '2026-09-03' }),
    ]);
    assert.deepEqual(
        result.map((item) => [item.family, item.appliedAt]),
        [['supports', '2026-09-04T00:00:00.000Z']],
    );
    assert.equal(
        resolve([operation(1, 3, { raisedBedFieldId: 11 }), operation(2, 1)])
            .length,
        2,
    );
});
test('cover removals follow the same scope rules as mulch', () => {
    const result = resolve([
        operation(1, 6),
        operation(2, 8),
        operation(3, 7),
        operation(4, 9, { raisedBedFieldId: 11 }),
    ]);
    assert.deepEqual(
        result.map((item) => [item.family, item.positionNumbers]),
        [['insectMesh', [2, 3]]],
    );
});

test('physical mulch on an empty field is visible and its removal clears inherited bed coverage', () => {
    const emptyFields = fields.map((field) => ({
        ...field,
        active: false,
        plantCycles: [{ active: false, startedAt: '2026-08-01' }],
    }));
    assert.deepEqual(
        resolve([operation(1, 10, { raisedBedFieldId: 11 })], {
            fields: emptyFields,
        }).map((addon) => [addon.family, addon.positionNumbers]),
        [['mulch', [1]]],
    );
    assert.deepEqual(
        resolve([operation(1, 1), operation(2, 2, { raisedBedFieldId: 11 })], {
            fields: emptyFields,
        }).map((addon) => [addon.family, addon.positionNumbers]),
        [['mulch', [2, 3]]],
    );
    assert.deepEqual(
        resolve([operation(1, 3, { raisedBedFieldId: 11 })], {
            fields: emptyFields,
        }),
        [],
    );
});

test('planting an already mulched empty field retains mulch when no plant was removed', () => {
    const result = resolve([
        operation(1, 10, { raisedBedFieldId: 11, completedAt: '2026-08-20' }),
        operation(2, 3, { raisedBedFieldId: 11, completedAt: '2026-08-21' }),
    ]);
    assert.deepEqual(
        result.map((addon) => [addon.family, addon.positionNumbers]),
        [['mulch', [1]]],
    );
});

const removedFields = fields.map((field) => ({
    ...field,
    active: field.id !== 12,
    plantCycles: field.plantCycles.map((cycle) => ({
        ...cycle,
        active: field.id !== 12,
        plantRemovedDate: field.id === 12 ? '2026-09-10' : undefined,
    })),
}));

test('plant removal clears every addon on that field, including inherited whole-bed coverage', () => {
    const result = resolve(
        [
            operation(1, 1),
            operation(2, 6),
            operation(3, 8),
            operation(4, 3, { raisedBedFieldId: 12 }),
            operation(5, 10, { raisedBedFieldId: 12 }),
        ],
        { fields: removedFields },
    );
    assert.deepEqual(
        result.map((addon) => [addon.family, addon.positionNumbers]),
        [
            ['mulch', [1, 3]],
            ['agrotextile', [1, 3]],
            ['insectMesh', [1, 3]],
        ],
    );
});

test('replanting does not restore addons cleared by a previous plant removal', () => {
    const replantedFields = removedFields.map((field) => ({
        ...field,
        active: true,
        plantCycles: [
            ...field.plantCycles.map((cycle) => ({ ...cycle, active: false })),
            { active: true, startedAt: '2026-09-11' },
        ],
    }));
    assert.deepEqual(
        resolve([operation(1, 1), operation(2, 10, { raisedBedFieldId: 12 })], {
            fields: replantedFields,
        }).map((addon) => [addon.family, addon.positionNumbers]),
        [['mulch', [1, 3]]],
    );
});

test('only applications after removal restore coverage on an empty field', () => {
    assert.deepEqual(
        resolve(
            [
                operation(1, 1),
                operation(2, 10, {
                    raisedBedFieldId: 12,
                    completedAt: '2026-09-10',
                }),
            ],
            { fields: removedFields },
        ).map((addon) => [addon.operationId, addon.positionNumbers]),
        [[1, [1, 3]]],
    );
    assert.deepEqual(
        resolve(
            [
                operation(1, 1),
                operation(2, 10, {
                    raisedBedFieldId: 12,
                    completedAt: '2026-09-11',
                }),
            ],
            { fields: removedFields },
        ).map((addon) => [addon.operationId, addon.positionNumbers]),
        [
            [1, [1, 3]],
            [2, [2]],
        ],
    );
    assert.deepEqual(
        resolve([operation(1, 1, { completedAt: '2026-09-11' })], {
            fields: removedFields,
        })[0]?.positionNumbers,
        [1, 2, 3],
    );
});

test('removing a selected multi-field planting clears its exact footprint across later occupants', () => {
    const plantings = [
        {
            id: 20,
            isActive: false,
            lifecycleStartedAt: '2026-09-01',
            lifecycleStatus: 'removed',
            lifecycleStoppedAt: new Date('2026-09-10'),
            memberships: [
                { raisedBedField: { positionIndex: 0 } },
                { raisedBedField: { positionIndex: 2 } },
            ],
        },
        {
            id: 21,
            isActive: true,
            lifecycleStartedAt: '2026-09-11',
            lifecycleStatus: 'sowed',
            lifecycleStoppedAt: null,
            memberships: [{ raisedBedField: { positionIndex: 0 } }],
        },
    ];
    const result = resolve(
        [
            operation(1, 1),
            operation(2, 6),
            operation(3, 8),
            operation(4, 3, { plantingId: 20 }),
            operation(5, 3, { plantingId: 21, completedAt: '2026-09-12' }),
        ],
        { plantings },
    );
    assert.deepEqual(
        result.map((addon) => [addon.family, addon.positionNumbers]),
        [
            ['supports', [1]],
            ['mulch', [2]],
            ['agrotextile', [2]],
            ['insectMesh', [2]],
        ],
    );
});

test('harvest, death, failed germination and cancelled plans do not imply physical removal', () => {
    for (const status of ['harvested', 'died', 'notSprouted', 'cancelled']) {
        const plantings = [
            {
                id: 20,
                isActive: status !== 'cancelled',
                lifecycleStartedAt: '2026-09-01',
                lifecycleStatus: status,
                lifecycleStoppedAt: '2026-09-10',
                memberships: [{ raisedBedField: { positionIndex: 1 } }],
            },
        ];
        assert.deepEqual(
            resolve([operation(1, 1)], { plantings })[0]?.positionNumbers,
            [1, 2, 3],
            status,
        );
    }
});

test('the latest removal wins across field histories regardless of array order', () => {
    const fieldHistory = fields.map((field) => ({
        ...field,
        plantCycles:
            field.id === 12
                ? [
                      {
                          active: false,
                          startedAt: '2026-09-06',
                          plantRemovedDate: '2026-09-10',
                      },
                      {
                          active: false,
                          startedAt: '2026-09-01',
                          plantRemovedDate: '2026-09-05',
                      },
                      { active: true, startedAt: '2026-09-11' },
                  ]
                : field.plantCycles,
    }));
    assert.deepEqual(
        resolve([operation(1, 1, { completedAt: '2026-09-07' })], {
            fields: fieldHistory,
        })[0]?.positionNumbers,
        [1, 3],
    );
});
