import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getPublicGardenActivePlantFields,
    getPublicGardenPlantCountLabel,
    getPublicGardenPlantLocationLabel,
    getPublicGardenPlantMilestones,
    getPublicGardenPlantStatusColor,
} from './publicGardenRaisedBedDetailsModel';

describe('getPublicGardenActivePlantFields', () => {
    it('returns planted active fields in position order', () => {
        const fields = getPublicGardenActivePlantFields({
            fields: [
                { active: true, plantSortId: 8, positionIndex: 4 },
                { active: false, plantSortId: 9, positionIndex: 1 },
                { active: true, plantSortId: undefined, positionIndex: 2 },
                { active: true, plantSortId: 7, positionIndex: 0 },
            ],
        });

        assert.deepEqual(
            fields.map((field) => field.positionIndex),
            [0, 4],
        );
    });
});

describe('getPublicGardenPlantMilestones', () => {
    it('shows the planned date until a plant is sown', () => {
        assert.deepEqual(
            getPublicGardenPlantMilestones({
                plantGrowthDate: undefined,
                plantHarvestedDate: undefined,
                plantReadyDate: undefined,
                plantScheduledDate: '2026-07-12T08:00:00.000Z',
                plantSowDate: undefined,
            }),
            [{ label: 'Planirano', value: '12. srp 2026.' }],
        );
    });

    it('shows recorded lifecycle dates after sowing', () => {
        assert.deepEqual(
            getPublicGardenPlantMilestones({
                plantGrowthDate: '2026-06-10T08:00:00.000Z',
                plantHarvestedDate: undefined,
                plantReadyDate: '2026-07-10T08:00:00.000Z',
                plantScheduledDate: '2026-06-02T08:00:00.000Z',
                plantSowDate: '2026-06-03T08:00:00.000Z',
            }),
            [
                { label: 'Posijano', value: '3. lip 2026.' },
                { label: 'Proklijalo', value: '10. lip 2026.' },
                { label: 'Spremno za berbu', value: '10. srp 2026.' },
            ],
        );
    });

    it('formats dates in the Croatian garden timezone', () => {
        assert.deepEqual(
            getPublicGardenPlantMilestones({
                plantGrowthDate: undefined,
                plantHarvestedDate: undefined,
                plantReadyDate: undefined,
                plantScheduledDate: '2026-06-14T22:30:00.000Z',
                plantSowDate: undefined,
            }),
            [{ label: 'Planirano', value: '15. lip 2026.' }],
        );
    });
});

describe('public garden plant labels', () => {
    it('localizes counts and status colors', () => {
        assert.equal(getPublicGardenPlantCountLabel(1), '1 biljka');
        assert.equal(getPublicGardenPlantCountLabel(4), '4 biljke');
        assert.equal(getPublicGardenPlantCountLabel(11), '11 biljaka');
        assert.equal(getPublicGardenPlantCountLabel(14), '14 biljaka');
        assert.equal(getPublicGardenPlantCountLabel(21), '21 biljka');
        assert.equal(getPublicGardenPlantStatusColor('ready'), 'info');
        assert.equal(getPublicGardenPlantStatusColor('died'), 'error');
        assert.equal(getPublicGardenPlantStatusColor('sprouted'), 'success');
    });

    it('distinguishes seedlings that are not physically in the raised bed', () => {
        assert.equal(
            getPublicGardenPlantLocationLabel({
                plantStatus: 'sprouted',
                sowingLocation: 'greenhouse',
            }),
            'U plasteniku',
        );
        assert.equal(
            getPublicGardenPlantLocationLabel({
                plantStatus: 'firstFlowers',
                sowingLocation: 'greenhouse',
            }),
            'Presadnica iz plastenika',
        );
        assert.equal(
            getPublicGardenPlantLocationLabel({
                plantStatus: 'sowed',
                sowingLocation: 'direct',
            }),
            'Izravna sjetva',
        );
    });
});
