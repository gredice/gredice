import assert from 'node:assert/strict';
import test from 'node:test';
import {
    communityEditRequestStatus,
    communityEditSectionContext,
    presentCommunityContributionPage,
    presentCommunityEditRequest,
} from './communityEditPresentation';

const entityLabels = new Map([[7, 'Rajčica']]);

function suggestionNote(value: Record<string, unknown>) {
    return JSON.stringify({
        format: 'community-entity-suggestion-v1',
        ...value,
    });
}

test('an edit is titled by its entity and labelled by section and public field names', () => {
    assert.deepEqual(
        presentCommunityEditRequest(
            {
                entityTypeName: 'plant',
                entityId: 7,
                sectionKey: 'sowing',
                submitterNote: 'Izvor: vlastito iskustvo.',
                changes: [
                    { fieldKey: 'plant.sowing', sectionKey: 'sowing' },
                    { fieldKey: 'plant.seeding-depth', sectionKey: 'sowing' },
                    { fieldKey: 'plant.seeding-depth', sectionKey: 'sowing' },
                ],
            },
            entityLabels,
        ),
        {
            kind: 'edit',
            title: 'Rajčica',
            context: 'Sijanje',
            changeLabels: ['Sijanje', 'Dubina sijanja'],
        },
    );
});

test('a page-level edit takes the section its changes share, or none', () => {
    const request = {
        entityTypeName: 'plant',
        entityId: 7,
        sectionKey: null,
        submitterNote: null,
    };

    assert.equal(
        presentCommunityEditRequest(
            {
                ...request,
                changes: [
                    { fieldKey: 'plant.name', sectionKey: 'overview' },
                    { fieldKey: 'plant.origin', sectionKey: 'overview' },
                ],
            },
            entityLabels,
        ).context,
        'Pregled',
    );
    assert.equal(
        presentCommunityEditRequest(
            {
                ...request,
                changes: [
                    { fieldKey: 'plant.name', sectionKey: 'overview' },
                    { fieldKey: 'plant.water', sectionKey: 'watering' },
                ],
            },
            entityLabels,
        ).context,
        null,
    );
});

test('fields without a public label and unknown entities never leak internal keys', () => {
    const presentation = presentCommunityEditRequest(
        {
            entityTypeName: 'plant',
            entityId: 404,
            sectionKey: 'overview',
            submitterNote: null,
            changes: [
                { fieldKey: 'plant.internal-price', sectionKey: 'overview' },
            ],
        },
        entityLabels,
    );

    assert.deepEqual(presentation, {
        kind: 'edit',
        title: 'Zapis',
        context: 'Pregled',
        changeLabels: [],
    });
});

test('a suggestion is titled by the suggested name with its kind and subject as context', () => {
    assert.deepEqual(
        presentCommunityEditRequest(
            {
                entityTypeName: 'plant',
                entityId: 7,
                sectionKey: 'new-plant-sort',
                submitterNote: suggestionNote({
                    kind: 'plantSort',
                    name: 'Volovsko srce',
                    description: 'Velika mesnata sorta.',
                    parentPlantId: 7,
                    parentPlantName: 'Rajčica',
                }),
                changes: [],
            },
            entityLabels,
        ),
        {
            kind: 'suggestion',
            title: 'Volovsko srce',
            context: 'Nova sorta · Rajčica',
            changeLabels: [],
        },
    );

    assert.equal(
        presentCommunityEditRequest(
            {
                entityTypeName: 'plant',
                entityId: 7,
                sectionKey: 'new-disease',
                submitterNote: suggestionNote({
                    kind: 'disease',
                    name: 'Plamenjača',
                    description: 'Gljivična bolest.',
                    symptoms: 'Smeđe pjege.',
                    favorableConditions: 'Vlaga.',
                    affectedPlants: [
                        { id: 7, name: 'Rajčica' },
                        { id: 8, name: 'Krumpir' },
                        { id: 9, name: 'Paprika' },
                        { id: 10, name: 'Patlidžan' },
                    ],
                }),
                changes: [],
            },
            entityLabels,
        ).context,
        'Nova bolest · Rajčica, Krumpir, Paprika i još 1',
    );
});

test('section context covers suggestion sections and has none without a key', () => {
    assert.equal(communityEditSectionContext(null, 'plant'), null);
    assert.equal(
        communityEditSectionContext('new-plant-tip', 'plant'),
        'Novi savjet',
    );
    assert.equal(
        communityEditSectionContext('relationships', 'plantDisease'),
        'Pogođene biljke',
    );
});

test('a contribution page carries only public fields', () => {
    assert.deepEqual(
        presentCommunityContributionPage(
            {
                entityTypeName: 'plant',
                entityId: 7,
                publicPath: '/biljke/rajcica',
                sectionKey: 'harvest',
                appliedAt: new Date('2026-11-03T10:00:00Z'),
            },
            entityLabels,
        ),
        {
            title: 'Rajčica',
            context: 'Berba',
            publicPath: '/biljke/rajcica',
            appliedAt: '2026-11-03T10:00:00.000Z',
        },
    );
});

test('an unknown stored status is reported as pending', () => {
    assert.equal(communityEditRequestStatus('applied'), 'applied');
    assert.equal(communityEditRequestStatus('conflicted'), 'conflicted');
    assert.equal(communityEditRequestStatus('archived'), 'pending');
});
